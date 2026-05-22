import { create } from 'zustand';

export type ModuleType = 'ssh' | 'sftp' | 'database' | 'config';
export type BroadcastScope = 'off' | 'pane' | 'all';

export interface Tab {
  id: string;
  type: ModuleType;
  title: string;
  connId?: number;
}

interface LayoutState {
  activeModule: ModuleType;
  newTabQueue: Tab[];
  sftpCdPath: string | null;
  focusedPaneId: string | null;
  broadcastScope: BroadcastScope;
  broadcastSourceId: string | null;
  terminalRegistry: string[];
  registeredTabs: string[];
  removedTabQueue: string[];
  setActiveModule: (m: ModuleType) => void;
  requestTab: (tab: Tab) => void;
  drainTabQueue: () => Tab[];
  drainRemovedTabs: () => string[];
  notifyTabMoved: (tabId: string) => void;
  setSftpCdPath: (path: string | null) => void;
  setFocusedPane: (paneId: string | null) => void;
  setBroadcastScope: (scope: BroadcastScope) => void;
  setBroadcastSource: (id: string | null) => void;
  registerTerminal: (tabId: string) => void;
  unregisterTerminal: (tabId: string) => void;
  sftpDisconnectSignal: number;
  signalSftpDisconnect: () => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
      activeModule: 'ssh',
      newTabQueue: [],
      sftpCdPath: null,
      focusedPaneId: 'root',
      broadcastScope: 'off',
      broadcastSourceId: null,
      terminalRegistry: [],
      registeredTabs: [],
      removedTabQueue: [],
      sftpDisconnectSignal: 0,
      signalSftpDisconnect: () => set((s) => ({ sftpDisconnectSignal: s.sftpDisconnectSignal + 1 })),
      setActiveModule: (m) => set({ activeModule: m }),
      requestTab: (tab) => set((s) => ({ newTabQueue: [...s.newTabQueue, tab] })),
      drainTabQueue: () => {
        const queue = get().newTabQueue;
        if (queue.length > 0) set({ newTabQueue: [] });
        return queue;
      },
      drainRemovedTabs: () => {
        const queue = get().removedTabQueue;
        if (queue.length > 0) set({ removedTabQueue: [] });
        return queue;
      },
      notifyTabMoved: (tabId) => set((s) => ({ removedTabQueue: [...s.removedTabQueue, tabId] })),
      setFocusedPane: (paneId) => set({ focusedPaneId: paneId }),
      setSftpCdPath: (path) => set({ sftpCdPath: path }),
      setBroadcastScope: (scope) => set({ broadcastScope: scope, broadcastSourceId: scope !== 'off' ? get().broadcastSourceId : null }),
      setBroadcastSource: (id) => set({ broadcastSourceId: id }),
      registerTerminal: (tabId) => set((s) => {
        if (s.terminalRegistry.includes(tabId)) return s;
        return { terminalRegistry: [...s.terminalRegistry, tabId] };
      }),
      unregisterTerminal: (tabId) => set((s) => ({
        terminalRegistry: s.terminalRegistry.filter((id) => id !== tabId),
      })),
}));
