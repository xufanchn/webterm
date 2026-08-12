import { t } from '../../i18n';
import React, { useState } from 'react';
import Modal from '../common/Modal';
import CustomSelect from '../common/CustomSelect';
import { presets } from '../../themes/presets';
import { usePreferencesStore, parseOnekey, formatOnekey } from '../../store/preferences';
import Icon from '../common/Icon';
import { colors, font } from '../../theme/tokens';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const themeName = usePreferencesStore((s) => s.themeName);
  const fontSize = usePreferencesStore((s) => s.fontSize);
  const setThemeName = usePreferencesStore((s) => s.setThemeName);
  const setFontSize = usePreferencesStore((s) => s.setFontSize);
  const onekeyPwd = usePreferencesStore((s) => s.onekeyPwd);
  const setOnekeyPwd = usePreferencesStore((s) => s.setOnekeyPwd);
  const highlightRules = usePreferencesStore((s) => s.highlightRules);
  const setHighlightRules = usePreferencesStore((s) => s.setHighlightRules);
  const uiScale = usePreferencesStore((s) => s.uiScale);
  const setUIScale = usePreferencesStore((s) => s.setUIScale);
  const [activeSection, setActiveSection] = useState<'appearance' | 'highlights' | 'connection'>('appearance');
  const [showIdx, setShowIdx] = useState(-1);

  const onekeyList = parseOnekey(onekeyPwd);
  const updateOnekeyItem = (i: number, k: string, u: string, p: string) => {
    const list = parseOnekey(onekeyPwd);
    if (i < list.length) list[i] = { k, u, v: p };
    else list.push({ k, u, v: p });
    setOnekeyPwd(formatOnekey(list));
  };
  const addOnekeyItem = () => {
    const list = parseOnekey(onekeyPwd);
    list.push({ k: '', u: '', v: '' });
    setOnekeyPwd(formatOnekey(list));
  };
  const removeOnekeyItem = (i: number) => {
    const list = parseOnekey(onekeyPwd);
    list.splice(i, 1);
    setOnekeyPwd(formatOnekey(list));
  };
  const updateRule = (i: number, rule: { keyword: string; color: string; regex: boolean }) => {
    const list = [...highlightRules];
    list[i] = rule;
    setHighlightRules(list);
  };
  const removeRule = (i: number) => {
    const list = [...highlightRules];
    list.splice(i, 1);
    setHighlightRules(list);
  };
  const addRule = () => {
    setHighlightRules([...highlightRules, { keyword: '', color: colors.danger, regex: false }]);
  };

  const cellStyle: React.CSSProperties = {
    flex: 2, padding: '5px 4px', background: 'transparent', border: 'none',
    color: colors.textLight, fontSize: font.md, width: '100%', boxSizing: 'border-box', outline: 'none',
  };

  const sections = [
    { key: 'appearance' as const, label: t('settings_appearance') },
    { key: 'highlights' as const, label: t('settings_highlights') },
    { key: 'connection' as const, label: t('settings_connection') },
  ];

  return (
    <Modal title={t("settings_title")} onClose={onClose} width={500} height={420}>
      <div style={{ padding: '0 24px', display: 'flex', borderBottom: '1px solid var(--c-border)', height: 36, alignItems: 'center' }}>
        {sections.map((s, idx) => (
          <React.Fragment key={s.key}>
            {idx > 0 && (
              <span style={{
                width: 1, height: 16, flexShrink: 0, alignSelf: 'center',
                background: (activeSection !== s.key && activeSection !== sections[idx-1].key) ? colors.border : 'transparent',
              }} />
            )}
            <div onClick={() => setActiveSection(s.key)} style={{
              padding: '4px 14px', cursor: 'pointer', fontSize: font.md, borderRadius: 5,
              color: activeSection === s.key ? colors.bg : colors.textMuted2,
              background: activeSection === s.key ? colors.accent : 'transparent',
              height: 28, display: 'flex', alignItems: 'center',
            }}>{s.label}</div>
          </React.Fragment>
        ))}
      </div>
      <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }}>
        {activeSection === 'appearance' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: colors.textMuted, fontSize: font.md, display: 'block', marginBottom: 6 }}>{t("settings_theme")}</label>
              <CustomSelect value={themeName} onChange={(v) => setThemeName(v)}
                style={{
                  width: '100%', padding: '8px 10px', background: 'rgba(31,35,53,0.5)', border: '1px solid var(--c-border)',
                  borderRadius: 4, color: colors.text, fontSize: font.xl,
                }}>
                {presets.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </CustomSelect>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: colors.textMuted, fontSize: font.md, display: 'block', marginBottom: 6 }}>
                {t("settings_font")}: {fontSize}px
              </label>
              <input type="range" min="10" max="24" value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.accent }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: colors.textMuted, fontSize: font.sm, display: 'block', marginBottom: 6 }}>
                {t("settings_ui_scale")}: {Math.round(uiScale * 100)}%
              </label>
              <input type="range" min="0.85" max="1.3" step="0.05" value={uiScale}
                onChange={(e) => setUIScale(Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.accent }} />
            </div>
          </div>
        )}

        {activeSection === 'highlights' && (
          <div>
            {highlightRules.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--c-border)' }}>
                <input value={r.keyword} onChange={(e) => updateRule(i, { ...r, keyword: e.target.value })}
                  placeholder="INFO" style={{ background: 'rgba(31,35,53,0.5)', border: '1px solid var(--c-border)', borderRadius: 4, color: colors.text, padding: '3px 6px', width: 100, fontSize: font.md }} />
                <input type="color" value={r.color} onChange={(e) => updateRule(i, { ...r, color: e.target.value })}
                  style={{ width: 32, height: 24, background: 'transparent', border: 'none', cursor: 'pointer' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: colors.textMuted, fontSize: font.sm, cursor: 'pointer' }}>
                  <input type="checkbox" checked={r.regex} onChange={(e) => updateRule(i, { ...r, regex: e.target.checked })} />
                  regex
                </label>
                <span onClick={() => removeRule(i)} style={{ cursor: 'pointer', color: colors.danger, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}><Icon name="x" size={14} /></span>
              </div>
            ))}
            <button onClick={addRule} style={{ marginTop: 8, padding: '6px 16px', background: colors.accent, border: 'none', borderRadius: 4, color: colors.bg, cursor: 'pointer', fontSize: font.md, fontWeight: 600 }}>
              {t("settings_add")}
            </button>
          </div>
        )}

        {activeSection === 'connection' && (
          <div>
            <div style={{ display: 'flex', color: colors.textMuted, fontSize: font.xs, padding: '4px 0', borderBottom: '1px solid var(--c-border)', marginBottom: 2 }}>
              <span style={{ flex: 2 }}>{t("settings_onekey_key")}</span><span style={{ flex: 2 }}>{t("settings_onekey_user")}</span><span style={{ flex: 2 }}>{t("settings_onekey_pwd")}</span><span style={{ width: 20 }} />
            </div>
            {onekeyList.map((kv, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', borderBottom: '1px solid var(--c-border)', padding: '3px 0' }}>
                <input value={kv.k} onChange={(e) => updateOnekeyItem(i, e.target.value, kv.u, kv.v)}
                  placeholder="key" style={cellStyle} />
                <input value={kv.u} onChange={(e) => updateOnekeyItem(i, kv.k, e.target.value, kv.v)}
                  placeholder="user" style={cellStyle} />
                <div style={{ flex: 2, position: 'relative' }}>
                  <input type={showIdx === i ? 'text' : 'password'} value={kv.v} onChange={(e) => updateOnekeyItem(i, kv.k, kv.u, e.target.value)}
                    style={{ ...cellStyle, paddingRight: 24 }} />
                  <span onClick={() => setShowIdx(showIdx === i ? -1 : i)}
                    style={{ position: 'absolute', right: 4, top: 5, cursor: 'pointer', color: colors.textMuted, userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                    {showIdx === i ? <Icon name="eye-off" size={12} /> : <Icon name="eye" size={12} />}
                  </span>
                </div>
                <span onClick={() => removeOnekeyItem(i)}
                  style={{ cursor: 'pointer', color: colors.danger, width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={14} /></span>
              </div>
            ))}
            <button onClick={addOnekeyItem}
              style={{ marginTop: 8, padding: '6px 16px', background: colors.accent, border: 'none', borderRadius: 4, color: colors.bg, cursor: 'pointer', fontSize: font.md, fontWeight: 600 }}>
              {t("settings_add")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
