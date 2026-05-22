const BASE = '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch(`${BASE}${path}`, { ...options, headers });
  if (resp.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return resp;
}

export async function apiGet(path: string) {
  const resp = await apiFetch(path);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function apiPost(path: string, body: unknown) {
  const resp = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function apiPut(path: string, body: unknown) {
  const resp = await apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function apiDelete(path: string) {
  const resp = await apiFetch(path, { method: 'DELETE' });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}
