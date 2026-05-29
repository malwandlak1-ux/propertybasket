# Property Basket — Production Deployment Guide

This guide covers three deployment paths in order of effort:

1. **Laravel Forge** — managed, ~30 min from zero to live
2. **Ploi** — alternative managed PaaS, similar effort
3. **Manual VPS** — Ubuntu 24.04 from scratch, ~90 min

Pick the path that matches your ops appetite. All three end with the same hardened runtime.

---

## 1 · Pre-flight checklist (do this first, regardless of host)

### Domain + DNS
- Buy a domain (`propertybasket.co.za` — `.co.za` registrars include Hetzner.co.za, Domains.co.za, Afrihost)
- Point an `A` record to your server IP
- Point `www` as a `CNAME` to the apex
- Wait for propagation (`dig +short propertybasket.co.za`)

### Third-party accounts
| Service | Purpose | Where |
|---------|---------|-------|
| Paystack | Live payment keys | https://dashboard.paystack.com → Settings → Developer |
| Resend / Postmark / Mailgun | Transactional email | Pick one; verify sending domain |
| AWS | S3 bucket for file storage | Create bucket in `af-south-1` (Cape Town) |
| Sentry (optional) | Error tracking | https://sentry.io |
| Cloudflare (optional) | DNS + CDN + DDoS | https://cloudflare.com |

### Repository
- Push your code to GitHub / GitLab / Bitbucket
- **Never commit `.env`** — `.gitignore` already excludes it ✓

---

## 2 · Path A — Laravel Forge (recommended)

Forge handles Nginx, PHP-FPM, MySQL, Redis, Let's Encrypt, queue workers and deploys for ~$12/month.

