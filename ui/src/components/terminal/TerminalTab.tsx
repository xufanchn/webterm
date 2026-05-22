import ThemedTerminal from './ThemedTerminal';

interface Props {
  connId: number;
}

export default function TerminalTab({ connId }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <ThemedTerminal connId={connId} />
      </div>
    </div>
  );
}
