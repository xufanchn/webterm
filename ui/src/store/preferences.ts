import { create } from 'zustand';

export interface OneKeyEntry { k: string; u: string; v: string; }

function parseOnekey(raw: string): OneKeyEntry[] {
  try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch {}
  // Legacy format: key=username:password per line
  return raw.split('\n').filter(Boolean).map((line) => {
    const eq = line.indexOf('=');
    const k = eq >= 0 ? line.substring(0, eq).trim() : '';
    const v = eq >= 0 ? line.substring(eq + 1).trim() : line.trim();
    const colon = v.indexOf(':');
    return { k, u: colon >= 0 ? v.substring(0, colon).trim() : '', v: colon >= 0 ? v.substring(colon + 1).trim() : v };
  });
}

function formatOnekey(list: OneKeyEntry[]): string {
  return JSON.stringify(list);
}

interface PreferencesState {
  themeName: string;
  fontSize: number;
  onekeyPwd: string;
  setThemeName: (name: string) => void;
  setFontSize: (size: number) => void;
  setOnekeyPwd: (pwd: string) => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  themeName: localStorage.getItem('webterm-theme') || 'Dracula',
  fontSize: Number(localStorage.getItem('webterm-fontSize')) || 16,
  onekeyPwd: localStorage.getItem('webterm-onekey') || '[]',
  setThemeName: (name) => {
    localStorage.setItem('webterm-theme', name);
    set({ themeName: name });
  },
  setFontSize: (size) => {
    localStorage.setItem('webterm-fontSize', String(size));
    set({ fontSize: size });
  },
  setOnekeyPwd: (pwd) => {
    localStorage.setItem('webterm-onekey', pwd);
    set({ onekeyPwd: pwd });
  },
}));

export { parseOnekey, formatOnekey };
