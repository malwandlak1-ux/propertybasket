<?php

namespace App\Notifications\Channels;

use App\Models\PushToken;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends a notification to every mobile device the user is signed in on, via
 * Expo's push service (which relays to FCM / APNs).
 *
 * A notification opts in by adding `ExpoPushChannel::class` to via() (use
 * ExpoPushChannel::for($notifiable) so users without the app are skipped)
 * and implementing toExpoPush($notifiable): array{title, body, data?}.
 *
 * Push is best-effort: a failure is logged and never breaks the other
 * channels (database bell, mail). Tokens Expo reports as
 * DeviceNotRegistered (app uninstalled) are deleted.
 */
class ExpoPushChannel
{
    public const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    /** @return array<int, class-string> [self::class] when the user has a device, else [] */
    public static function for(object $notifiable): array
    {
        return method_exists($notifiable, 'pushTokens') && $notifiable->pushTokens()->exists()
            ? [self::class]
            : [];
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toExpoPush') || ! method_exists($notifiable, 'pushTokens')) {
            return;
        }

        $tokens = $notifiable->pushTokens()->pluck('token')->all();
        if ($tokens === []) {
            return;
        }

        $payload = $notification->toExpoPush($notifiable);

        $messages = array_map(fn (string $to) => [
            'to'        => $to,
            'title'     => $payload['title'],
            'body'      => $payload['body'],
            'data'      => (object) ($payload['data'] ?? []),
            'sound'     => 'default',
            'priority'  => 'high',
            'channelId' => 'default',
        ], $tokens);

        try {
            $request = Http::acceptJson()->timeout(10);
            if ($accessToken = config('services.expo.access_token')) {
                $request = $request->withToken($accessToken);
            }

            $response = $request->post(self::ENDPOINT, $messages);

            if (! $response->successful()) {
                Log::warning('Expo push failed', ['status' => $response->status(), 'body' => $response->body()]);
                return;
            }

            // Tickets come back in the same order as the messages.
            foreach ((array) $response->json('data', []) as $i => $ticket) {
                if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered' && isset($tokens[$i])) {
                    PushToken::where('token', $tokens[$i])->delete();
                }
            }

            PushToken::whereIn('token', $tokens)->update(['last_used_at' => now()]);
        } catch (\Throwable $e) {
            Log::warning('Expo push error: ' . $e->getMessage());
        }
    }
}
