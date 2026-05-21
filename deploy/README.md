# VideoAI Single VPS Deployment

This folder contains a simple single-server deployment for the current VideoAI test phase. It runs:

- Caddy reverse proxy on ports `80`/`443`
- Next.js web app
- NestJS API Gateway
- PostgreSQL 16
- Redis 7
- Local upload storage as a Docker volume

The deployment is intentionally small and pragmatic. It is suitable for one tester and low traffic. It is not the final multi-service production topology from the TSD.

## Cloudflare Tunnel for Local Customer Testing

If you want to share your current local app from `localhost:3000` with a small number of customers, use the Cloudflare Tunnel guide instead of this VPS deploy:

```text
deploy/cloudflare-tunnel/README.md
```

That mode keeps the app on your local machine, routes `https://YOUR_HOSTNAME/api/*` to `localhost:4000`, routes all other traffic to `localhost:3000`, and expects Cloudflare Access with an explicit email allowlist in front of the app. Use this VPS/Caddy deploy when you want the product to keep running on a server without your local machine.

## VPS Recommendation

For one-person testing, start with:

- **Minimum:** 2 vCPU, 4 GB RAM, 40 GB SSD/NVMe, Ubuntu 24.04 LTS.
- **Comfortable:** 4 vCPU, 8 GB RAM, 80 GB SSD/NVMe, Ubuntu 24.04 LTS.
- **Avoid for this app:** 1 GB RAM VPS. Next.js build, PostgreSQL, Redis, and the API can fit only with swap and will be slow or fragile.

Suggested starting plan:

- Hetzner CX22-class or equivalent: 2 vCPU / 4 GB RAM / 40 GB disk. Hetzner's public pricing page describes CX22 as this size.
- DigitalOcean Basic 2 vCPU / 4 GB RAM / 80 GB disk if you prefer DigitalOcean's simpler UI. DigitalOcean lists this Basic Droplet size as a higher monthly price than Hetzner.

If your users are in Vietnam or Southeast Asia, choose a Singapore region when the provider offers it. If you only test alone, region is less important than predictable cost and easy snapshots.

## Domain Options

### IP-only test

Use this when you do not have a domain yet:

```env
APP_DOMAIN=:80
PUBLIC_WEB_ORIGIN=http://YOUR_SERVER_IP
NEXT_PUBLIC_API_GATEWAY_URL=
```

This serves HTTP only.

### Domain with HTTPS

Point an `A` record to the VPS public IP, open ports `80` and `443`, then use:

```env
APP_DOMAIN=videoai.example.com
PUBLIC_WEB_ORIGIN=https://videoai.example.com
NEXT_PUBLIC_API_GATEWAY_URL=
```

Caddy will request and renew HTTPS certificates automatically when DNS points to the server.

## First Deploy

On a fresh Ubuntu VPS:

```bash
sudo apt-get update
sudo apt-get install -y git curl openssl
git clone <your-repo-url> videoAI
cd videoAI
bash deploy/deploy.sh --install-docker --seed
```

The script creates `deploy/.env` on the first run with generated secrets. Review it before exposing the server publicly:

```bash
nano deploy/.env
bash deploy/deploy.sh --seed
```

Use `--seed` only when you want the demo `user` and `admin` accounts. The current seed also refreshes demo data, so skip `--seed` after you start entering real test data unless you intentionally want to reseed.

## Redeploy After Code Changes

```bash
cd /path/to/videoAI
git pull
bash deploy/deploy.sh
```

The script rebuilds images, applies the Prisma schema with `db:push`, and restarts containers.

## Useful Commands

```bash
cd deploy
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml logs -f web api
docker compose --env-file .env -f docker-compose.yml restart web api
docker compose --env-file .env -f docker-compose.yml down
```

## Backup

Create a PostgreSQL dump:

```bash
cd deploy
set -a && . ./.env && set +a
docker compose --env-file .env -f docker-compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "videoai-$(date +%Y%m%d-%H%M%S).sql"
```

Local uploads are stored in the `app-storage` Docker volume. Back it up before deleting volumes:

```bash
docker run --rm \
  -v deploy_app-storage:/data:ro \
  -v "$PWD:/backup" \
  alpine tar czf /backup/videoai-storage.tar.gz -C /data .
```

## Restore

```bash
cd deploy
set -a && . ./.env && set +a
docker compose --env-file .env -f docker-compose.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backup.sql
```

## Environment Notes

- `NEXT_PUBLIC_API_GATEWAY_URL` should stay empty for same-origin deployment through Caddy.
- `API_GATEWAY_URL` is set internally to `http://api:4000` by Docker Compose.
- `WEB_ORIGIN` is set from `PUBLIC_WEB_ORIGIN` for API CORS.
- `SITE_GATE_ENABLED=true` enables an outer app-level username/password gate before the normal VideoAI login. Keep the real `SITE_GATE_PASSWORD` and `SITE_GATE_SECRET` only in local/server `.env` files.
- `AI_CONFIG_ENCRYPTION_KEY` must stay stable after you save provider keys in Admin. Changing it can make saved encrypted provider keys unreadable.
- `GEMINI_API_KEY` and `OPENAI_API_KEY` are fallback keys. Prefer saving provider keys in Admin after the app is running.

## Known Limits

- This deploy uses `prisma db push` for the current prototype. For production, move to versioned Prisma migrations.
- PostgreSQL, Redis, web, and API share one VPS. Scale out only when traffic or AI jobs justify it.
- Local storage is a Docker volume. Move uploads to S3-compatible storage before multi-user production.
- The Docker images keep dev tooling so `db:push` and `db:seed` can run inside the same image. Optimize image size later if needed.
