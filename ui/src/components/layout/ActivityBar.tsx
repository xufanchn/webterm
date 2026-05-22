import { useLayoutStore } from '../../store/layout';
import type { ModuleType } from '../../store/layout';

const icons: { type: ModuleType; label: string; icon: string }[] = [
  { type: 'ssh', label: 'SSH', icon: '▣' },
  { type: 'sftp', label: 'SFTP', icon: '◧' },
  { type: 'database', label: '数据库', icon: '🗄' },
  { type: 'config', label: '配置管理', icon: '☰' },
];

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: 32, height: 32, display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: 16, cursor: 'pointer',
  borderRadius: 4, color: active ? '#fff' : '#999',
  background: active ? '#007acc' : 'transparent',
  borderLeft: active ? '2px solid #4fc3f7' : '2px solid transparent',
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
      width: 44, background: '#333', display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 4, gap: 4, flexShrink: 0,
    }}>
      <div title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'} onClick={onToggleSidebar}
        style={{ ...btnStyle(false), fontSize: 10 }}>
        {sidebarCollapsed ? '▶' : '◀'}
      </div>
      {icons.map(({ type, label, icon }) => (
        <div key={type} title={label} onClick={() => setActiveModule(type)}
          style={btnStyle(activeModule === type)}>
          {icon}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div title="个人设置" onClick={onOpenSettings}
        style={{ ...btnStyle(false), marginBottom: 8, flexShrink: 0 }}>
        ⚙
      </div>
    </div>
  );
}
