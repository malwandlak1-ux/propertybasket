<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Models\User;
use App\Notifications\InquiryReceived;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class InquiryService
{
    public function createFromWebsite(array $data): Inquiry
    {
        return DB::transaction(function () use ($data) {
            /** @var Listing $listing */
            $listing = Listing::with('owner')->findOrFail($data['listing_id']);

            $owner = null;
            $allocationMethod = null;

            if ($listing->owner_type === Agency::class) {
                $owner = $this->allocateRoundRobin($listing);
                $allocationMethod = $owner ? 'round_robin' : null;
            } else {
                $owner = $listing->owner?->user;
            }

            $inquiry = Inquiry::create([
                'listing_id' => $listing->id,
                'listing_unit_id' => $data['listing_unit_id'] ?? null,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'message' => $data['message'] ?? null,
                'user_id' => $data['user_id'] ?? null,
                'assigned_to' => $owner?->id,
                'source' => $data['source'] ?? 'website',
                'status' => 'new',
                'allocated_at' => $owner ? now() : null,
                'allocation_method' => $allocationMethod,
            ]);

            $listing->increment('inquiries_count');

            if ($owner) {
                Notification::send($owner, new InquiryReceived($inquiry));
            }

            return $inquiry;
        });
    }

    /**
     * A "Schedule a tour" submission. Routes to the listing's assigned agent
     * when set (falling back to round-robin / owner), records the requested
     * viewing slot, and fires the same InquiryReceived notification so it
     * lands on the agent's dashboard AND their registered email.
     */
    public function createTourRequest(array $data): Inquiry
    {
        return DB::transaction(function () use ($data) {
            /** @var Listing $listing */
            $listing = Listing::with('owner')->findOrFail($data['listing_id']);

            $owner = null;
            $allocationMethod = null;

            if ($listing->owner_type === Agency::class) {
                // Prefer the agent who actually holds this listing.
                if ($listing->agent_id) {
                    $owner = User::find($listing->agent_id);
                    $allocationMethod = 'round_robin';
                }
                if (! $owner) {
                    $owner = $this->allocateRoundRobin($listing);
                    $allocationMethod = $owner ? 'round_robin' : null;
                }
            } else {
                $owner = $listing->owner?->user;
            }

            $inquiry = Inquiry::create([
                'listing_id' => $listing->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'message' => $data['message'] ?? null,
                'user_id' => $data['user_id'] ?? null,
                'assigned_to' => $owner?->id,
                'source' => 'website',
                'status' => 'new',
                'allocated_at' => $owner ? now() : null,
                'allocation_method' => $allocationMethod,
                'viewing_scheduled_at' => $data['viewing_scheduled_at'] ?? null,
            ]);

            $listing->increment('inquiries_count');

            if ($owner) {
                Notification::send($owner, new InquiryReceived($inquiry));
            }

            return $inquiry;
        });
    }

    public function allocateRoundRobin(Listing $listing): ?User
    {
        if ($listing->owner_type !== Agency::class) {
            return null;
        }

        $pivots = AgencyAgent::where('agency_id', $listing->owner_id)
            ->where('status', 'active')
            ->orderBy('lead_allocation_position')
            ->orderBy('id')
            ->get();

        if ($pivots->isEmpty()) {
            // Fall back to the agency owner so leads aren't dropped.
            return $listing->owner?->owner;
        }

        $next = $pivots->first();
        $maxPosition = $pivots->max('lead_allocation_position');
        $next->update(['lead_allocation_position' => $maxPosition + 1]);

        return User::find($next->user_id);
    }
}
