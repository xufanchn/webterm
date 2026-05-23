import { t } from '../../i18n';
import { useLayoutStore } from '../../store/layout';
import type { ModuleType } from '../../store/layout';
import Icon from '../common/Icon';

const modules: { type: ModuleType; label: string; icon: string }[] = [
  { type: 'ssh', label: 'SSH', icon: 'terminal' },
  { type: 'sftp', label: 'SFTP', icon: 'folder-open' },
  { type: 'database', label: t('activity_database'), icon: 'database' },
  { type: 'config', label: t('activity_config'), icon: 'sliders-horizontal' },
];

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: 32, height: 32, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer',
  borderRadius: 4, color: active ? '#1a1b26' : '#565f89',
  background: active ? '#7aa2f7' : 'transparent',
  borderLeft: active ? '2px solid #1a1b26' : '2px solid transparent',
});

export default function ActivityBar({ onOpenSettings, sidebarCollapsed, onToggleSidebar }: {
  onOpenSettings: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const setActiveModule = useLayoutStore((s) => s.setActiveModule);

  return (
    <div style={{
      width: 44, background: '#1a1b26', display: 'flex', flexDirection: 'column', borderRight: '1px solid #3b4261',
      alignItems: 'center', paddingTop: 4, gap: 4, flexShrink: 0,
    }}>
      <div className="activity-btn" title={sidebarCollapsed ? t('sidebar_expand') : t('sidebar_collapse')} onClick={onToggleSidebar}
        style={btnStyle(false)}>
        {sidebarCollapsed ? <Icon name="panel-left-open" size={14} /> : <Icon name="panel-left-close" size={14} />}
      </div>
      {modules.map(({ type, label, icon }) => (
        <div key={type} className="activity-btn" title={label} onClick={() => setActiveModule(type)}
          style={btnStyle(activeModule === type)}>
          <Icon name={icon} size={16} />
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div className="activity-btn" title="个人设置" onClick={onOpenSettings}
        style={{ ...btnStyle(false), marginBottom: 8, flexShrink: 0 }}>
        <Icon name="settings" size={16} />
      </div>
    </div>
  );
}
