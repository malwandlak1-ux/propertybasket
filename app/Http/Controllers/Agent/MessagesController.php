<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MessagesController extends Controller
{
    use ResolvesAgent;

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $activeId    = $request->integer('conversation_id', 0);

        // All conversations this agent participates in
        $conversations = Conversation::whereJsonContains('participants', $user->id)
            ->with(['messages' => fn ($q) => $q->orderByDesc('created_at')->take(1)])
            ->orderByDesc('updated_at')
            ->get()
            ->map(function ($c) use ($user) {
                $last = $c->messages->first();
                $participants = is_array($c->participants) ? $c->participants : json_decode($c->participants, true) ?? [];
                $others = array_filter($participants, fn ($id) => $id !== $user->id);
                return [
                    'id'          => $c->id,
                    'type'        => $c->type,
                    'preview'     => $last?->body ? mb_strimwidth($last->body, 0, 55, '…') : 'No messages yet',
                    'updated_at'  => $last?->created_at?->diffForHumans(short: true) ?? '',
                    'unread_count'=> Message::where('conversation_id', $c->id)
                        ->where('sender_id', '!=', $user->id)
                        ->whereNull('read_at')
                        ->count(),
                    'other_ids'   => array_values($others),
                ];
            });

        // Enrich with user names
        $allParticipantIds = $conversations->flatMap(fn ($c) => $c['other_ids'])->unique()->values();
        $users = \App\Models\User::whereIn('id', $allParticipantIds)
            ->get(['id', 'name'])
            ->keyBy('id');

        $conversations = $conversations->map(function ($c) use ($users) {
            $otherNames = collect($c['other_ids'])->map(fn ($id) => $users[$id]?->name ?? '?');
            $initials = $otherNames->first()
                ? collect(explode(' ', $otherNames->first()))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode('')
                : '?';
            return array_merge($c, [
                'title'   => $otherNames->implode(', ') ?: 'Conversation',
                'initials'=> $initials,
            ]);
        });

        // Active conversation
        $active  = null;
        $messages = [];

        if ($activeId) {
            $conv = Conversation::whereJsonContains('participants', $user->id)
                ->find($activeId);

            if ($conv) {
                // Mark messages as read
                Message::where('conversation_id', $conv->id)
                    ->where('sender_id', '!=', $user->id)
                    ->whereNull('read_at')
                    ->update(['read_at' => now()]);

                $participants = is_array($conv->participants) ? $conv->participants : json_decode($conv->participants, true) ?? [];
                $others = collect(array_filter($participants, fn ($id) => $id !== $user->id));
                $otherUsers = \App\Models\User::whereIn('id', $others)->get(['id', 'name'])->keyBy('id');

                $otherNames = $others->map(fn ($id) => $otherUsers[$id]?->name ?? '?');
                $initials = $otherNames->first()
                    ? collect(explode(' ', $otherNames->first()))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode('')
                    : '?';

                $active = [
                    'id'       => $conv->id,
                    'title'    => $otherNames->implode(', ') ?: 'Conversation',
                    'initials' => $initials,
                    'type'     => $conv->type,
                ];

                $allMessages = Message::where('conversation_id', $conv->id)
                    ->with('sender:id,name')
                    ->orderBy('created_at')
                    ->get();

                // Group by date
                $grouped = [];
                foreach ($allMessages as $m) {
                    $day = $m->created_at?->format('Y-m-d');
                    $grouped[$day][] = $m;
                }

                foreach ($grouped as $day => $dayMessages) {
                    $messages[] = ['type' => 'date_divider', 'label' => \Carbon\Carbon::parse($day)->isToday() ? 'Today' : \Carbon\Carbon::parse($day)->format('d M Y')];
                    foreach ($dayMessages as $m) {
                        $messages[] = [
                            'type'        => 'message',
                            'id'          => $m->id,
                            'body'        => $m->body,
                            'sender_id'   => $m->sender_id,
                            'sender_name' => $m->sender?->name,
                            'is_self'     => $m->sender_id === $user->id,
                            'created_at'  => $m->created_at?->format('H:i'),
                        ];
                    }
                }
            }
        }

        return Inertia::render('Agent/Messages', [
            'agent'         => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'conversations' => $conversations->values(),
            'active'        => $active,
            'messages'      => $messages,
        ]);
    }

    public function store(Request $request, Conversation $conversation): \Illuminate\Http\RedirectResponse
    {
        $user = $request->user();

        $request->validate(['body' => 'required|string|max:4000']);

        $participants = is_array($conversation->participants) ? $conversation->participants : json_decode($conversation->participants, true) ?? [];

        if (! in_array($user->id, $participants, true)) {
            abort(403);
        }

        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id'       => $user->id,
            'body'            => $request->input('body'),
        ]);

        $conversation->touch();

        return back();
    }
}
