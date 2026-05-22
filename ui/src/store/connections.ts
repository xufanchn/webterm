import { create } from 'zustand';
import { apiGet } from '../api/client';

export interface DbConnection {
  id: number;
  group_id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  database_name: string;
  engine: string;
  shared: boolean;
}

export interface Connection {
  id: number;
  group_id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: string;
  shared: boolean;
}

export interface Group {
  id: number;
  name: string;
  type: string;
  parent_id: number;
  sort_order: number;
}

interface ConnectionState {
  connections: Connection[];
  groups: Group[];
  loading: boolean;
  dbConnections: DbConnection[];
  fetchConnections: (groupId?: number) => Promise<void>;
  fetchDbConnections: () => Promise<void>;
  fetchGroups: (type: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  groups: [],
  loading: false,
  dbConnections: [],
  fetchConnections: async (groupId) => {
    set({ loading: true });
    const qs = groupId ? `?group_id=${groupId}` : '';
    const data = await apiGet(`/api/connections${qs}`);
    set({ connections: data, loading: false });
  },
  fetchDbConnections: async () => {
    try {
      const data = await apiGet('/api/db_connections');
      set({ dbConnections: data });
    } catch {
      set({ dbConnections: [] });
    }
  },
  fetchGroups: async (type) => {
    const data = await apiGet(`/api/groups?type=${type}`);
    set({ groups: data });
  },
}));
