import http from './http';
export function login(username: string, password: string) {
  return http.post('/auth/login', { username, password }).then((r) => r.data);
}
export function fetchMe() {
  return http.get('/me').then((r) => r.data);
}
export function changePassword(oldPassword: string, newPassword: string) {
  return http.post('/auth/change-password', { oldPassword, newPassword }).then((r) => r.data);
}
