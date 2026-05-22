import { useCallback, useRef, useState } from 'react';
import type { SftpFile } from './SftpPanel';

interface Props {
  files: SftpFile[];
  loading: boolean;
  connId?: number;
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string, newName: string) => void;
  onMkdir: (name: string) => void;
  onUpload: () => void;
  onEdit: (path: string, name: string) => void;
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

export default function FileList({ files, loading, connId, currentPath, onNavigate, onDelete: _onDelete, onRename: _onRename, onMkdir, onUpload, onEdit }: Props) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleMkdir = () => {
    if (newFolderName.trim()) {
      onMkdir(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploading(true);
      setUploadProgress(0);

      const token = localStorage.getItem('token') || '';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conn_id', String(connId));
      formData.append('path', currentPath + '/' + file.name);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setUploading(false);
        setUploadProgress(0);
        onUpload(); // trigger refresh
      };
      xhr.open('POST', '/api/sftp/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send(formData);
    }
  }, [connId, currentPath, onUpload]);

  const handleDownload = (filePath: string, fileName: string) => {
    const token = localStorage.getItem('token') || '';
    const a = document.createElement('a');
    a.href = `/api/sftp/download/${connId}?path=${encodeURIComponent(filePath)}&token=${token}`;
    a.download = fileName;
    a.click();
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
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          margin: 4, padding: 8, border: `2px dashed ${dragOver ? '#4fc3f7' : '#555'}`,
          borderRadius: 4, textAlign: 'center', color: dragOver ? '#4fc3f7' : '#888',
          fontSize: 10, cursor: 'pointer',
          background: dragOver ? 'rgba(79,195,247,0.1)' : 'transparent',
        }}
        onClick={() => fileInputRef.current?.click()}>
        {uploading ? `上传中... ${uploadProgress}%` : dragOver ? '释放以上传' : '拖拽文件到此处上传 / 点击选择'}
        <input ref={fileInputRef} type="file" style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files[0]) {
              const fakeEvent = { dataTransfer: { files } } as any;
              handleDrop(fakeEvent as React.DragEvent);
            }
          }} />
      </div>
      {files.map((f) => (
        <div key={f.path}
          onClick={() => f.is_dir ? onNavigate(f.path) : handleDownload(f.path, f.name)}
          onDoubleClick={() => f.is_dir ? undefined : onEdit(f.path, f.name)}
          style={{
            padding: '2px 8px', color: '#ccc', cursor: 'pointer',
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
