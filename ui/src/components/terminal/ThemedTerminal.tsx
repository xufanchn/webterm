import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';

interface Props {
  connId: number;
}

export default function ThemedTerminal({ connId }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
        if (msg.data) term.write(msg.data);
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
