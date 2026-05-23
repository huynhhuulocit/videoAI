# Huong Dan Public VideoAI Bang Cloudflare Tunnel

Tai lieu nay huong dan cach public app VideoAI dang chay local o may cua ban ra internet bang Cloudflare Tunnel.

Co 2 cach su dung:

- **Quick tunnel**: nhanh, khong can domain, Cloudflare tao URL tam thoi `trycloudflare.com`.
- **Named tunnel**: dung domain/subdomain that, URL co dinh, phu hop hon khi gui cho khach hang.

## 1. Nguyen Tac Bao Mat

Khong mo port public truc tiep tu router/firewall:

- Khong port-forward `3000`.
- Khong port-forward `4000`.
- Khong expose PostgreSQL `55432`.
- Khong expose Redis `57379`.

Cloudflare Tunnel chi can may cua ban ket noi outbound toi Cloudflare. Khach hang chi nen truy cap qua URL Cloudflare.

Voi moi truong gui khach hang, nen dung 2 lop bao ve:

1. **Cloudflare Access**: chi allow email cu the cua ban/khach hang.
2. **VideoAI site gate**: username/password cua app truoc khi vao login user/admin.

Quick tunnel khong co Cloudflare Access co dinh, nen chi dung de test ngan han.

## 2. Chuan Bi Local App

Truoc khi public, dam bao VideoAI dang chay local:

```powershell
http://localhost:3000
```

Kiem tra API:

```powershell
Invoke-WebRequest -Uri http://localhost:4000/api/v1/health -UseBasicParsing
```

Neu app chua chay, start bang script cua project:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-project.ps1
```

## 3. Quick Tunnel - Test Nhanh Khong Can Domain

Dung khi ban muon test nhanh trong vai phut/gio.

### Start

Mo PowerShell tai thu muc project:

```powershell
cd D:\lochuynh\research_loc_huynh\videoAI
```

Chay:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-trycloudflare.ps1
```

Script se:

1. Dam bao frontend goi API qua same-origin `/api/v1`.
2. Start/restart local VideoAI neu can.
3. Stop tunnel cu neu dang chay.
4. Start `cloudflared tunnel --url http://localhost:3000`.
5. In ra URL tam thoi:

```text
https://xxxxx.trycloudflare.com
```

Gui URL nay cho nguoi can test.

### Stop

