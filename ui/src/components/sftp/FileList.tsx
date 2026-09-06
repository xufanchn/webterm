import { useCallback, useEffect, useRef, useState } from 'react';
import type { SftpFile } from './SftpPanel';
import { t } from '../../i18n';
import ContextMenu from '../common/ContextMenu';
import Icon from '../common/Icon';
import { colors, font, radius } from '../../theme/tokens';
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
  onChmod: (path: string, mode: string) => void;
  onGoParent?: () => void;
  onToggleFollow?: () => void;
  followCd?: boolean;
  uploadTick?: number;
  newFolderTick?: number;
}

const sizeFormat = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
};

const timeFormat = (ts: string): string => {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type SortKey = 'name' | 'size' | 'time';
type SortDir = 'asc' | 'desc';

function InlineNameInput({ value, onChange, onConfirm, onCancel, confirmLabel = t('config_create') }: {
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
        autoFocus placeholder={t('file_folder_name')}
        style={{ flex: 1, padding: '3px 8px', background: colors.bgInput, border: '1px solid var(--c-border)', borderRadius: radius.sm, color: colors.text, fontSize: font.xs }} />
      <button onClick={onConfirm}
        style={{ background: colors.accent, border: 'none', color: colors.bg, fontWeight: 600, borderRadius: radius.sm, padding: '2px 10px', cursor: 'pointer', fontSize: font.xs }}>{confirmLabel}</button>
      <button onClick={onCancel}
        style={{ background: colors.bgInputAlt, border: 'none', color: colors.textLight, borderRadius: radius.sm, padding: '2px 10px', cursor: 'pointer', fontSize: font.xs }}>{t('conn_cancel')}</button>
    </div>
  );
}

export default function FileList({ files, loading, connId, currentPath, onNavigate, onDelete, onRename, onMkdir, onUpload, onEdit, onChmod, onGoParent, onToggleFollow, followCd, uploadTick, newFolderTick }: Props) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; file: SftpFile} | null>(null);
  const [blankMenu, setBlankMenu] = useState<{x: number; y: number} | null>(null);
  const [renaming, setRenaming] = useState<{path: string; name: string} | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<number>(-1); // row index for shift-range selection
  const [lastListKey, setLastListKey] = useState('');
  const listKey = `${currentPath}#${files.length}`;
  if (lastListKey !== listKey) {
    // Derived-state reset (React render-time pattern): directory listing changed
    setLastListKey(listKey);
    setSelected(new Set());
  }

  // Toolbar signals from SftpPanel (skip initial mount)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstSignalRef = useRef(true);
  useEffect(() => {
    if (firstSignalRef.current) { firstSignalRef.current = false; return; }
    fileInputRef.current?.click();
  }, [uploadTick]);
  const firstFolderRef = useRef(true);
  useEffect(() => {
    if (firstFolderRef.current) { firstFolderRef.current = false; return; }
    setShowNewFolder(true);
  }, [newFolderTick]);

  const sortedFiles = [...files].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'size') cmp = a.size - b.size;
    else if (sortKey === 'time') cmp = a.mod_time.localeCompare(b.mod_time);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleMkdir = () => {
    if (newFolderName.trim()) {
      onMkdir(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const selectRow = (index: number, e: React.MouseEvent) => {
    const f = sortedFiles[index];
    if (!f) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) {
        if (next.has(f.path)) next.delete(f.path); else next.add(f.path);
        anchorRef.current = index;
      } else if (e.shiftKey && anchorRef.current >= 0) {
        const [lo, hi] = [Math.min(anchorRef.current, index), Math.max(anchorRef.current, index)];
        next.clear();
        for (let i = lo; i <= hi; i++) next.add(sortedFiles[i].path);
      } else {
        next.clear();
        next.add(f.path);
        anchorRef.current = index;
      }
      return next;
    });
  };

  const selectedFiles = sortedFiles.filter((f) => selected.has(f.path));
  const selectedSize = selectedFiles.reduce((s, f) => s + (f.is_dir ? 0 : f.size), 0);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const uploadTargetRef = useRef<string | null>(null);

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
          let errMsg = `${t('file_upload_failed')} (${xhr.status})`;
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

  const batchDelete = () => {
    for (const f of selectedFiles) onDelete(f.path);
    setSelected(new Set());
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? <Icon name="arrow-up" size={10} /> : <Icon name="arrow-down" size={10} />) : null;

  const thStyle = { cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const, display: 'flex', alignItems: 'center', gap: 3 };

  const rowStyle = (isSelected: boolean): React.CSSProperties => ({
    margin: '0 4px', padding: '3px 6px', borderRadius: radius.sm,
    color: isSelected ? colors.accent : colors.textLight, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    background: isSelected ? colors.accentSoft : 'transparent',
  });

  return (
    <div tabIndex={0} style={{ flex: 1, overflow: 'auto', outline: 'none',
      ...(dragOver ? { outline: '2px dashed var(--c-accent)', outlineOffset: -2 } : {}) }}
      onKeyDown={(e) => {
        if (e.key === 'Delete' && selectedFiles.length > 0) batchDelete();
        if (e.key === 'Backspace') onGoParent?.();
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { setDragOver(false); handleDrop(e); }}
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('[data-file-row]')) setSelected(new Set()); }}
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
      {/* Column headers */}
      <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '4px 12px', background: colors.bg, borderBottom: '1px solid var(--c-border-soft)', display: 'flex', alignItems: 'center', gap: 6, color: colors.textMuted, fontSize: font.xs, flexShrink: 0 }}>
        <span style={{ width: 18, flexShrink: 0 }} />
        <span onClick={() => toggleSort('name')} style={{ ...thStyle, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('file_name')}{sortArrow('name')}</span>
        <span onClick={() => toggleSort('size')} style={{ ...thStyle, width: 60, justifyContent: 'flex-end' }}>{t('file_size')}{sortArrow('size')}</span>
        <span onClick={() => toggleSort('time')} style={{ ...thStyle, width: 110, justifyContent: 'flex-end' }}>{t('file_time')}{sortArrow('time')}</span>
      </div>
      {loading && <div style={{ padding: 10, color: colors.textDim }}>{t('file_loading')}</div>}
      {!loading && !loading && sortedFiles.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: colors.textFaint, fontSize: font.md }}>{t('file_empty')}</div>
      )}
      {!loading && currentPath !== '/' && (
        <div data-file-row onDoubleClick={onGoParent} onClick={() => setSelected(new Set())}
          style={{ ...rowStyle(false) }}
          onMouseEnter={(e) => { if (!e.currentTarget.dataset.hl) e.currentTarget.style.background = colors.bgHover; }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ width: 18, textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="corner-left-up" size={14} color={colors.accent} /></span>
          <span style={{ flex: 1 }}>..</span>
          <span style={{ width: 60, flexShrink: 0 }} />
          <span style={{ width: 110, flexShrink: 0 }} />
        </div>
      )}
      {sortedFiles.map((f, i) => {
        const isSelected = selected.has(f.path);
        return (
          <div key={f.path} data-file-row
            onClick={(e) => selectRow(i, e)}
            onDoubleClick={() => f.is_dir ? onNavigate(f.path) : onEdit(f.path, f.name)}
            onContextMenu={(e) => { e.preventDefault(); if (!selected.has(f.path)) selectRow(i, e); setContextMenu({ x: e.clientX, y: e.clientY, file: f }); }}
            style={rowStyle(isSelected)}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = colors.bgHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? colors.accentSoft : 'transparent'; }}
            title={f.is_link && f.link_to ? `${f.name} → ${f.link_to}` : undefined}>
            <span style={{ width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {f.is_dir ? <Icon name="folder" size={15} color={colors.accent} /> : f.is_link ? <Icon name="link" size={14} color={colors.warning} /> : <Icon name="file" size={14} color={colors.textMuted} />}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}{f.is_dir && '/'}</span>
            <span style={{ color: colors.textMuted2, fontSize: font.xs, width: 60, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>{!f.is_dir ? sizeFormat(f.size) : ''}</span>
            <span style={{ color: colors.textFaint, fontSize: font.xs, width: 110, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeFormat(f.mod_time)}</span>
          </div>
        );
      })}
      {showNewFolder && (
        <InlineNameInput
          value={newFolderName}
          onChange={setNewFolderName}
          onConfirm={handleMkdir}
          onCancel={() => { setShowNewFolder(false); setNewFolderName(''); }}
        />
      )}
      {renaming && (
        <InlineNameInput
          value={renaming.name}
          onChange={(v) => setRenaming({ ...renaming, name: v })}
          onConfirm={() => { onRename(renaming.path, renaming.name); setRenaming(null); }}
          onCancel={() => setRenaming(null)}
          confirmLabel={t('config_confirm')}
        />
      )}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}
          items={[
            ...(selectedFiles.length > 1 ? [
              { label: `${t('menu_delete')} (${selectedFiles.length})`, action: () => { batchDelete(); setContextMenu(null); } },
            ] : [
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
              { label: t('file_chmod'),
                action: () => {
                  const mode = window.prompt(`${t('file_chmod_prompt')} (${contextMenu.file.name})`, contextMenu.file.is_dir ? '755' : '644');
                  if (mode) onChmod(contextMenu.file.path, mode.trim());
                  setContextMenu(null);
                },
              },
              { label: t('file_rename'),
                action: () => {
                  setRenaming({ path: contextMenu.file.path, name: contextMenu.file.name });
                  setContextMenu(null);
                },
              },
              { label: t('menu_delete'),
                action: () => { onDelete(contextMenu.file.path); setContextMenu(null); },
              },
            ]),
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
      {/* Status bar */}
      <div style={{
        position: 'sticky', bottom: 0, margin: '4px 0 0', padding: '4px 12px', flexShrink: 0,
        background: colors.bgBar, borderTop: '1px solid var(--c-border-soft)',
        display: 'flex', alignItems: 'center', gap: 10, color: colors.textMuted2, fontSize: font.xs,
      }}>
        <span>{sortedFiles.length} {t('sftp_items')}</span>
        {selectedFiles.length > 0 && (
          <span style={{ color: colors.accent }}>
            {t('multi_selected')} {selectedFiles.length}{selectedSize > 0 ? ` · ${sizeFormat(selectedSize)}` : ''}
          </span>
        )}
        {uploading && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, color: colors.accent }}>
            <span style={{ flex: 1, height: 3, background: colors.bgInputAlt, borderRadius: 2, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${uploadProgress}%`, background: colors.accent, transition: 'width 0.15s' }} />
            </span>
            {t('sftp_uploading')} {uploadProgress}%
          </span>
        )}
      </div>
      {(uploadError || downloadError) && (
        <div style={{
          position: 'absolute', bottom: 28, left: 8, right: 8,
          background: colors.dangerBg, color: colors.white, padding: '6px 12px',
          borderRadius: radius.sm, fontSize: font.sm, zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{uploadError || downloadError}</span>
          <span onClick={() => { setUploadError(null); setDownloadError(null); }} style={{ cursor: 'pointer', marginLeft: 8, display: 'flex', alignItems: 'center' }}><Icon name="x" size={12} /></span>
        </div>
      )}
    </div>
  );
}
