#!/usr/bin/env bash
#
# Hostinger PRODUCTION sync script  (propertybasket.co.za — the apex).
#
# Same mechanism as deploy-hostinger.sh (which targets the `manage` STAGING
# site), but it syncs into the separate production app directory and migrates
# the separate production database. Production has its OWN .env + DB, which this
# script never touches — it only copies committed code + the pre-built bundle,
# then runs migrations and clears caches.
#
# WORKFLOW:  test on manage (staging) first, THEN promote here.
#
# Usage (from an SSH session), after you've deployed + verified on staging:
#   rm -rf /tmp/propertybasket-main /tmp/pb.zip
#   curl -fL -o /tmp/pb.zip https://codeload.github.com/malwandlak1-ux/propertybasket/zip/refs/heads/main
#   unzip -o -q /tmp/pb.zip -d /tmp
#   bash /tmp/propertybasket-main/deploy-hostinger-prod.sh
#
set -e

SRC="/tmp/propertybasket-main"
APP="$HOME/domains/propertybasket.co.za/public_html/prod"   # PROD app dir (apex docroot -> $APP/public)

if [ ! -f "$APP/.env" ]; then
  echo "ERROR: $APP/.env not found. Run the one-time production bootstrap first (see SESSION_HANDOFF.md)." >&2
  exit 1
fi

echo "Syncing code from $SRC -> $APP  (PRODUCTION)"

# Compiled front-end bundle (Vite output committed to the repo).
cp -rf "$SRC/public/build/." "$APP/public/build/"

# Application code — full sync (the repo is the source of truth).
cp -rf "$SRC/app/."                  "$APP/app/"
cp -f  "$SRC/bootstrap/app.php"      "$APP/bootstrap/app.php"
cp -rf "$SRC/routes/."               "$APP/routes/"
cp -rf "$SRC/database/migrations/."  "$APP/database/migrations/"
cp -rf "$SRC/database/seeders/."     "$APP/database/seeders/"
cp -rf "$SRC/resources/views/."      "$APP/resources/views/"

# Public assets (brand images, custom error page, marketing pages).
mkdir -p "$APP/public/images" "$APP/public/error"
cp -rf "$SRC/public/images/." "$APP/public/images/"
[ -d "$SRC/public/error" ] && cp -rf "$SRC/public/error/." "$APP/public/error/"
cp -f "$SRC/public/property-basket-overview.html" "$APP/public/property-basket-overview.html"
cp -f "$SRC/public/how-to.html"                   "$APP/public/how-to.html"

# Never let a stale Vite hot file blank out prod.
rm -f "$APP/public/hot"

# Apply migrations against the PRODUCTION database (from prod .env), refresh caches.
cd "$APP"
php artisan migrate --force
php artisan view:clear
php artisan cache:clear
php artisan config:clear
php artisan route:clear

echo "PROD SYNC COMPLETE"
