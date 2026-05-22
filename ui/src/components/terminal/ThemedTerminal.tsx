import { useEffect, useRef } from 'react';
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

interface Props {
  connId: number;
  themeName?: string;
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

export default function ThemedTerminal({ connId, themeName: _themeName }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const rules = useHighlightRules();
  const themeName = usePreferencesStore((s) => s.themeName);
  const fontSize = usePreferencesStore((s) => s.fontSize);

  useEffect(() => {
    const themeConfig = getTheme(themeName || 'Dracula');
    const term = new Terminal({
      cursorBlink: true, fontSize: fontSize, fontFamily: 'Menlo, Monaco, monospace',
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

    // Ctrl+F to trigger search
    term.attachCustomKeyEventHandler((e) => {
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

    if (ref.current) {
      term.open(ref.current);
      fitAddon.fit();
    }

    termRef.current = term;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
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
    onClose: () => {
      termRef.current?.write('\r\n\x1b[33m[连接已断开，正在重连...]\x1b[0m\r\n');
    },
    onOpen: () => {
      termRef.current?.write('\r\n\x1b[32m[已重新连接]\x1b[0m\r\n');
    },
  });

  const broadcastMode = useLayoutStore((s) => s.broadcastMode);
  const broadcastSourceId = useLayoutStore((s) => s.broadcastSourceId);
  const setBroadcastSource = useLayoutStore((s) => s.setBroadcastSource);
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);

  // Register this terminal's send function globally for broadcast
  useEffect(() => {
    if (!activeTabId) return;
    const key = `wshell-ws-${activeTabId}`;
    (window as any)[key] = send;
    return () => { delete (window as any)[key]; };
  }, [activeTabId, send]);

  // Auto-register as broadcast source if broadcast is on and no source set
  useEffect(() => {
    if (broadcastMode && !broadcastSourceId && activeTabId) {
      setBroadcastSource(activeTabId);
    }
  }, [broadcastMode, broadcastSourceId, activeTabId, setBroadcastSource]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const disposable = term.onData((data) => {
      if (broadcastMode && broadcastSourceId && activeTabId !== broadcastSourceId) {
        // This is a target terminal - don't send keystrokes
        return;
      }
      send(JSON.stringify({ data }));
      // If this is the source in broadcast mode, forward to all targets
      if (broadcastMode && activeTabId === broadcastSourceId) {
        tabs.forEach((tab) => {
          if (tab.id !== activeTabId && tab.type === 'ssh') {
            const targetSend = (window as any)[`wshell-ws-${tab.id}`];
            if (targetSend) targetSend(JSON.stringify({ data }));
          }
        });
      }
    });
    return () => disposable.dispose();
  }, [send, broadcastMode, broadcastSourceId, activeTabId, tabs]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