Neu PowerShell dang mo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\stop-trycloudflare.ps1
```

Script stop se dung PID da luu va sau do kiem tra/tat tat ca process `cloudflared` con lai.

Neu muon kiem tra thu cong:

```powershell
Get-Process cloudflared
Stop-Process -Name cloudflared
```

Hoac stop theo PID:

```powershell
Stop-Process -Id <PID>
```

### Luu Y Khi Dung Quick Tunnel

Quick tunnel chi route `localhost:3000`, nen frontend phai goi API theo same-origin:

```env
NEXT_PUBLIC_API_GATEWAY_URL=
```

Khi do Next.js se proxy:

```text
/api/* -> localhost:4000
```

Neu frontend van goi API truc tiep toi:

```text
http://localhost:4000
```

thi khach hang ben ngoai co the load UI nhung cac action goi API se loi `Failed to fetch`.

Cach dung on dinh hon van la named tunnel ben duoi, vi named tunnel route truc tiep:

```text
/api/* -> localhost:4000
/*     -> localhost:3000
```

## 4. Named Tunnel - Dung Cho Khach Hang

Dung khi ban da co domain/subdomain that, vi du:

```text
videoai.tenmiencuaban.com
```

### Buoc 1 - Tao Subdomain Tren Cloudflare

Ban can co domain dang nam trong Cloudflare DNS.

Vi du:

- Domain: `tenmiencuaban.com`
- Subdomain app: `videoai.tenmiencuaban.com`

Khong can tao DNS record thu cong neu dung script cua project. Script se chay lenh route DNS cho tunnel.

### Buoc 2 - Cau Hinh Cloudflare Access

Trong Cloudflare Zero Trust:

1. Vao **Access > Applications**.
2. Add application.
3. Chon **Self-hosted**.
4. Domain: `videoai.tenmiencuaban.com`.
5. Login method: One-Time PIN hoac identity provider cua ban.
6. Policy: Allow chi cac email cu the.
7. Khong chon `Everyone`.

Muc tieu la khach hang phai qua Cloudflare Access truoc khi cham toi app local cua ban.

### Buoc 3 - Cau Hinh File Local

Mo file:

```text
D:\lochuynh\research_loc_huynh\videoAI\deploy\cloudflare-tunnel\.env
```

Neu file chua co, copy tu example:

```powershell
Copy-Item deploy\cloudflare-tunnel\.env.example deploy\cloudflare-tunnel\.env
```

Sua cac gia tri:

```env
TUNNEL_NAME=videoai-local
HOSTNAME=videoai.tenmiencuaban.com
WEB_ORIGIN=https://videoai.tenmiencuaban.com
WEB_LOCAL_URL=http://localhost:3000
API_LOCAL_URL=http://localhost:4000
START_LOCAL_APP=1
SITE_GATE_ENABLED=true
SITE_GATE_USERNAME=videoai
SITE_GATE_PASSWORD=<mat-khau-rieng-cua-ban>
SITE_GATE_SECRET=change-me-site-gate-secret
```

Luu y:

- Khong commit file `.env`.
- Khong gui password trong chat/log/screenshot.
- Neu `SITE_GATE_SECRET` van la placeholder, script se tu generate secret moi.

### Buoc 4 - Start Named Tunnel

Chay:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-videoai-tunnel.ps1
```

Lan dau script co the mo browser de login Cloudflare.

Script se:

1. Update root `.env` de browser goi API cung origin `/api/v1`.
2. Start/restart VideoAI local.
3. Tao hoac reuse named tunnel.
4. Tao file ingress config local.
5. Route DNS cho hostname.
6. Start `cloudflared`.

### Stop Named Tunnel

Neu PowerShell tunnel dang mo:

```text
Ctrl + C
```

Neu can stop tat ca tunnel process:

```powershell
Stop-Process -Name cloudflared
```

## 5. Start / Stop Nhanh Hang Ngay

### Neu Dung Quick Tunnel

Start:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-trycloudflare.ps1
```

Stop:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\stop-trycloudflare.ps1
```

### Neu Dung Named Tunnel

Start:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-videoai-tunnel.ps1
```

Stop:

```text
Ctrl + C
```

## 6. Kiem Tra Sau Khi Public

### Local

```powershell
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing
Invoke-WebRequest -Uri http://localhost:4000/api/v1/health -UseBasicParsing
```

### Public

Mo URL:

```text
https://videoai.tenmiencuaban.com
```

Hoac voi quick tunnel:

```text
https://xxxxx.trycloudflare.com
```

Voi named tunnel dung cho khach hang, flow dung nen la:

```text
Cloudflare Access -> VideoAI site gate -> VideoAI user/admin login
```

## 7. Loi Thuong Gap

### `cloudflared` khong duoc nhan dien

Kiem tra:

```powershell
Get-Command cloudflared
```

Neu moi cai xong ma PowerShell chua nhan, dong PowerShell va mo lai.

Tren Windows, package co the nam tai:

```text
C:\Program Files (x86)\cloudflared\cloudflared.exe
```

Script `start-videoai-tunnel.ps1` da co fallback de tim path nay.

### Quick tunnel load UI nhung API loi

Day la gioi han cua quick tunnel vi no chi route `localhost:3000`.

Dung named tunnel de route them:

```text
/api/* -> localhost:4000
```

### Script bao `Set HOSTNAME`

Ban van dang de placeholder:

```env
HOSTNAME=videoai.example.com
```

Doi thanh subdomain that cua ban:

```env
HOSTNAME=videoai.tenmiencuaban.com
```

### Script bao `Set SITE_GATE_PASSWORD`

Ban van dang de placeholder:

```env
SITE_GATE_PASSWORD=change-me-site-gate-password
```

Doi thanh password rieng trong file local `.env`.

## 8. Nen Dung Cach Nao?

Dung quick tunnel khi:

- Chi can test nhanh.
- Khong co domain.
- Chap nhan URL thay doi moi lan start.

Dung named tunnel khi:

- Gui cho khach hang.
- Can URL co dinh.
- Can route API dung.
- Can Cloudflare Access email allowlist.

Dung VPS deploy khi:

- Muon app chay lien tuc ngay ca khi may local tat.
- Muon moi truong on dinh hon cho production/demo dai ngay.
