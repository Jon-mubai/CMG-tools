/**
 * frontend/scripts/build.js — 拼接 shared + api + 分层源为 js/app.js
 */
const fs = require('fs');
const path = require('path');

const AUTHOR_BANNER = ``;

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');

const order = [
  // shared（仓库根）
  path.join(repoRoot, 'shared/constants.js'),
  path.join(repoRoot, 'shared/permissions.js'),
  path.join(repoRoot, 'shared/dto/inventory.js'),
  // api facade
  'js/api/client.js',
  'js/api/inventory.js',
  'js/api/stocktake.js',
  'js/api/fileMagic.js',
  // core + features
  'js/core/bootstrap.js',
  'js/core/auth.js',
  'js/core/storage.js',
  'js/core/modal.js',
  'js/core/router.js',
  'js/core/sidebar.js',
  'js/core/bubble.js',
  'js/features/inventory-core.js',
  'js/features/scan-data.js',
  'js/features/compare.js',
  'js/features/scan-mutex.js',
  'js/features/usb-device.js',
  'js/features/scan-nav.js',
  'js/features/machine-module.js',
  'js/features/category-module.js',
  'js/features/docs-module.js',
  'js/warehouse/wh-module.js',
  'js/core/boot-bind.js',
];

const parts = [
  AUTHOR_BANNER,
  '/* js/app.js — shared + api + 分层源文件拼接 */\n',
  '/* 修改源文件后请运行: npm run build（在 frontend/ 或仓库根） */\n\n',
];

for (const rel of order) {
  const full = path.isAbsolute(rel) ? rel : path.join(frontendRoot, rel);
  const label = path.isAbsolute(rel) ? path.relative(repoRoot, rel) : rel;
  if (!fs.existsSync(full)) {
    console.error('Missing:', label, full);
    process.exit(1);
  }
  parts.push('\n/* ========== ' + label + ' ========== */\n');
  parts.push(fs.readFileSync(full, 'utf8'));
  parts.push('\n');
}

const out = path.join(frontendRoot, 'js/app.js');
fs.writeFileSync(out, parts.join(''), 'utf8');
console.log('Built', out, '(' + fs.statSync(out).size + ' bytes)');
