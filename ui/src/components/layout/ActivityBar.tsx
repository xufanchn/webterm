import { useLayoutStore, ModuleType } from '../../store/layout';

const icons: { type: ModuleType; label: string; icon: string }[] = [
  { type: 'ssh', label: 'SSH', icon: '▣' },
  { type: 'sftp', label: 'SFTP', icon: '◧' },
  { type: 'database', label: '数据库', icon: '🗄' },
  { type: 'config', label: '配置', icon: '⚙' },
];

export default function ActivityBar() {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const setActiveModule = useLayoutStore((s) => s.setActiveModule);

  return (
    <div style={{
      width: 44, background: '#333', display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 8, gap: 4, flexShrink: 0,
    }}>
      {icons.map(({ type, label, icon }) => (
        <div key={type} title={label} onClick={() => setActiveModule(type)}
          style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, cursor: 'pointer',
            borderRadius: 4, color: activeModule === type ? '#fff' : '#999',
            background: activeModule === type ? '#007acc' : 'transparent',
            borderLeft: activeModule === type ? '2px solid #4fc3f7' : '2px solid transparent',
          }}>
          {icon}
        </div>
      ))}
    </div>
  );
}
