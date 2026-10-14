# Upload status

Scaffold (structure, backend services, deploy, shared, docs) is on `main`.

The full SPA (`frontend/index.html`, `frontend/js/**`, CSS pages, bundled `app.js`, large vendors) is large for API-batch upload.

## Complete the full tree from your machine

```bash
# Option A: from the local monorepo that already has commit 61f8f1f
cd cucumber-inventory-project
git remote set-url origin https://github.com/Jon-mubai/CMG-tools.git
git fetch origin
git pull origin main --allow-unrelated-histories
# resolve if needed, then:
git push -u origin main
```

```bash
# Option B: unzip CMG-tools-source.zip over a clone
git clone https://github.com/Jon-mubai/CMG-tools.git
cd CMG-tools
# unzip source archive into this folder, then:
git add -A
git commit -m "feat: full frontend SPA and vendors"
git push
```

Author: zcl (MuBai) · 2026-10-14
