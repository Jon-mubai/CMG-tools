import http from './http';
export const listUsers = () => http.get('/admin/users').then((r) => r.data);
export const createUser = (body: any) => http.post('/admin/users', body).then((r) => r.data);
export const updateUser = (id: string, body: any) => http.patch(`/admin/users/${id}`, body).then((r) => r.data);
export const resetPassword = (id: string) => http.post(`/admin/users/${id}/reset-password`, {}).then((r) => r.data);
export const disableUser = (id: string) => http.delete(`/admin/users/${id}`).then((r) => r.data);
export const listFeatures = () => http.get('/admin/features').then((r) => r.data);
