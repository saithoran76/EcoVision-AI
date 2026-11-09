const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
export function token() { return localStorage.getItem('ev_token') || ''; }
export async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(data.detail || 'Request failed');
  }
  return response.status === 204 ? null : response.json();
}
export { BASE };
