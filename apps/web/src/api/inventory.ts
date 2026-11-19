import http from './http';
export const listDocs = (page = 1) => http.get('/inventory/docs', { params: { page } }).then((r) => r.data);
export const createDoc = (body: any) => http.post('/inventory/docs', body).then((r) => r.data);
export const deleteDoc = (id: string) => http.delete(`/inventory/docs/${id}`).then((r) => r.data);
