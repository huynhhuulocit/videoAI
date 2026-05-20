# Start Project Manual

Tai lieu nay mo ta cach start VideoAI tren may local bang Windows PowerShell.

## 1. Yeu cau

- Node.js `>=20.11.0`.
- Docker Desktop dang chay.
- Chay lenh tu thu muc goc repo: `D:\lochuynh\research_loc_huynh\videoAI`.
- File `.env` ton tai. Neu chua co, copy tu `.env.example`.

## 2. Start nhanh bang mot file

Tu thu muc goc repo, chay:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-project.ps1
```

Script nay se tu dong:

- Kiem tra `.env`, tao tu `.env.example` neu chua co.
- Cai `npm install` neu chua co `node_modules`.
- Start PostgreSQL va Redis bang `infra/docker-compose.yml`.
- Chay Prisma generate va db push.
- Kiem tra seed data; neu database chua co user thi chay seed.
- Start API Gateway o `http://localhost:4000`.
- Start Web app o `http://localhost:3000`.
- Khi Web app can start moi, script se xoa cache Next.js `apps\web\.next` de tranh loi stale chunk sau khi vua chay `next build`.
- Ghi log vao `tmp\dev\`.

Neu port `3000` hoac `4000` dang bi process cu giu, chay:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-project.ps1 -Restart
```

Neu muon mo terminal rieng de xem log truc tiep:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-project.ps1 -VisibleLogs
```

## 3. Setup thu cong lan dau

```powershell
cd D:\lochuynh\research_loc_huynh\videoAI
npm.cmd install
docker compose -f infra/docker-compose.yml up -d
npm.cmd run db:setup
```

`db:setup` se chay Prisma generate, sync schema vao PostgreSQL va seed du lieu dev.

## 4. Start hang ngay thu cong

Bat database va Redis:

```powershell
cd D:\lochuynh\research_loc_huynh\videoAI
docker compose -f infra/docker-compose.yml up -d
```

Mo terminal thu nhat de start API Gateway:

```powershell
cd D:\lochuynh\research_loc_huynh\videoAI
npm.cmd run dev:api
```

Mo terminal thu hai de start Web:

```powershell
cd D:\lochuynh\research_loc_huynh\videoAI
npm.cmd run dev:web
```

Sau khi start:

- Web app: `http://localhost:3000`
- API Gateway: `http://localhost:4000`
- API health check: `http://localhost:4000/api/v1/health`

## 5. Tai khoan dev

- User: `User` / `User@123`
- Admin: `Admin` / `Admin@123`

Admin sau khi login se vao khu vuc admin. User sau khi login se vao dashboard user.

## 6. Cau hinh AI provider cho Generate shots

Feature `Generate shots` khong dung mock data. API Gateway se goi provider prompt dang active trong Admin AI Config:

- `gemini` can `GEMINI_API_KEY` trong `.env`.
- `chatgpt` can `OPENAI_API_KEY` trong `.env`.

De chay local, them key vao `.env`:

```env
GEMINI_API_KEY=""
OPENAI_API_KEY=""
```

Neu thieu key cua provider dang active, job `shot_generation` se failed voi ma loi `AI_CONFIG_MISSING` va khong tao shot plan gia.

## 7. Start bang background process

Neu muon start ca API va Web trong background tu mot terminal:

```powershell
$root = "D:\lochuynh\research_loc_huynh\videoAI"
New-Item -ItemType Directory -Force -Path "$root\tmp" | Out-Null
Start-Process -FilePath "npm.cmd" -ArgumentList @("run","dev:api") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$root\tmp\dev-api.out.log" -RedirectStandardError "$root\tmp\dev-api.err.log"
Start-Process -FilePath "npm.cmd" -ArgumentList @("run","dev:web") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$root\tmp\dev-web.out.log" -RedirectStandardError "$root\tmp\dev-web.err.log"
```

Xem log:

```powershell
Get-Content tmp\dev-api.out.log -Tail 80
Get-Content tmp\dev-web.out.log -Tail 80
```

## 8. Dung project

Dung Web/API dang chay o port `3000` va `4000`:

```powershell
$ports = 3000,4000
foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    Stop-Process -Id $connection.OwningProcess -Force
  }
}
```

Dung database va Redis:

```powershell
docker compose -f infra/docker-compose.yml down
```

## 9. Loi thuong gap

### Port da duoc su dung

Neu gap loi `EADDRINUSE` o port `3000` hoac `4000`, dung process cu roi start lai:

```powershell
$ports = 3000,4000
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}
```

### Next.js runtime bao loi `Cannot find module './*.js'`

Loi nay thuong xay ra khi cache `.next` bi tron giua `next dev` va `next build`. Start lai bang script restart de dung Web/API cu va xoa cache `.next` truoc khi Web dev server chay:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-project.ps1 -Restart
```

### Prisma generate bi khoa file tren Windows

Neu `npm.cmd run db:setup` bao loi `EPERM` khi rename `query_engine-windows.dll.node`, thuong la do API dev server dang giu Prisma Client. Dung Web/API process, sau do chay lai:

```powershell
npm.cmd run db:setup
```

### Database chua san sang

Kiem tra container:

```powershell
docker compose -f infra/docker-compose.yml ps
```

Neu container chua chay:

```powershell
docker compose -f infra/docker-compose.yml up -d
```
