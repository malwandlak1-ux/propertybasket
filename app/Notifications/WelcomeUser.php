<?php

namespace App\Notifications;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent right after a new user account is created.
 * Tailors the body text per role.
 */
class WelcomeUser extends Notification
{
    use Queueable;

    public function __construct(public User $user) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $role  = $this->user->role;
        $url   = url('/dashboard');

        $msg = (new MailMessage)
            ->subject('Welcome to Property Basket')
            ->greeting('Hi ' . $this->user->name . ',')
            ->line('Welcome aboard! Your Property Basket account is ready.');

        // Role-specific guidance
        match (true) {
            $role === Role::AgencyAdmin => $msg
                ->line('As an Agency Admin, your next steps:')
                ->line('• Upload your EAAB FFC certificate for verification')
                ->line('• Invite your agents to set up their accounts')
                ->line('• Configure your VAT details and trust account'),

            $role === Role::Landlord => $msg
                ->line('As a private Landlord, your next steps:')
                ->line('• Complete your FICA verification (ID document upload)')
                ->line('• Add your first property')
                ->line('• Invite your existing tenants to the portal'),

            $role === Role::Contractor => $msg
                ->line('As a Contractor on our marketplace, your next steps:')
                ->line('• Upload your CIPC, tax clearance, and public-liability insurance')
                ->line('• Set your specialities and service areas')
                ->line('• You\'ll see job requests appear once verification is complete'),

            $role === Role::Tenant => $msg
                ->line('You can now pay rent, log maintenance requests, and view your deposit ledger from the Tenant dashboard.'),

            $role === Role::Agent => $msg
                ->line('You\'ll receive new inquiries as the lead-allocation engine routes them to you.'),

            default => $msg,
        };

        return $msg
            ->action('Open your dashboard', $url)
            ->line('Need help? Reply to this email or contact support@propertybasket.co.za')
            ->salutation('— The Property Basket team');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'user_id' => $this->user->id,
            'role'    => $this->user->role?->value,
        ];
    }
}
