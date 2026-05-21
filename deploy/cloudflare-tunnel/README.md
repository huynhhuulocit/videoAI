# VideoAI Cloudflare Tunnel

This folder publishes the local VideoAI dev app through a fixed Cloudflare Tunnel hostname. It is intended for short customer testing while you keep the app running on your machine.

Cloudflare Tunnel should be used with Cloudflare Access. Access provides the customer-facing gate before the request reaches your local app.

## Network Model

Traffic flow:

```text
Customer browser
  -> Cloudflare Access OTP
  -> Cloudflare Tunnel hostname
  -> cloudflared on your machine
  -> localhost:3000 for the web app
  -> localhost:4000 for /api/*
```

Do not open public inbound ports for this mode:

- Do not port-forward `3000`.
- Do not port-forward `4000`.
- Do not expose PostgreSQL `55432`.
- Do not expose Redis `56379`.

`cloudflared` uses outbound connections to Cloudflare. Your app should be reachable publicly only through the Cloudflare hostname.

## Prerequisites

- A Cloudflare account.
- A domain managed by Cloudflare DNS.
- A hostname for the app, for example `videoai.example.com`.
- Cloudflare Access enabled for that hostname.
- `cloudflared` installed on the machine that runs VideoAI.
- Node.js, npm, and Docker installed for local VideoAI.

Official references:

- Cloudflare named/local tunnel setup: <https://developers.cloudflare.com/tunnel/advanced/local-management/create-local-tunnel/>
- Cloudflare Tunnel network/firewall model: <https://developers.cloudflare.com/tunnel/configuration/>
- Cloudflare Access One-Time PIN: <https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/>
- Cloudflare Access policies: <https://developers.cloudflare.com/cloudflare-one/policies/access/>

## First-Time Setup

Copy the example environment file:

```powershell
Copy-Item deploy\cloudflare-tunnel\.env.example deploy\cloudflare-tunnel\.env
```

Edit `deploy/cloudflare-tunnel/.env`:

```env
TUNNEL_NAME=videoai-local
HOSTNAME=videoai.example.com
WEB_ORIGIN=https://videoai.example.com
WEB_LOCAL_URL=http://localhost:3000
API_LOCAL_URL=http://localhost:4000
START_LOCAL_APP=1
SITE_GATE_ENABLED=true
SITE_GATE_USERNAME=videoai
SITE_GATE_PASSWORD=change-me-site-gate-password
SITE_GATE_SECRET=change-me-site-gate-secret
```

Use your real hostname for `HOSTNAME` and `WEB_ORIGIN`.
Replace `SITE_GATE_PASSWORD` with the private site password before sharing. The script will generate `SITE_GATE_SECRET` for you if it is still set to the placeholder value. Do not commit the real password or generated secret.

## Cloudflare Access Setup

In Cloudflare Zero Trust:

1. Go to **Access > Applications**.
2. Add a self-hosted application for `https://HOSTNAME`.
3. Use One-Time PIN or your identity provider.
4. Create an Allow policy with explicit email addresses for yourself and your customers.
5. Do not create a policy that includes `Everyone`.
6. Do not allow all valid One-Time PIN logins without restricting email addresses.

This gives customers a Cloudflare login step before they reach VideoAI.

## One-Click Start

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-videoai-tunnel.ps1
```

The script will:

1. Validate local tools.
2. Update root `.env` for tunnel-safe browser behavior:
   - `NEXT_PUBLIC_API_GATEWAY_URL=` so browser calls use same-origin `/api/v1`.
   - `WEB_ORIGIN=https://HOSTNAME` for API CORS.
   - `SITE_GATE_*` values so the app-level site gate is active while sharing.
3. Restart local VideoAI through `start-project.ps1` unless `START_LOCAL_APP=0`. Restarting is intentional because the Next.js app must read the updated tunnel-safe `.env`.
4. Create or reuse the named Cloudflare Tunnel.
5. Generate `deploy/cloudflare-tunnel/generated/config.yml`.
6. Route Cloudflare DNS for `HOSTNAME`.
7. Validate ingress rules.
8. Run the tunnel.

Keep the PowerShell window open while customers use the app. Press `Ctrl+C` to stop the tunnel.

## Generated Files

The script writes local-only generated files under:

```text
deploy/cloudflare-tunnel/generated/
```

The generated config and local `.env` are ignored by git. Do not commit Cloudflare certificates, tunnel credentials, API keys, or generated config.

Cloudflare tunnel credentials are stored by `cloudflared` in your user profile, usually:

```text
%USERPROFILE%\.cloudflared\
```

## Useful Commands

Show script help:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-videoai-tunnel.ps1 -Help
```

Run the tunnel without starting the app first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-videoai-tunnel.ps1 -SkipLocalApp
```

Skip DNS routing if you already created the DNS route:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-videoai-tunnel.ps1 -SkipDnsRoute
```

Inspect tunnels:

```powershell
cloudflared tunnel list
cloudflared tunnel info videoai-local
```

## Safety Checklist Before Sharing

- Cloudflare Access is enabled for the hostname.
- Access policy allows only explicit customer/admin emails.
- `SITE_GATE_ENABLED=true` and `SITE_GATE_PASSWORD` is not a placeholder.
- Direct public access to ports `3000`, `4000`, `55432`, and `56379` is blocked.
- The local app has a strong admin password.
- Provider keys are stored through Admin or local `.env`; never commit them.
- The tunnel PowerShell window is visible so you can stop sharing quickly.

## When To Use VPS Deploy Instead

Use `deploy/` Docker/Caddy deployment when you want a server that keeps running without your laptop or desktop. Use this Cloudflare Tunnel mode when you want to quickly share your current local app with a small number of customers.
