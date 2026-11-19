import http from './http';
export const listWeekly = (from?: string, to?: string) =>
  http.get('/machine/profit/weekly', { params: { from, to } }).then((r) => r.data);
export const createImport = (body: any) => http.post('/machine/import', body).then((r) => r.data);
