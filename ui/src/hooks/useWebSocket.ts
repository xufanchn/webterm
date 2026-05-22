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

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      onOpen?.();
    };

    ws.onmessage = (event) => {
      onMessage(typeof event.data === 'string' ? event.data : '');
    };

    ws.onclose = () => {
      if (retryCountRef.current >= MAX_RETRIES) {
        onClose?.(true);
        return;
      }
      onClose?.();
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      retryCountRef.current++;
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, onMessage, onClose, onOpen]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { send };
}
