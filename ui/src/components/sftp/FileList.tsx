import { useState } from 'react';
import type { SftpFile } from './SftpPanel';

interface Props {
  files: SftpFile[];
  loading: boolean;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string, newName: string) => void;
  onMkdir: (name: string) => void;
}

const sizeFormat = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const modeStr = (mode: number): string => {
  const r = (mode & 0o400) ? 'r' : '-';
  const w = (mode & 0o200) ? 'w' : '-';
  const x = (mode & 0o100) ? 'x' : '-';
  return (mode & 0o40000 ? 'd' : mode & 0o120000 ? 'l' : '-') + r + w + x + r + w + x + r + w + x;
};

export default function FileList({ files, loading, onNavigate, onDelete, onRename, onMkdir }: Props) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleMkdir = () => {
    if (newFolderName.trim()) {
      onMkdir(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ padding: '2px 8px', borderBottom: '1px solid #383838', display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 10 }}>
        <button onClick={() => setShowNewFolder(!showNewFolder)}
          style={{ background: 'none', border: 'none', color: '#4fc3f7', cursor: 'pointer', fontSize: 10 }}>+ 新文件夹</button>
      </div>
      {showNewFolder && (
        <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMkdir()}
            placeholder="文件夹名"
            style={{ flex: 1, padding: '2px 6px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, color: '#fff', fontSize: 10 }} />
          <button onClick={handleMkdir}
            style={{ background: '#007acc', border: 'none', color: '#fff', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 10 }}>创建</button>
        </div>
      )}
      {loading && <div style={{ padding: 8, color: '#888' }}>加载中...</div>}
      {files.map((f) => (
        <div key={f.path}
          onClick={() => f.is_dir ? onNavigate(f.path) : undefined}
          style={{
            padding: '2px 8px', color: '#ccc', cursor: f.is_dir ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2d2e')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
            {f.is_dir ? '📁' : f.is_link ? '🔗' : '📄'}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          <span style={{ color: '#888', fontSize: 9, width: 60, textAlign: 'right', flexShrink: 0 }}>{!f.is_dir && sizeFormat(f.size)}</span>
          <span style={{ color: '#666', fontSize: 9, width: 70, textAlign: 'right', flexShrink: 0 }}>{modeStr(f.mode)}</span>
        </div>
      ))}
    </div>
  );
}
