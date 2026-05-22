import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { useHighlightRules, HighlightRule } from '../../hooks/useTerminalTheme';
import '@xterm/xterm/css/xterm.css';

interface Props {
  connId: number;
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

export default function ThemedTerminal({ connId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rules = useHighlightRules();

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true, fontSize: 13, fontFamily: 'Menlo, Monaco, monospace',
      theme: { background: '#0c0c0c', foreground: '#d4d4d4' },
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);

    if (ref.current) {
      term.open(ref.current);
      fitAddon.fit();
    }

    const token = localStorage.getItem('token') || '';
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/ssh/${connId}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data) term.write(highlightText(msg.data, rules));
        if (msg.error) term.write(`\r\n\x1b[31m${msg.error}\x1b[0m\r\n`);
      } catch {
        term.write(event.data);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ data }));
      }
    });

    ws.onclose = () => term.write('\r\n\x1b[33m[连接已断开，正在重连...]\x1b[0m\r\n');

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      ws.close();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [connId]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
