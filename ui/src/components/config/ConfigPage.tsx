import { useState } from 'react';
import UserManager from './UserManager';

const tabs = [
  { key: 'users', label: '用户管理' },
  { key: 'ssh', label: 'SSH 连接' },
  { key: 'database', label: '数据库连接' },
  { key: 'groups', label: '分组管理' },
];

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', background: '#252526', borderBottom: '1px solid #383838', flexShrink: 0 }}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 20px',
              cursor: 'pointer',
              fontSize: 13,
              color: activeTab === tab.key ? '#fff' : '#999',
              borderBottom: activeTab === tab.key ? '2px solid #007acc' : '2px solid transparent',
              background: activeTab === tab.key ? '#1e1e1e' : 'transparent',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'users' && <UserManager />}
        {activeTab !== 'users' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#888',
              fontSize: 13,
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 40 }}>🔧</div>
            <div>
              {activeTab === 'ssh'
                ? 'SSH 连接管理'
                : activeTab === 'database'
                  ? '数据库连接管理'
                  : '分组管理'}
            </div>
            <div style={{ fontSize: 11 }}>请在左侧面板中管理连接和分组</div>
            <div style={{ fontSize: 11, color: '#666' }}>
              {activeTab === 'ssh' && '入口：左侧图标栏 → SSH → 右键连接 → 编辑/删除'}
              {activeTab === 'database' && '入口：左侧图标栏 → 数据库 → 右键连接 → 编辑/删除'}
              {activeTab === 'groups' && '入口：左侧面板底部 → 新建分组'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
