import { useState } from 'react';
import Modal from '../common/Modal';
import { presets } from '../../themes/presets';

interface Props {
  themeName: string;
  fontSize: number;
  onThemeChange: (name: string) => void;
  onFontSizeChange: (size: number) => void;
  onClose: () => void;
}

export default function SettingsPanel({ themeName, fontSize, onThemeChange, onFontSizeChange, onClose }: Props) {
  const [activeSection, setActiveSection] = useState<'appearance' | 'highlights'>('appearance');

  return (
    <Modal title="个人设置" onClose={onClose} width={500} height={400}>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: 120, background: '#252526', borderRight: '1px solid #383838', flexShrink: 0 }}>
          <div onClick={() => setActiveSection('appearance')} style={{
            padding: '8px 12px', cursor: 'pointer', color: activeSection === 'appearance' ? '#fff' : '#888',
            background: activeSection === 'appearance' ? '#37373d' : 'transparent', fontSize: 12,
          }}>外观</div>
          <div onClick={() => setActiveSection('highlights')} style={{
            padding: '8px 12px', cursor: 'pointer', color: activeSection === 'highlights' ? '#fff' : '#888',
            background: activeSection === 'highlights' ? '#37373d' : 'transparent', fontSize: 12,
          }}>关键字高亮</div>
        </div>
        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          {activeSection === 'appearance' && (
            <div>
              <h4 style={{ color: '#fff', fontSize: 14, marginBottom: 16 }}>终端外观</h4>

              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 6 }}>主题</label>
                <select value={themeName} onChange={(e) => onThemeChange(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555',
                    borderRadius: 4, color: '#fff', fontSize: 12,
                  }}>
                  {presets.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  字体大小: {fontSize}px
                </label>
                <input type="range" min="10" max="24" value={fontSize}
                  onChange={(e) => onFontSizeChange(Number(e.target.value))}
                  style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {activeSection === 'highlights' && (
            <div>
              <h4 style={{ color: '#fff', fontSize: 14, marginBottom: 16 }}>关键字高亮规则</h4>
              <div style={{ color: '#888', fontSize: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ color: '#f44747', fontWeight: 'bold', width: 60 }}>ERROR</span>
                    <span style={{ color: '#888' }}>红色 · 预设</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ color: '#cca700', fontWeight: 'bold', width: 60 }}>WARN</span>
                    <span style={{ color: '#888' }}>黄色 · 预设</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ color: '#6a9955', fontWeight: 'bold', width: 60 }}>INFO</span>
                    <span style={{ color: '#888' }}>绿色 · 预设</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ color: '#808080', fontWeight: 'bold', width: 60 }}>DEBUG</span>
                    <span style={{ color: '#888' }}>灰色 · 预设</span>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#2d2d2d', borderRadius: 4, fontSize: 11 }}>
                  自定义关键字规则（后续版本支持）
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
