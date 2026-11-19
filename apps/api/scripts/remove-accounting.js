/**
 * 彻底移除已废弃的 accounting 模块（Prisma 中无 Acc* 模型）。
 * 在 apps/api 目录执行: node scripts/remove-accounting.js
 */
const fs = require('fs');
const path = require('path');

const apiRoot = path.resolve(__dirname, '..');
const accDir = path.join(apiRoot, 'src', 'modules', 'accounting');
const appModule = path.join(apiRoot, 'src', 'app.module.ts');

function rmDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log('[skip] 不存在:', dir);
    return;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('[ok] 已删除目录:', dir);
}

rmDir(accDir);

if (fs.existsSync(appModule)) {
  let src = fs.readFileSync(appModule, 'utf8');
  const before = src;
  src = src.replace(/\r\n/g, '\n');
  src = src.replace(/import\s+\{\s*AccountingModule\s*\}\s+from\s+['"]\.\/modules\/accounting\/accounting\.module['"];\n?/g, '');
  src = src.replace(/import\s+\{\s*AccountingModule\s*\}\s+from\s+['"][^'"]+accounting[^'"]+['"];\n?/g, '');
  src = src.replace(/,?\s*AccountingModule,?\s*/g, (m) => {
    if (m.includes(',')) return m.startsWith(',') && m.endsWith(',') ? ',' : '';
    return '';
  });
  // cleanup double commas / trailing commas in imports array roughly
  src = src.replace(/,\s*,/g, ',');
  src = src.replace(/\[\s*,/g, '[');
  src = src.replace(/,\s*\]/g, ']');
  if (src !== before) {
    fs.writeFileSync(appModule, src, 'utf8');
    console.log('[ok] 已清理 app.module.ts 中的 AccountingModule 引用');
  } else {
    console.log('[skip] app.module.ts 无 AccountingModule 引用');
  }
}

console.log('完成。请重新运行: npm run start:dev');
