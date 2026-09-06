import { t } from '../../i18n';
import { useLayoutStore } from '../../store/layout';
import { useAuthStore } from '../../store/auth';
import type { ModuleType } from '../../store/layout';
import Icon from '../common/Icon';
import { colors, radius, transition } from '../../theme/tokens';

const modules: { type: ModuleType; label: string; icon: string }[] = [
  { type: 'ssh', label: 'SSH', icon: 'terminal' },
  { type: 'sftp', label: 'SFTP', icon: 'folder-open' },
  { type: 'config', label: t('activity_config'), icon: 'sliders-horizontal' },
];

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: 32, height: 32, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer',
  borderRadius: radius.sm,
  color: active ? colors.accent : colors.textMuted,
  background: active ? colors.accentSoft : 'transparent',
  borderLeft: active ? `2px solid ${colors.accent}` : '2px solid transparent',
  transition: `background ${transition.fast}, color ${transition.fast}`,
});

export default function ActivityBar({ onOpenSettings, sidebarCollapsed, onToggleSidebar }: {
  onOpenSettings: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const setActiveModule = useLayoutStore((s) => s.setActiveModule);
  const token = useAuthStore((s) => s.token);

  return (
    <div style={{
      width: 44, background: colors.bg, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--c-border)',
      alignItems: 'center', paddingTop: 4, gap: 4, flexShrink: 0,
    }}>
      <div className="activity-btn" title={sidebarCollapsed ? t('sidebar_expand') : t('sidebar_collapse')} onClick={() => { if (token) onToggleSidebar(); }}
        style={btnStyle(false)}>
        {sidebarCollapsed ? <Icon name="panel-left-open" size={14} /> : <Icon name="panel-left-close" size={14} />}
      </div>
      {modules.map(({ type, label, icon }) => (
        <div key={type} className="activity-btn" title={label} onClick={() => { if (token) setActiveModule(type); }}
          style={btnStyle(activeModule === type)}>
          <Icon name={icon} size={16} />
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div className="activity-btn" title="个人设置" onClick={() => { if (token) onOpenSettings(); }}
        style={{ ...btnStyle(false), marginBottom: 8, flexShrink: 0 }}>
        <Icon name="settings" size={16} />
      </div>
    </div>
  );
}
