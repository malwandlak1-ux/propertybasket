#!/usr/bin/env bash
#
# Hostinger shared-hosting sync script.
#
# The live site is NOT a git checkout and the server has no Node build step,
# so we deploy by: pulling the repo zip into /tmp, then running this script,
# which copies the committed code + the pre-built public/build bundle into the
# live app directory, runs migrations, and clears Laravel's caches.
#
# Usage (from an SSH session):
#   rm -rf /tmp/propertybasket-main /tmp/pb.zip
#   curl -fL -o /tmp/pb.zip https://codeload.github.com/malwandlak1-ux/propertybasket/zip/refs/heads/main
#   unzip -o -q /tmp/pb.zip -d /tmp
#   bash /tmp/propertybasket-main/deploy-hostinger.sh
#
set -e

SRC="/tmp/propertybasket-main"
APP="$HOME/domains/propertybasket.co.za/public_html/manage"

echo "Syncing code from $SRC -> $APP"

# Compiled front-end bundle (Vite output committed to the repo).
cp -rf "$SRC/public/build/." "$APP/public/build/"

# Application code — full sync (the repo is the source of truth). This covers
# every controller, model, middleware, service, notification, support class, etc.
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

# Apply migrations (ensures subscription columns + grants launch grace to
# existing agencies/landlords + creates promo-code tables), then refresh caches.
cd "$APP"
php artisan migrate --force
php artisan view:clear
php artisan cache:clear
php artisan config:clear
php artisan route:clear

echo "SYNC COMPLETE"
