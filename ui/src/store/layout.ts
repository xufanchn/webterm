import { create } from 'zustand';

export type ModuleType = 'ssh' | 'sftp' | 'database' | 'config';

export interface Tab {
  id: string;
  type: ModuleType;
  title: string;
  connId?: number;
}

interface LayoutState {
  activeModule: ModuleType;
  tabs: Tab[];
  activeTabId: string | null;
  setActiveModule: (m: ModuleType) => void;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeModule: 'ssh',
  tabs: [],
  activeTabId: null,
  setActiveModule: (m) => set({ activeModule: m }),
  openTab: (tab) => set((s) => {
    const exists = s.tabs.find((t) => t.id === tab.id);
    if (exists) return { activeTabId: tab.id };
    return { tabs: [...s.tabs, tab], activeTabId: tab.id };
  }),
  closeTab: (id) => set((s) => {
    const tabs = s.tabs.filter((t) => t.id !== id);
    let activeTabId = s.activeTabId;
    if (activeTabId === id) {
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    }
    return { tabs, activeTabId };
  }),
  setActiveTab: (id) => set({ activeTabId: id }),
}));
