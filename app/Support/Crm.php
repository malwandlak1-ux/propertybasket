<?php

namespace App\Support;

/**
 * Shared CRM vocabulary — prospect statuses, outreach channels and outcomes —
 * mirrored in resources/js/Components/Crm/constants.ts.
 */
final class Crm
{
    /** Prospect contact statuses, in funnel order (from the farming tracker). */
    public const STATUSES = [
        'not_contacted'    => 'Not contacted',
        'attempted'        => 'Attempted',
        'contacted'        => 'Contacted',
        'interested'       => 'Interested',
        'appraisal_booked' => 'Appraisal booked',
        'listed'           => 'Listed',
        'not_interested'   => 'Not interested',
        'lost'             => 'Lost',
    ];

    /** Statuses a contact outcome may only move a prospect *forward* through. */
    private const FUNNEL = ['not_contacted', 'attempted', 'contacted', 'interested', 'appraisal_booked', 'listed'];

    public const CHANNELS = [
        'call'     => 'Cold call',
        'whatsapp' => 'WhatsApp',
        'sms'      => 'SMS',
        'email'    => 'Email',
        'social'   => 'Social media',
        'letter'   => 'Letter drop',
        'door'     => 'Door knock',
        'referral' => 'Referral',
        'other'    => 'Other',
    ];

    public const OUTCOMES = [
        'sent'           => 'Sent / no reply yet',
        'no_answer'      => 'No answer',
        'connected'      => 'Spoke / replied',
        'interested'     => 'Interested',
        'appointment'    => 'Appraisal booked',
        'not_interested' => 'Not interested',
    ];

    /** Outcomes that mean the owner actually engaged. */
    public const CONNECTED = ['connected', 'interested', 'appointment', 'not_interested'];

    /** Outcomes that count as a positive response. */
    public const POSITIVE = ['interested', 'appointment'];

    /**
     * The status a prospect should move to after a logged contact. Soft
     * outcomes (sent / no answer / spoke) never move a prospect backwards.
     */
    public static function statusAfter(string $current, string $outcome): string
    {
        $target = match ($outcome) {
            'sent', 'no_answer' => 'attempted',
            'connected'         => 'contacted',
            'interested'        => 'interested',
            'appointment'       => 'appraisal_booked',
            'not_interested'    => 'not_interested',
            default             => $current,
        };

        if (in_array($outcome, ['sent', 'no_answer', 'connected'], true)) {
            $from = array_search($current, self::FUNNEL, true);
            $to   = array_search($target, self::FUNNEL, true);
            if ($from === false || $to === false || $to <= $from) {
                return $current;
            }
        }

        return $target;
    }
}
