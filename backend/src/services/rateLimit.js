/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 * 所属：backend — 简易内存限流（S1）
 */
'use strict';

const buckets = new Map();

function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterMs: Math.max(0, b.resetAt - now) };
  }
  return { ok: true };
}

module.exports = { hit: hit };
