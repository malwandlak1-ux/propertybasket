<?php

namespace App\Notifications;

use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a not-yet-registered person who has been invited (agent, tenant, etc.).
 * The notifiable is an AnonymousNotifiable routed by email.
 */
class UserInvited extends Notification
{
    use Queueable;

    public function __construct(public Invitation $invitation) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url('/invite/' . $this->invitation->token);
        $inviter = $this->invitation->invitedBy?->name ?? 'Property Basket';
        $roleLabel = match ($this->invitation->role) {
            'agent'    => 'agent',
            'tenant'   => 'tenant',
            'landlord' => 'landlord',
            default    => 'team member',
        };

        return (new MailMessage)
            ->subject($inviter . ' has invited you to Property Basket')
            ->greeting('Hi there,')
            ->line($inviter . ' has invited you to join Property Basket as ' . (in_array($roleLabel[0], ['a','e','i','o','u']) ? 'an' : 'a') . ' ' . $roleLabel . '.')
            ->line('Click the button below to set up your account. The invitation expires in 7 days.')
            ->action('Accept invitation', $url)
            ->line('If you weren\'t expecting this invitation, you can safely ignore this email.')
            ->salutation('— The Property Basket team');
    }
}
