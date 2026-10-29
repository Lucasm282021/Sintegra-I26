const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  // La autenticación de consola sigue en el servicio propio ARBA. Los datos
  // fiscales consultan el backend compartido para que coincidan con TPV/Banco.
  if (path.startsWith('/auth/')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
