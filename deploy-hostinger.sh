#!/usr/bin/env bash
#
# Hostinger shared-hosting sync script.
#
# The live site is NOT a git checkout and the server has no Node build step,
# so we deploy by: pulling the repo zip into /tmp, then running this script,
# which copies the committed code + the pre-built public/build bundle into the
# live app directory and clears Laravel's caches.
#
# Usage (from an SSH session):
#   cd /tmp
#   curl -sL -o pb.zip https://github.com/malwandlak1-ux/propertybasket/archive/refs/heads/main.zip
#   unzip -o -q pb.zip
#   bash /tmp/propertybasket-main/deploy-hostinger.sh
#
set -e

SRC="/tmp/propertybasket-main"
APP="$HOME/domains/propertybasket.co.za/public_html/manage"

echo "Syncing code from $SRC -> $APP"

# Compiled front-end bundle (Vite output committed to the repo).
cp -rf "$SRC/public/build/." "$APP/public/build/"

# Back-end code changed this session.
cp -f "$SRC/app/Http/Controllers/Public/ListingController.php"   "$APP/app/Http/Controllers/Public/ListingController.php"
cp -f "$SRC/app/Http/Controllers/Auth/InvitationController.php"  "$APP/app/Http/Controllers/Auth/InvitationController.php"
cp -f "$SRC/app/Http/Controllers/Agency/AgentsController.php"    "$APP/app/Http/Controllers/Agency/AgentsController.php"
cp -f "$SRC/app/Http/Controllers/Admin/UsersController.php"      "$APP/app/Http/Controllers/Admin/UsersController.php"

# Email template redesign + notifications.
cp -f "$SRC/app/Notifications/WelcomeUser.php"  "$APP/app/Notifications/WelcomeUser.php"
cp -f "$SRC/app/Notifications/UserInvited.php"  "$APP/app/Notifications/UserInvited.php"
cp -rf "$SRC/resources/views/vendor/mail/." "$APP/resources/views/vendor/mail/"

# Refresh caches so the new code + views take effect.
cd "$APP"
php artisan view:clear
php artisan cache:clear
php artisan config:clear

echo "SYNC COMPLETE"
