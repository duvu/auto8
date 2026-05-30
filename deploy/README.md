# auto8 Production Deployment

Deployment topology:

```
Internet → 10.113.213.1 (Caddy, TLS) → 10.113.213.9:3001 (auto8 API)
                                      → 10.113.213.9:5432 (PostgreSQL, internal only)
```

---

## App Server Setup (`beou@10.113.213.9`)

### 1. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker beou
# Log out and back in for group to take effect
```

### 2. Clone the repo

```bash
git clone https://github.com/duvu/auto8.git ~/auto8
cd ~/auto8
```

### 3. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

**Required production values:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql://auto8:<strong-password>@postgres:5432/auto8` |
| `JWT_SECRET` | Long random string (e.g. `openssl rand -hex 32`) |
| `CREDENTIALS_ENCRYPTION_KEY` | 64 hex chars (e.g. `openssl rand -hex 32`) |
| `ALLOWED_ORIGINS` | `https://auto8.x51.vn` |
| `FRONTEND_URL` | `https://auto8.x51.vn` |

> ⚠️ Change the default PostgreSQL password from `auto8` to something strong.
> Update both `DATABASE_URL` and the `POSTGRES_PASSWORD` in `docker-compose.yml` (or override via env).

### 4. Start the stack

```bash
make deploy
```

This runs: `git pull && docker compose build && docker compose up -d`

### 5. Verify

```bash
docker compose ps            # both containers should be running/healthy
curl http://localhost:3001/api/health   # should return 200
```

---

## Firewall Rules (`10.113.213.9`)

Only allow port 3001 from the gateway LAN; block PostgreSQL from everywhere:

```bash
sudo ufw allow from 10.113.213.0/24 to any port 3001
sudo ufw deny 3001
sudo ufw deny 5432
sudo ufw enable
```

---

## Caddy Gateway Setup (`root@10.113.213.1`)

### 1. Install Caddy (if not already installed)

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install caddy
```

### 2. Add the auto8 site block

Append the contents of [`Caddyfile.auto8.x51.vn`](./Caddyfile.auto8.x51.vn) to `/etc/caddy/Caddyfile`:

```bash
cat /path/to/repo/deploy/Caddyfile.auto8.x51.vn >> /etc/caddy/Caddyfile
```

Or copy-paste the block manually:

```caddy
auto8.x51.vn {
    reverse_proxy http://10.113.213.9:3001
}
```

### 3. Validate and reload

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy will automatically obtain a TLS certificate from Let's Encrypt for `auto8.x51.vn`.

---

## DNS

Ensure `auto8.x51.vn` has an A record pointing to `10.113.213.1`.

```bash
dig auto8.x51.vn +short   # should return 10.113.213.1
```

---

## Updating the App

On the app server:

```bash
cd ~/auto8
make deploy
```

---

## Rollback

```bash
cd ~/auto8
git checkout <previous-tag-or-sha>
make deploy
```

To rollback Caddy config: remove the `auto8.x51.vn` block from `/etc/caddy/Caddyfile` and run `systemctl reload caddy`.
