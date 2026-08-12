import { useState } from 'react';
import SftpPanel from './SftpPanel';
import CustomSelect from '../common/CustomSelect';
import Icon from '../common/Icon';
import { t } from '../../i18n';

interface Props {
  connections: Array<{ id: number; name: string }>;
}

export default function DualPaneSftp({ connections }: Props) {
  const [leftConnId, setLeftConnId] = useState<number | null>(connections[0]?.id || null);
  const [rightConnId, setRightConnId] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Left pane: Remote */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          padding: 4, background: '#1a3a1a', display: 'flex', gap: 4, alignItems: 'center', fontSize: 13, flexShrink: 0,
        }}>
          <span style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="monitor" size={12} /> {t('sftp_remote')}</span>
          <CustomSelect value={String(leftConnId || '')} onChange={(v) => setLeftConnId(Number(v) || null)}
            style={{ background: '#2d2d2d', color: '#ccc', border: '1px solid #3b4261', borderRadius: 3, fontSize: 13, padding: '2px 4px' }}>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </CustomSelect>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {leftConnId ? <SftpPanel connId={leftConnId} /> : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 14 }}>
              选择一个远程连接
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: '#3b4261', flexShrink: 0 }} />

      {/* Right pane: Local (default) or another remote */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          padding: 4, background: '#1a1a3a', display: 'flex', gap: 4, alignItems: 'center', fontSize: 13, flexShrink: 0,
        }}>
          <span style={{ color: '#ccc' }}>
            {rightConnId === null ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="laptop" size={12} /> {t('sftp_local')}</span> : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="monitor" size={12} /> {t('sftp_remote')}</span>}
          </span>
          <CustomSelect value={rightConnId === null ? 'local' : String(rightConnId)}
            onChange={(v) => setRightConnId(v === 'local' ? null : Number(v))}
            style={{ background: '#2d2d2d', color: '#ccc', border: '1px solid #3b4261', borderRadius: 3, fontSize: 13, padding: '2px 4px' }}>
            <option value="local">本机</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </CustomSelect>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {rightConnId ? <SftpPanel connId={rightConnId} /> : <SftpPanel localMode />}
        </div>
      </div>
    </div>
  );
}
