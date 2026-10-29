async function request(url, options = {}) {
  const token = localStorage.getItem('arba_session_token');
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { status: response.status, data };
}

const base = '/api/v1/arba/auth';

export const authApi = {
  getSetupStatus: () => request(`${base}/setup-status`),
  bootstrap: (body) => request(`${base}/bootstrap`, { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request(`${base}/login`, { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request(`${base}/me`),
  getUsers: () => request(`${base}/users`),
  createUser: (body) => request(`${base}/users`, { method: 'POST', body: JSON.stringify(body) }),
};
