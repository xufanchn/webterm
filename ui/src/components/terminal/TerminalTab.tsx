import ThemedTerminal from './ThemedTerminal';
import SftpPanel from '../sftp/SftpPanel';
import { useState } from 'react';

interface Props {
  connId: number;
}

export default function TerminalTab({ connId }: Props) {
  const [sftpPath, setSftpPath] = useState('/');

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ThemedTerminal connId={connId} />
      </div>
      <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid #383838' }}>
        <SftpPanel connId={connId} currentPath={sftpPath} onPathChange={setSftpPath} />
      </div>
    </div>
  );
}
