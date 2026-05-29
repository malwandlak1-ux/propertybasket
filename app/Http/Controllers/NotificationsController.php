<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    /**
     * POST /notifications/{id}/read — mark one notification as read.
     * Authorised by ownership: the notification must belong to the current user.
     */
    public function markRead(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 401);

        $notification = $user->notifications()->where('id', $id)->first();
        abort_unless($notification, 404);

        if ($notification->unread()) {
            $notification->markAsRead();
        }

        return back();
    }

    /**
     * POST /notifications/read-all — mark every unread notification as read.
     */
    public function markAllRead(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 401);

        $user->unreadNotifications->markAsRead();

        return back();
    }
}
