import { create } from 'zustand';

interface PreferencesState {
  themeName: string;
  fontSize: number;
  setThemeName: (name: string) => void;
  setFontSize: (size: number) => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  themeName: localStorage.getItem('wshell-theme') || 'Dracula',
  fontSize: Number(localStorage.getItem('wshell-fontSize')) || 14,
  setThemeName: (name) => {
    localStorage.setItem('wshell-theme', name);
    set({ themeName: name });
  },
  setFontSize: (size) => {
    localStorage.setItem('wshell-fontSize', String(size));
    set({ fontSize: size });
  },
}));
