import { useEffect, useRef, useCallback } from 'react';

const MAX_RETRIES = 3;

interface UseWsOptions {
  url: string;
  onMessage: (data: string) => void;
  onClose?: (final?: boolean) => void;
  onOpen?: () => void;
}

export function useWebSocket({ url, onMessage, onClose, onOpen }: UseWsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bufferRef = useRef<string[]>([]);
  const disposedRef = useRef(false);

  // Keep latest callbacks in refs to avoid reconnect on re-render
  const onMessageRef = useRef(onMessage);
  const onCloseRef = useRef(onClose);
  const onOpenRef = useRef(onOpen);
  onMessageRef.current = onMessage;
  onCloseRef.current = onClose;
  onOpenRef.current = onOpen;

  const connect = useCallback(() => {
    if (disposedRef.current) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (bufferRef.current.length > 0) {
        for (const msg of bufferRef.current) {
          ws.send(msg);
        }
        bufferRef.current = [];
      }
      // onOpen fires on {"type":"ready"} (session truly established), not here
    };

    ws.onmessage = (event) => {
      // {"type":"ready"} = the backend confirmed the real session is up
      // (e.g. SSH shell started). Only now does the reconnect budget reset —
      // the bare WS handshake succeeding must NOT clear it, or a live server
      // with a dead SSH target would retry forever.
      try {
        const m = JSON.parse(event.data);
        if (m && m.type === 'ready') {
          retryCountRef.current = 0;
          onOpenRef.current?.();
          return;
        }
      } catch { /* not JSON — regular payload */ }
      onMessageRef.current(typeof event.data === 'string' ? event.data : '');
    };

    ws.onclose = () => {
      if (disposedRef.current) return;
      if (retryCountRef.current >= MAX_RETRIES) {
        onCloseRef.current?.(true);
        return;
      }
      onCloseRef.current?.();
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      retryCountRef.current++;
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    disposedRef.current = false;
    connect();
    return () => {
      disposedRef.current = true;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      bufferRef.current.push(data);
    }
  }, []);

  return { send };
}
