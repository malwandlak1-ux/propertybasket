<?php

namespace App\Support;

use App\Models\Inquiry;

/**
 * The lead payload behind a pipeline card and the LeadDetailsModal popup.
 * Shared by the agent pipeline and the viewings calendar so both open the
 * same details. Expects `listing` loaded with id,title,slug,listing_type and
 * the three price columns.
 */
final class PipelineCard
{
    public const LISTING_COLUMNS = 'listing:id,title,slug,listing_type,sale_price,monthly_rent,short_stay_nightly_price';

    public static function from(Inquiry $inq): array
    {
        $listing = $inq->listing;
        $dv = $listing ? (float) match ($listing->listing_type) {
            'for_sale'        => $listing->sale_price ?? 0,
            'long_term_rent'  => ($listing->monthly_rent ?? 0) * 12,
            'short_term_stay' => ($listing->short_stay_nightly_price ?? 0) * 30,
            default           => 0,
        } : 0.0;

        if (! $listing && $inq->deal_value) {
            $dv = (float) $inq->deal_value;
        }

        $at = $inq->viewing_scheduled_at;

        return [
            'id'            => $inq->id,
            'visitor_name'  => $inq->name,
            'email'         => $inq->email,
            'phone'         => $inq->phone,
            'message'       => $inq->message,
            'listing_id'    => $listing?->id,
            'listing_title' => $listing?->title ?? ($inq->source === 'farming' ? 'Seller lead · farming' : null),
            'listing_type'  => $listing?->listing_type,
            'listing_slug'  => $listing?->slug,
            'deal_value'    => $dv,
            'is_hot'        => in_array($inq->status, ['qualified', 'offer'], true) && $dv >= 1_000_000,
            'status'        => $inq->status,
            'source'        => $inq->source,
            'created_at'    => $inq->created_at?->format('d M Y \a\t H:i'),
            'age_label'     => $inq->updated_at?->diffForHumans() ?? '—',
            'viewing_at'    => $at?->format('D d M · H:i'),
            'viewing_date'  => $at?->format('Y-m-d'),
            'viewing_time'  => $at?->format('H:i'),
        ];
    }
}
