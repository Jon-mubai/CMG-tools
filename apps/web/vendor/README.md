# 本地第三方依赖（强制零 CDN）

**约定：前端禁止通过 CDN / 外链加载脚本、样式、字体与图标 API。**
所有依赖必须放在本目录或 `modules/*/vendor/`，`index.html` 仅使用相对路径。

| 文件 | 用途 |
|------|------|
| xlsx.full.min.js | SheetJS Excel 解析 |
| exceljs.min.js | 带图片的 Excel 导出（单据） |
| html5-qrcode.min.js | 摄像头扫码 |
| iconify-icon.min.js | 图标 Web Component |
| icons-ant-design.json | 离线 ant-design 图标集 |
| iconify-offline.js | 加载本地图标，禁止远程 API |
| qrcode-generator.min.js | 二维码生成底层 |
| qrcode-adapter.js | 兼容 `QRCode.toCanvas` |

更新：在可联网机器下载后覆盖本目录文件，再提交；禁止改回 unpkg/jsdelivr。

CSP：`script-src 'self'`；`connect-src` 仅本机 API。
