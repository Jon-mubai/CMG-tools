/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 * 所属：backend/services — 盘点会话聚合
 */
'use strict';

const sessions = [];

function list() {
  return { items: sessions.slice().reverse() };
}

function save(payload) {
  payload = payload || {};
  const id = 'st_' + Date.now().toString(36);
  const row = {
    id: id,
    title: String(payload.title || '盘点记录'),
    status: 'closed',
    itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
    createdAt: new Date().toISOString(),
    summary: payload.summary || null
  };
  sessions.push(row);
  return { ok: true, session: row };
}

module.exports = { list: list, save: save };
