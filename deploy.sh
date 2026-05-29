#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Property Basket — zero-downtime production deploy script
#
# Usage:  ./deploy.sh
#
# Run from the project root on the production server (as the deploy user).
# Designed for manual-VPS deployments — Forge/Ploi users should put the
# inner commands in their host's deploy-script panel instead.
#
# Behaviour:
#   1. Puts the site into maintenance mode (with a refresh-after-15s page)
#   2. Pulls latest code
#   3. Installs PHP + JS production deps
#   4. Rebuilds assets
#   5. Runs migrations
#   6. Re-caches config/routes/views
#   7. Restarts queue worker and FPM
#   8. Brings the site back up
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Detect PHP-FPM unit (php8.3-fpm, php8.4-fpm, ...)
PHP_FPM_SERVICE="$(systemctl list-units --type=service --no-legend | grep -oE 'php[0-9.]+-fpm.service' | head -n1 || true)"

log() {
    echo "──> $1"
}

cleanup() {
    if [[ "${MAINTENANCE_ON:-0}" == "1" ]]; then
        log "Bringing site back up (cleanup)"
        php artisan up || true
    fi
}
trap cleanup EXIT

log "Enabling maintenance mode"
php artisan down --retry=15 --refresh=15 || true
MAINTENANCE_ON=1

log "Pulling latest from $(git rev-parse --abbrev-ref HEAD)"
git pull --ff-only

log "Installing PHP dependencies"
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

log "Installing JS dependencies"
npm ci --omit=dev

log "Building frontend assets"
npm run build

log "Running migrations"
php artisan migrate --force --no-interaction

log "Symlinking storage (if needed)"
php artisan storage:link || true

log "Re-caching config / routes / views / events"
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

log "Restarting queue worker"
php artisan queue:restart

if [[ -n "$PHP_FPM_SERVICE" ]]; then
    log "Reloading $PHP_FPM_SERVICE"
    sudo systemctl reload "$PHP_FPM_SERVICE"
else
    log "WARN: couldn't auto-detect PHP-FPM service — please reload it manually"
fi

log "Bringing site back up"
php artisan up
MAINTENANCE_ON=0

log "✅ Deploy complete at $(date -Iseconds)"
log "    Commit: $(git rev-parse --short HEAD)"
