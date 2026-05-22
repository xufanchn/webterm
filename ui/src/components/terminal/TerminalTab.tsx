import ThemedTerminal from './ThemedTerminal';

interface Props {
  connId: number;
}

export default function TerminalTab({ connId }: Props) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <ThemedTerminal connId={connId} />
    </div>
  );
}