### 2.1 — Server provisioning
1. Sign up at https://forge.laravel.com
2. Connect a server provider (DigitalOcean, Hetzner, Linode, Vultr)
3. Provision a server:
   - **Type:** App server
   - **Size:** 2 vCPU / 4 GB RAM minimum (4 vCPU / 8 GB for >100 active users)
   - **Region:** Closest to your users (af-south-1 for SA = no region, use `lon1` or `fra1`)
   - **PHP:** 8.3 or 8.4
   - **Database:** MySQL 8 (creates `forge` DB you'll rename)
   - Tick **Redis**
4. Wait 5–8 min for provisioning

### 2.2 — Site setup
1. Sites → **New Site**
   - **Root domain:** `propertybasket.co.za`
   - **Aliases:** `www.propertybasket.co.za`
   - **Project type:** General PHP / Laravel
   - **Web Directory:** `/public`
   - Tick **Create database** → name it `property_basket`
2. Activate the site → **Git Repository** → paste your repo URL → branch `main`
3. **Environment** → paste contents of `.env.production.example`, fill in real values, especially:
   - `APP_KEY` (click "Generate" in Forge)
   - DB creds from the provision step
   - Real Paystack keys
   - Mail provider keys
   - S3 keys

### 2.3 — Deploy script
Forge's deploy script box → replace with:

```bash
cd $FORGE_SITES_PATH/propertybasket.co.za
git pull origin $FORGE_SITE_BRANCH

$FORGE_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader

# Frontend assets
npm ci --omit=dev
npm run build

# Laravel
$FORGE_PHP artisan migrate --force
$FORGE_PHP artisan storage:link || true
$FORGE_PHP artisan config:cache
$FORGE_PHP artisan route:cache
$FORGE_PHP artisan view:cache
$FORGE_PHP artisan event:cache

# Restart queue worker
( flock -w 10 9 || exit 1
    echo 'Restarting FPM...'; sudo -S service $FORGE_PHP_FPM reload ) 9>/tmp/fpmlock
$FORGE_PHP artisan queue:restart
```

### 2.4 — Queue worker
Sites → Queue → **Daemon worker**:
- Connection: `redis`
- Queue: `default`
- Timeout: `120`
- Sleep: `3`
- Max tries: `3`
- Memory: `256`

This is **required** — notifications + PDF email attachments are queued.

### 2.5 — Scheduler
Sites → Scheduler → enable. Forge runs `php artisan schedule:run` every minute automatically once enabled.

### 2.6 — SSL
Sites → SSL → **LetsEncrypt** → install. Forge auto-renews.

### 2.7 — First deploy
Click **Deploy now**. Watch the deploy log for errors. After success:
- Visit `https://propertybasket.co.za`
- Go to `/login`, sign in as super admin
- Run the seeders manually via SSH (Forge UI → Commands):
  ```bash
  php artisan db:seed --class=SuperAdminSeeder
  # (Skip demo seeders in production)
  ```

### 2.8 — Paystack webhook
1. Paystack dashboard → Settings → API Keys & Webhooks
2. Set **Webhook URL** to: `https://propertybasket.co.za/webhooks/paystack`
3. Trigger a test event → check `storage/logs/laravel.log` for "Paystack webhook" entry

---

## 3 · Path B — Ploi

Same shape as Forge, similar cost. Sign up at https://ploi.io, provision a server, create a site, paste the env. Their default deploy script is nearly identical to Forge's — just substitute `$FORGE_*` variables with Ploi's `$PLOI_*` equivalents.

Key differences:
- Ploi has built-in **Cloudflare integration** (one-click DNS)
- Ploi's queue worker UI is under **Daemons** not **Queue**
- Ploi includes **Supervisor** by default for queue workers

---

## 4 · Path C — Manual VPS (Ubuntu 24.04)

For when you want full control. Assumes a fresh Ubuntu 24.04 VPS with root SSH.

### 4.1 — Server packages

```bash
# As root
apt update && apt upgrade -y
apt install -y software-properties-common curl unzip git nginx mysql-server redis-server certbot python3-certbot-nginx ufw fail2ban

# PHP 8.3
add-apt-repository ppa:ondrej/php -y
apt update
apt install -y php8.3-fpm php8.3-cli php8.3-mysql php8.3-redis php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-gd php8.3-bcmath php8.3-intl

# Node 22 (for Vite)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Composer
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
```

### 4.2 — Firewall + user

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

# Create deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG www-data deploy
mkdir -p /home/deploy/.ssh
# Paste your public key:
nano /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

### 4.3 — Database

```bash
mysql_secure_installation
mysql -uroot -p <<SQL
CREATE DATABASE property_basket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'propertybasket'@'localhost' IDENTIFIED BY 'change-me-strong-pw';
GRANT ALL ON property_basket.* TO 'propertybasket'@'localhost';
FLUSH PRIVILEGES;
SQL
```

### 4.4 — Clone & first install (as `deploy`)

```bash
su - deploy
cd /home/deploy
git clone git@github.com:your-org/property-basket.git
cd property-basket

cp .env.production.example .env
nano .env             # fill in real values
php artisan key:generate

composer install --no-dev --optimize-autoloader
npm ci --omit=dev
npm run build

php artisan migrate --force
php artisan db:seed --class=SuperAdminSeeder
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 4.5 — Nginx

`/etc/nginx/sites-available/propertybasket.co.za`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name propertybasket.co.za www.propertybasket.co.za;
    root /home/deploy/property-basket/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    index index.php;
    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 60;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Cache built assets aggressively
    location /build/ {
        expires 1y;
        access_log off;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
ln -s /etc/nginx/sites-available/propertybasket.co.za /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 4.6 — SSL

```bash
certbot --nginx -d propertybasket.co.za -d www.propertybasket.co.za --redirect --agree-tos -m admin@propertybasket.co.za
```

Auto-renew is enabled by default (`systemctl status certbot.timer`).

### 4.7 — Queue worker (Supervisor)

`/etc/supervisor/conf.d/propertybasket-worker.conf`:

```ini
[program:propertybasket-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /home/deploy/property-basket/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=deploy
numprocs=2
redirect_stderr=true
stdout_logfile=/var/log/supervisor/propertybasket-worker.log
stopwaitsecs=3600
```

```bash
apt install -y supervisor
supervisorctl reread && supervisorctl update
supervisorctl start propertybasket-worker:*
```

### 4.8 — Scheduler (cron)

```bash
crontab -u deploy -e
```

Add:

```cron
* * * * * cd /home/deploy/property-basket && php artisan schedule:run >> /dev/null 2>&1
```

### 4.9 — Permissions

```bash
chown -R deploy:www-data /home/deploy/property-basket
chmod -R 775 /home/deploy/property-basket/storage /home/deploy/property-basket/bootstrap/cache
```

---

## 5 · Post-deploy operations

### Zero-downtime deploy script

`deploy.sh` (committed to repo, run on the server):

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Enable maintenance mode (renders 503 page to users)
php artisan down --retry=15 --secret="$(php -r "echo bin2hex(random_bytes(16));")" --refresh=15 || true

git pull origin main
composer install --no-dev --optimize-autoloader --no-interaction
npm ci --omit=dev
npm run build

php artisan migrate --force --no-interaction
php artisan storage:link || true

# Re-cache config/routes/views
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Restart queue + FPM
php artisan queue:restart
sudo systemctl reload php8.3-fpm

# Bring site back up
php artisan up

echo "✅ Deploy complete at $(date)"
```

Make executable: `chmod +x deploy.sh`. Run with: `./deploy.sh`.

### Backups

```bash
# Database (daily, 30-day retention)
mysqldump -u propertybasket -p property_basket | gzip > /backups/db-$(date +%F).sql.gz
find /backups -name "db-*.sql.gz" -mtime +30 -delete
```

Add to root crontab:
```cron
0 2 * * * mysqldump -u propertybasket -p'YOUR_PASSWORD' property_basket | gzip > /backups/db-$(date +\%F).sql.gz
```

Push backups to S3 weekly:
```bash
aws s3 sync /backups s3://propertybasket-backups/db/
```

### Monitoring

| Tool | Setup |
|------|-------|
| **Sentry** | Add `sentry/sentry-laravel` to composer, set `SENTRY_LARAVEL_DSN` |
| **Laravel Pulse** | `composer require laravel/pulse` (in-app dashboard at `/pulse`) — disabled in prod env by default |
| **UptimeRobot** | Free — monitor `https://propertybasket.co.za/up` every 5 min |
| **Better Stack** | Logs + uptime; pipe Laravel logs via the `logs.betterstack` channel |

### Common ops commands

```bash
# Tail logs
tail -f storage/logs/laravel.log

# Clear all caches (after env change)
php artisan optimize:clear

# Re-cache after deploy
php artisan optimize

# Check queue worker
supervisorctl status

# Restart queue without restarting Supervisor
php artisan queue:restart

# Tinker (REPL)
php artisan tinker
```

---

## 6 · Post-deploy verification checklist

After your first deploy, walk through these:

- [ ] Visit `https://propertybasket.co.za` — homepage loads with HTTPS lock icon
- [ ] `/up` returns 200
- [ ] `/login` → sign in as super admin → redirected to `/admin`
- [ ] `/admin` overview loads with real platform counts
- [ ] Register a test landlord at `/register` → welcome email arrives in test inbox
- [ ] As tenant, click "Pay now" on a rent payment → Paystack live checkout opens
- [ ] Run a tiny test payment with a real card → check that:
  - [ ] You return to the callback URL
  - [ ] The payment shows as paid in the DB
  - [ ] Receipt email arrives with PDF attached
  - [ ] Paystack dashboard shows the transaction
  - [ ] `/webhooks/paystack` got a `charge.success` event (check log)
- [ ] Generate a rent receipt PDF, lease PDF, invoice PDF, inspection PDF — each downloads cleanly
- [ ] `/admin/system` shows healthy status for API + DB + Paystack

---

## 7 · Hardening checklist (within 7 days of launch)

- [ ] Enable 2FA on Paystack dashboard
- [ ] Enable 2FA on AWS root + IAM users
- [ ] Restrict MySQL `propertybasket` user to `SELECT/INSERT/UPDATE/DELETE` only (revoke `DROP/ALTER/CREATE`)
- [ ] Set up offsite backups (S3 lifecycle → Glacier after 30 days)
- [ ] Configure Sentry release tracking (`sentry-cli` in deploy script)
- [ ] Configure Cloudflare → enable "Under Attack Mode" toggle if hit by bots
- [ ] Schedule quarterly secret rotation (Paystack, mail, AWS)
- [ ] Set up dead-man's snitch on the daily backup cron

---

## 8 · Rollback plan

If a deploy breaks production:

```bash
cd /home/deploy/property-basket
php artisan down
git reset --hard HEAD~1                 # roll back one commit
composer install --no-dev --optimize-autoloader
npm ci --omit=dev && npm run build
php artisan migrate:rollback --force    # only if migration broke things
php artisan optimize:clear && php artisan optimize
php artisan up
```

If the database itself is corrupted:

```bash
# Restore from latest backup
gunzip < /backups/db-2026-05-23.sql.gz | mysql -u propertybasket -p property_basket
```

---

**Need help?** Open an issue or email support@propertybasket.co.za.
