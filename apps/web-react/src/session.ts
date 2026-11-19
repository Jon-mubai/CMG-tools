/** 会话仅存登录态，不存业务数据 */
const KEY = 'cmg_react_session';

export type Session = {
  token: string;
  username: string;
  displayName: string;
  source: 'api' | 'demo';
};

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || !s.username) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
