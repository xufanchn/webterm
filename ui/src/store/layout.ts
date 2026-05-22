import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  broadcastMode: boolean;
  broadcastSourceId: string | null;
  broadcastTargetIds: string[];
  setActiveModule: (m: ModuleType) => void;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setBroadcastMode: (on: boolean) => void;
  setBroadcastSource: (id: string | null) => void;
  addBroadcastTarget: (id: string) => void;
  removeBroadcastTarget: (id: string) => void;
  clearBroadcastTargets: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      activeModule: 'ssh',
      tabs: [],
      activeTabId: null,
      broadcastMode: false,
      broadcastSourceId: null,
      broadcastTargetIds: [],
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
      setBroadcastMode: (on) => set((s) => ({ broadcastMode: on, broadcastTargetIds: on ? s.broadcastTargetIds : [] })),
      setBroadcastSource: (id) => set({ broadcastSourceId: id }),
      addBroadcastTarget: (id) => set((s) => ({ broadcastTargetIds: [...s.broadcastTargetIds, id] })),
      removeBroadcastTarget: (id) => set((s) => ({ broadcastTargetIds: s.broadcastTargetIds.filter(t => t !== id) })),
      clearBroadcastTargets: () => set({ broadcastTargetIds: [] }),
    }),
    {
      name: 'wshell-layout',
      partialize: (state) => ({
        activeModule: state.activeModule,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);
