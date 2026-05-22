import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { useHighlightRules } from '../../hooks/useTerminalTheme';
import type { HighlightRule } from '../../hooks/useTerminalTheme';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLayoutStore } from '../../store/layout';
import { usePreferencesStore } from '../../store/preferences';
import '@xterm/xterm/css/xterm.css';
import { getTheme } from '../../themes/presets';
import ContextMenu from '../common/ContextMenu';

interface Props {
  connId: number;
  themeName?: string;
  onStatus?: (connected: boolean) => void;
  onResizeDim?: (cols: number, rows: number) => void;
  extraMenuItems?: { label: string; action: () => void }[];
  tabs?: import('../../store/layout').Tab[];
  myTabId?: string;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r};${g};${b}`;
}

function highlightText(text: string, rules: HighlightRule[]): string {
  for (const rule of rules) {
    if (text.includes(rule.keyword)) {
      const escaped = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(
        new RegExp(`(${escaped})`, 'g'),
        `\x1b[1m\x1b[38;2;${hexToRgb(rule.color)}m$1\x1b[0m`
      );
    }
  }
  return text;
}

export default function ThemedTerminal({ connId, themeName: _themeName, onStatus, onResizeDim, extraMenuItems, tabs,  myTabId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const rules = useHighlightRules();
  const sendRef = useRef<(data: string) => void>(() => {});
  const onStatusRef = useRef(onStatus);
  const onResizeDimRef = useRef(onResizeDim);
  onStatusRef.current = onStatus;
  onResizeDimRef.current = onResizeDim;
  const themeName = usePreferencesStore((s) => s.themeName);
  const fontSize = usePreferencesStore((s) => s.fontSize);

  useEffect(() => {
    const themeConfig = getTheme(themeName || 'Dracula');
    const term = new Terminal({
      cursorBlink: true, fontSize: fontSize, fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
      theme: {
        background: themeConfig.background,
        foreground: themeConfig.foreground,
        cursor: themeConfig.cursor,
        cursorAccent: themeConfig.cursorAccent,
        selectionBackground: themeConfig.selectionBackground,
        black: themeConfig.black,
        red: themeConfig.red,
        green: themeConfig.green,
        yellow: themeConfig.yellow,
        blue: themeConfig.blue,
        magenta: themeConfig.magenta,
        cyan: themeConfig.cyan,
        white: themeConfig.white,
        brightBlack: themeConfig.brightBlack,
        brightRed: themeConfig.brightRed,
        brightGreen: themeConfig.brightGreen,
        brightYellow: themeConfig.brightYellow,
        brightBlue: themeConfig.brightBlue,
        brightMagenta: themeConfig.brightMagenta,
        brightCyan: themeConfig.brightCyan,
        brightWhite: themeConfig.brightWhite,
      },
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);

    // Ctrl+C: send SIGINT (0x03)
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.key === 'c' && !e.shiftKey && !e.altKey) {
        if (e.type === 'keydown') {
          sendRef.current(JSON.stringify({ data: '\x03' }));
        }
        return false;
      }

      // Ctrl+Z: send SIGTSTP (0x1a)
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey && !e.altKey) {
        if (e.type === 'keydown') {
          sendRef.current(JSON.stringify({ data: '\x1a' }));
        }
        return false;
      }

      // Ctrl+F: search (existing behavior)
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('xterm-search-input');
        if (searchInput) {
          searchInput.focus();
        } else {
          // Create a simple search bar overlay
          const container = term.element?.parentElement;
          if (!container) return true;
          const bar = document.createElement('div');
          bar.id = 'xterm-search-bar';
          bar.style.cssText = 'position:absolute;top:0;right:0;z-index:10;display:flex;gap:4px;padding:4px 8px;background:#333;border-radius:0 0 0 6px;';
          const input = document.createElement('input');
          input.id = 'xterm-search-input';
          input.style.cssText = 'width:160px;padding:2px 6px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#fff;font-size:12px;outline:none;';
          input.placeholder = '查找...';

          input.onkeydown = (ke) => {
            if (ke.key === 'Escape') { bar.remove(); term.focus(); }
            if (ke.key === 'Enter') {
              if (ke.shiftKey) searchAddon.findPrevious(input.value);
              else searchAddon.findNext(input.value);
            }
          };

          input.oninput = () => {
            if (input.value) searchAddon.findNext(input.value);
          };

          bar.appendChild(input);
          container.appendChild(bar);
          input.focus();
        }
        return false;
      }
      return true;
    });

    // OSC 7 handler: track shell directory changes for SFTP sync
    term.parser.registerOscHandler(7, (data) => {
      // Format: file://hostname/path
      const match = /file:\/\/[^/]+(.+)/.exec(data);
      if (match) setSftpCdPath(match[1]);
      return false; // don't display in terminal
    });

    term.onResize(({ cols, rows }) => {
      sendRef.current(JSON.stringify({ cols, rows }));
      onResizeDimRef.current?.(cols, rows);
    });

    if (ref.current) {
      ref.current.style.backgroundColor = themeConfig.background;
      term.open(ref.current);
      termRef.current = term;

      requestAnimationFrame(() => {
        fitAddon.fit();
        term.focus();
        // Retry focus after layout settles (important for split panes)
        setTimeout(() => term.focus(), 100);
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    if (ref.current) resizeObserver.observe(ref.current);

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [themeName, fontSize]);

  const token = localStorage.getItem('token') || '';
  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/ssh/${connId}?token=${token}`;

  const { send } = useWebSocket({
    url: wsUrl,
    onMessage: (data) => {
      const term = termRef.current;
      if (!term) return;
      try {
        const msg = JSON.parse(data);
        if (msg.data) term.write(highlightText(msg.data, rules));
        if (msg.error) term.write(`\r\n\x1b[31m${msg.error}\x1b[0m\r\n`);
      } catch {
        term.write(data);
      }
    },
    onClose: (final) => {
      if (final) {
        onStatusRef.current?.(false);
        signalSftpDisconnect();
        termRef.current?.write('\r\n\x1b[33m[连接已断开]\x1b[0m\r\n');
      } else {
        termRef.current?.write('\r\n\x1b[33m[连接已断开，正在重连...]\x1b[0m\r\n');
      }
    },
    onOpen: () => {
      onStatusRef.current?.(true);
      termRef.current?.write('\r\n\x1b[32m[已连接]\x1b[0m\r\n');
    },
  });

  sendRef.current = send;

  const broadcastScope = useLayoutStore((s) => s.broadcastScope);
  const broadcastSourceId = useLayoutStore((s) => s.broadcastSourceId);
  const setBroadcastSource = useLayoutStore((s) => s.setBroadcastSource);
  const terminalRegistry = useLayoutStore((s) => s.terminalRegistry);
  const registerTerminal = useLayoutStore((s) => s.registerTerminal);
  const unregisterTerminal = useLayoutStore((s) => s.unregisterTerminal);
  const setSftpCdPath = useLayoutStore((s) => s.setSftpCdPath);
  const signalSftpDisconnect = useLayoutStore((s) => s.signalSftpDisconnect);

  // Register this terminal's send function globally for broadcast
  useEffect(() => {
    if (!myTabId) return;
    const key = `wshell-ws-${myTabId}`;
    (window as any)[key] = send;
    registerTerminal(myTabId);
    return () => {
      delete (window as any)[key];
      unregisterTerminal(myTabId);
    };
  }, [myTabId, send, registerTerminal, unregisterTerminal]);

  // Auto-register as broadcast source
  useEffect(() => {
    if (broadcastScope !== 'off' && !broadcastSourceId && myTabId) {
      setBroadcastSource(myTabId);
    }
  }, [broadcastScope, broadcastSourceId, myTabId, setBroadcastSource]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const disposable = term.onData((data) => {
      const isSource = myTabId === broadcastSourceId;
      const isTarget = broadcastScope !== 'off' && !isSource;

      if (isTarget) return; // Target terminal - input comes from broadcast

      send(JSON.stringify({ data }));

      // Broadcast to other terminals
      if (isSource && broadcastScope !== 'off') {
        const targets = broadcastScope === 'all' ? terminalRegistry : tabs?.map((t) => t.id) || [];
        targets.forEach((tid) => {
          if (tid !== myTabId) {
            const targetSend = (window as any)[`wshell-ws-${tid}`];
            if (targetSend) targetSend(JSON.stringify({ data }));
          }
        });
      }
    });
    return () => disposable.dispose();
  }, [send, broadcastScope, broadcastSourceId, myTabId, tabs, terminalRegistry]);

  return (
    <div ref={ref} style={{ flex: 1, overflow: 'hidden' }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}>
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}
          items={[
            {
              label: '粘贴',
              action: async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  termRef.current?.paste(text);
                } catch {}
              },
            },
            {
              label: '查找 (Ctrl+F)',
              action: () => {
                const input = document.getElementById('xterm-search-input') as HTMLInputElement;
                if (input) {
                  input.focus();
                  input.select();
                } else {
                  termRef.current?.focus();
                  const ctrlF = new KeyboardEvent('keydown', { ctrlKey: true, key: 'f', code: 'KeyF', bubbles: true });
                  termRef.current?.element?.dispatchEvent(ctrlF);
                }
              },
            },
            {
              label: '清屏',
              action: () => {
                termRef.current?.clear();
              },
            },
            ...(extraMenuItems || []),
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
