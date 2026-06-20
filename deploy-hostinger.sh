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
cp -f "$SRC/app/Http/Controllers/Public/ListingController.php"     "$APP/app/Http/Controllers/Public/ListingController.php"
cp -f "$SRC/app/Http/Controllers/Public/TourRequestController.php" "$APP/app/Http/Controllers/Public/TourRequestController.php"
cp -f "$SRC/app/Http/Controllers/Auth/InvitationController.php"    "$APP/app/Http/Controllers/Auth/InvitationController.php"
cp -f "$SRC/app/Http/Controllers/Agency/AgentsController.php"      "$APP/app/Http/Controllers/Agency/AgentsController.php"
cp -f "$SRC/app/Http/Controllers/Admin/UsersController.php"        "$APP/app/Http/Controllers/Admin/UsersController.php"
cp -f "$SRC/app/Http/Controllers/Agent/ListingsController.php"     "$APP/app/Http/Controllers/Agent/ListingsController.php"
cp -f "$SRC/app/Http/Controllers/Agent/InspectionsController.php"  "$APP/app/Http/Controllers/Agent/InspectionsController.php"
cp -f "$SRC/app/Http/Controllers/Landlord/TenantsController.php"   "$APP/app/Http/Controllers/Landlord/TenantsController.php"
cp -f "$SRC/app/Http/Controllers/Tenant/LeaseController.php"       "$APP/app/Http/Controllers/Tenant/LeaseController.php"
cp -f "$SRC/app/Http/Controllers/Tenant/DocumentsController.php"   "$APP/app/Http/Controllers/Tenant/DocumentsController.php"
cp -f "$SRC/app/Http/Controllers/Tenant/MaintenanceController.php" "$APP/app/Http/Controllers/Tenant/MaintenanceController.php"
cp -f "$SRC/app/Http/Controllers/Agency/MaintenanceController.php" "$APP/app/Http/Controllers/Agency/MaintenanceController.php"
cp -f "$SRC/app/Http/Controllers/Agency/ContractorsController.php" "$APP/app/Http/Controllers/Agency/ContractorsController.php"
cp -f "$SRC/app/Http/Controllers/Agency/CommissionController.php"  "$APP/app/Http/Controllers/Agency/CommissionController.php"
cp -f "$SRC/app/Http/Controllers/Agent/MaintenanceController.php"  "$APP/app/Http/Controllers/Agent/MaintenanceController.php"
cp -f "$SRC/app/Services/InquiryService.php"                      "$APP/app/Services/InquiryService.php"
cp -f "$SRC/app/Services/CommissionService.php"                  "$APP/app/Services/CommissionService.php"
cp -f "$SRC/app/Http/Controllers/Agency/PipelineController.php"   "$APP/app/Http/Controllers/Agency/PipelineController.php"
cp -f "$SRC/app/Http/Controllers/Agent/PipelineController.php"    "$APP/app/Http/Controllers/Agent/PipelineController.php"
cp -f "$SRC/app/Models/Lease.php"                                 "$APP/app/Models/Lease.php"
cp -f "$SRC/app/Models/Agency.php"                               "$APP/app/Models/Agency.php"
cp -f "$SRC/app/Models/User.php"                                 "$APP/app/Models/User.php"
cp -f "$SRC/app/Models/Listing.php"                              "$APP/app/Models/Listing.php"
# Managed-landlord rental payouts.
cp -f "$SRC/app/Models/ManagedLandlord.php"                      "$APP/app/Models/ManagedLandlord.php"
cp -f "$SRC/app/Models/LandlordPayout.php"                       "$APP/app/Models/LandlordPayout.php"
cp -f "$SRC/app/Http/Controllers/Agency/LandlordsController.php" "$APP/app/Http/Controllers/Agency/LandlordsController.php"
cp -f "$SRC/routes/web.php"                                       "$APP/routes/web.php"

# Migrations (append-only; migrate --force below applies new ones).
cp -rf "$SRC/database/migrations/." "$APP/database/migrations/"

# Email template redesign + notifications.
cp -rf "$SRC/app/Notifications/." "$APP/app/Notifications/"
cp -rf "$SRC/resources/views/vendor/mail/." "$APP/resources/views/vendor/mail/"

# Orange rebrand — brand image assets + server-rendered PDF template.
mkdir -p "$APP/public/images" "$APP/resources/views/components"
cp -rf "$SRC/public/images/." "$APP/public/images/"
cp -f  "$SRC/resources/views/components/pdf-layout.blade.php" "$APP/resources/views/components/pdf-layout.blade.php"

# Apply any new migrations, then refresh caches.
cd "$APP"
php artisan migrate --force
php artisan view:clear
php artisan cache:clear
php artisan config:clear
php artisan route:clear

echo "SYNC COMPLETE"
