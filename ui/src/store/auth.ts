import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

function loadUser(): User | null {
  try {
    const saved = localStorage.getItem('wshell-user');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('wshell-user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('wshell-user');
    set({ user: null, token: null });
  },
}));
