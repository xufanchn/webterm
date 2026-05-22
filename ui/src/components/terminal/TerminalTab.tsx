import { useState, useCallback } from 'react';
import ThemedTerminal from './ThemedTerminal';
import { useConnectionStore } from '../../store/connections';

interface MenuItem {
  label: string;
  action: () => void;
}

interface Props {
  connId: number;
  extraMenuItems?: MenuItem[];
  paneTabs?: import('../../store/layout').Tab[];
  myTabId?: string;
}

export default function TerminalTab({ connId, extraMenuItems, paneTabs, myTabId }: Props) {
  const connections = useConnectionStore((s) => s.connections);
  const conn = connections.find((c) => c.id === connId);
  const [connected, setConnected] = useState(false);

  const handleStatus = useCallback((status: boolean) => setConnected(status), []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <ThemedTerminal connId={connId} onStatus={handleStatus} extraMenuItems={extraMenuItems} tabs={paneTabs} myTabId={myTabId} />
      <StatusBar host={conn?.host} name={conn?.name} connected={connected} />
    </div>
  );
}

function StatusBar({ host, name, connected }: {
  host?: string; name?: string; connected: boolean;
}) {
  return (
    <div style={{
      height: 22, flexShrink: 0, background: '#007acc',
      display: 'flex', alignItems: 'center', padding: '0 8px',
      fontSize: 11, color: '#fff', gap: 12,
    }}>
      <span style={{ opacity: 0.7 }}>WShell Terminal</span>
      <span style={{ flex: 1 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#4caf50' : '#f44747',
        }} />
        {connected ? '已连接' : '未连接'}
      </span>
      {name && <span>{name}{host ? ` (${host})` : ''}</span>}
    </div>
  );
}
