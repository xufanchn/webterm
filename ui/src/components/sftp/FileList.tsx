import { useCallback, useEffect, useRef, useState } from 'react';
import type { SftpFile } from './SftpPanel';
import { t } from '../../i18n';
import ContextMenu from '../common/ContextMenu';
import Icon from '../common/Icon';
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
  onGoParent?: () => void;
  onToggleFollow?: () => void;
  followCd?: boolean;
}

const sizeFormat = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const timeFormat = (ts: string): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type SortKey = 'name' | 'size' | 'time';
type SortDir = 'asc' | 'desc';

function NewFolderInput({ value, onChange, onConfirm, onCancel, confirmLabel = t('config_create') }: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  return (
    <div ref={ref} style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus placeholder={t("file_folder_name")}
        style={{ flex: 1, padding: '2px 6px', background: '#1f2335', border: '1px solid #3b4261', borderRadius: 4, color: '#fff', fontSize: 10 }} />
      <button onClick={onConfirm}
        style={{ background: '#7aa2f7', border: 'none', color: '#1a1b26', fontWeight: 600, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10 }}>{confirmLabel}</button>
      <button onClick={onCancel}
        style={{ background: '#3b4261', border: 'none', color: '#ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10 }}>{t("conn_cancel")}</button>
    </div>
  );
}

export default function FileList({ files, loading, connId, currentPath, onNavigate, onDelete, onRename, onMkdir, onUpload, onEdit, onGoParent, onToggleFollow, followCd }: Props) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; file: SftpFile} | null>(null);
  const [blankMenu, setBlankMenu] = useState<{x: number; y: number} | null>(null);
  const [renaming, setRenaming] = useState<{path: string; name: string} | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const uploadTargetRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback((files: FileList | File[]) => {
    if (!connId || files.length === 0) return;
    const targetPath = uploadTargetRef.current || currentPath;
    uploadTargetRef.current = null;
    setUploading(true);
    setUploadProgress(0);

    const token = localStorage.getItem('token') || '';
    const uploadNext = (index: number) => {
      if (index >= files.length) {
        setUploading(false);
        setUploadProgress(0);
        onUpload();
        return;
      }
      const file = files[index];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conn_id', String(connId));
      formData.append('path', targetPath + '/' + file.name);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          uploadNext(index + 1);
        } else {
          let errMsg = `${t("file_upload_failed")} (${xhr.status})`;
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.error) errMsg = resp.error;
          } catch {}
          setUploading(false);
          setUploadError(errMsg);
          setTimeout(() => setUploadError(null), 5000);
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setUploadError(t('file_upload_error'));
        setTimeout(() => setUploadError(null), 5000);
      };
      xhr.open('POST', '/api/sftp/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send(formData);
    };
    uploadNext(0);
  }, [connId, currentPath, onUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    doUpload(e.dataTransfer.files);
  }, [doUpload]);

  const handleDownload = async (filePath: string, fileName: string) => {
    const token = localStorage.getItem('token') || '';
    try {
      const resp = await fetch(`/api/sftp/download/${connId}?path=${encodeURIComponent(filePath)}&token=${token}`);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      // Try native save picker, fallback to link download
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({ suggestedName: fileName });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch { /* user cancelled or not supported, fallback */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
        setDownloadError(`${t('file_download_failed')}: ${fileName}`);
        setTimeout(() => setDownloadError(null), 5000);
      }
  };

  // Sort: directories first, then by selected key
  const sortedFiles = [...files].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'size') cmp = a.size - b.size;
    else if (sortKey === 'time') cmp = a.mod_time.localeCompare(b.mod_time);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? <Icon name="arrow-up" size={10} style={{ verticalAlign: 'middle' }} /> : <Icon name="arrow-down" size={10} style={{ verticalAlign: 'middle' }} />) : '';

  return (
    <div style={{ flex: 1, overflow: 'auto', outline: dragOver ? '2px solid #7aa2f7' : 'none', outlineOffset: -2 }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { setDragOver(false); handleDrop(e); }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-file-row]')) return;
        onGoParent?.();
      }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-file-row]')) return;
        e.preventDefault();
        setBlankMenu({ x: e.clientX, y: e.clientY });
      }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) doUpload(e.target.files);
          e.target.value = '';
        }} />
      {uploading && <div style={{ padding: '2px 8px', color: '#7aa2f7', fontSize: 10 }}>{t("sftp_uploading")} {uploadProgress}%</div>}
      {/* Column headers */}
      <div style={{ padding: '2px 8px', borderBottom: '1px solid #3b4261', display: 'flex', alignItems: 'center', gap: 4, color: '#888', fontSize: 10, flexShrink: 0 }}>
        <span style={{ width: 16, flexShrink: 0 }} />
        <span onClick={() => toggleSort('name')} style={{ flex: 1, cursor: 'pointer', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('file_name')}{sortArrow('name')}</span>
        <span onClick={() => toggleSort('size')} style={{ width: 55, cursor: 'pointer', userSelect: 'none', textAlign: 'right', flexShrink: 0 }}>{t('file_size')}{sortArrow('size')}</span>
        <span onClick={() => toggleSort('time')} style={{ width: 105, cursor: 'pointer', userSelect: 'none', textAlign: 'right', flexShrink: 0 }}>{t('file_time')}{sortArrow('time')}</span>
      </div>
      {loading && <div style={{ padding: 8, color: '#888' }}>{t("file_loading")}</div>}
      {!loading && currentPath !== '/' && (
        <div data-file-row onDoubleClick={onGoParent}
          style={{ padding: '2px 8px', color: '#7aa2f7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#3b4261'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <span style={{ width: 16, textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="folder-open" size={14} color="#7aa2f7" /></span>
          <span style={{ flex: 1 }}>..</span>
          <span style={{ width: 55, flexShrink: 0 }} />
          <span style={{ width: 105, flexShrink: 0 }} />
        </div>
      )}
      {sortedFiles.map((f) => (
        <div key={f.path} data-file-row
          onDoubleClick={() => f.is_dir ? onNavigate(f.path) : onEdit(f.path, f.name)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, file: f }); }}
          style={{
            padding: '2px 8px', color: '#ccc', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#3b4261')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {f.is_dir ? <Icon name="folder" size={14} color="#7aa2f7" /> : f.is_link ? <Icon name="link" size={14} color="#e0af68" /> : <Icon name="file" size={14} color="#888" />}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          <span style={{ color: '#888', fontSize: 10, width: 55, textAlign: 'right', flexShrink: 0 }}>{!f.is_dir ? sizeFormat(f.size) : ''}</span>
          <span style={{ color: '#666', fontSize: 10, width: 105, textAlign: 'right', flexShrink: 0 }}>{timeFormat(f.mod_time)}</span>
        </div>
      ))}
      {showNewFolder && (
        <NewFolderInput
          value={newFolderName}
          onChange={setNewFolderName}
          onConfirm={handleMkdir}
          onCancel={() => { setShowNewFolder(false); setNewFolderName(''); }}
        />
      )}
      {renaming && (
        <NewFolderInput
          value={renaming.name}
          onChange={(v) => setRenaming({ ...renaming, name: v })}
          onConfirm={() => { onRename(renaming.path, renaming.name); setRenaming(null); }}
          onCancel={() => setRenaming(null)}
          confirmLabel={t("config_confirm")}
        />
      )}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}
          items={[
            ...(contextMenu.file.is_dir ? [{
              label: t('file_upload_to'),
              action: () => { uploadTargetRef.current = contextMenu.file.path; fileInputRef.current?.click(); setContextMenu(null); },
            }] : [{
              label: t('file_download'),
              action: () => { handleDownload(contextMenu.file.path, contextMenu.file.name); setContextMenu(null); },
            }, {
              label: t('file_edit'),
              action: () => { onEdit(contextMenu.file.path, contextMenu.file.name); setContextMenu(null); },
            }]),
            { label: t('file_rename'),
              action: () => {
                setRenaming({ path: contextMenu.file.path, name: contextMenu.file.name });
                setContextMenu(null);
              },
            },
            { label: t('menu_delete'),
              action: () => { onDelete(contextMenu.file.path); setContextMenu(null); },
            },
            { label: t('sftp_refresh'),
              action: () => { onNavigate(currentPath); setContextMenu(null); },
            },
          ]}
        />
      )}
      {blankMenu && (
        <ContextMenu x={blankMenu.x} y={blankMenu.y} onClose={() => setBlankMenu(null)}
          items={[
            { label: t('sftp_new_folder'),
              action: () => { setShowNewFolder(true); setBlankMenu(null); },
            },
            { label: t('sftp_upload'),
              action: () => { fileInputRef.current?.click(); setBlankMenu(null); },
            },
            { label: followCd ? t('sftp_fixed') : t('sftp_follow'),
              action: () => { onToggleFollow?.(); setBlankMenu(null); },
            },
            { label: t('sftp_refresh'),
              action: () => { onNavigate(currentPath); setBlankMenu(null); },
            },
          ]}
        />
      )}
      {(uploadError || downloadError) && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8,
          background: '#d32f2f', color: '#fff', padding: '6px 12px',
          borderRadius: 4, fontSize: 11, zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{uploadError || downloadError}</span>
          <span onClick={() => { setUploadError(null); setDownloadError(null); }} style={{ cursor: 'pointer', marginLeft: 8, display: 'flex', alignItems: 'center' }}><Icon name="x" size={12} /></span>
        </div>
      )}
    </div>
  );
}
