<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class MessagesController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $user = $request->user();

        $this->ensureDirectThreadsExist($agency, $user);

        // Anything the admin participates in
        $conversations = $this->conversationsForUser($user);

        $activeId = $request->integer('conversation_id') ?: $conversations->first()?->id;
        $active = $activeId ? $conversations->firstWhere('id', $activeId) : null;

        $messages = collect();
        if ($active) {
            $messages = Message::where('conversation_id', $active->id)
                ->with('sender:id,name')
                ->orderBy('created_at')
                ->get()
                ->map(fn ($m) => [
                    'id' => $m->id,
                    'body' => $m->body,
                    'sender_id' => $m->sender_id,
                    'sender_name' => $m->sender?->name,
                    'is_self' => (int) $m->sender_id === (int) $user->id,
                    'created_at' => $m->created_at?->format('H:i'),
                    'created_on' => $m->created_at?->format('D · H:i'),
                ]);

            // Mark messages from others as read
            Message::where('conversation_id', $active->id)
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        }

        $agents = $agency->agents()->select('users.id', 'users.name')->orderBy('name')->get();

        return Inertia::render('Agency/Messages', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'me' => ['id' => $user->id, 'name' => $user->name],
            'conversations' => $conversations->map(fn ($c) => $this->formatConversation($c, $user, $agency))->values(),
            'active' => $active ? $this->formatConversation($active, $user, $agency) : null,
            'messages' => $messages,
            'agents' => $agents,
        ]);
    }

    public function store(Request $request, Conversation $conversation): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $user = $request->user();
        $this->ensureMember($conversation, $user);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'body' => $data['body'],
        ]);

        $conversation->touch();

        return redirect()->route('agency.messages.index', ['conversation_id' => $conversation->id]);
    }

    public function broadcast(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $user = $request->user();

        $data = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $broadcast = $this->findOrCreateBroadcast($agency, $user);

        Message::create([
            'conversation_id' => $broadcast->id,
            'sender_id' => $user->id,
            'body' => $data['body'],
        ]);
        $broadcast->touch();

        return redirect()->route('agency.messages.index', ['conversation_id' => $broadcast->id])
            ->with('success', 'Broadcast sent to '.($broadcast->participants ? count($broadcast->participants) - 1 : 0).' agents.');
    }

    private function conversationsForUser(User $user)
    {
        // MySQL doesn't have JSON-contains helper everywhere — filter in PHP
        return Conversation::query()
            ->where('type', 'agency_agent')
            ->orderByDesc('updated_at')
            ->get()
            ->filter(fn ($c) => in_array($user->id, $c->participants ?? [], true))
            ->values();
    }

    private function ensureDirectThreadsExist(Agency $agency, User $admin): void
    {
        $agentIds = $agency->agents()->pluck('users.id')->all();

        foreach ($agentIds as $agentId) {
            $existing = $this->conversationsForUser($admin)
                ->first(fn ($c) => count($c->participants) === 2
                    && in_array($agentId, $c->participants, true));

            if ($existing) {
                continue;
            }

            Conversation::create([
                'type' => 'agency_agent',
                'participants' => [(int) $admin->id, (int) $agentId],
            ]);
        }
    }

    private function findOrCreateBroadcast(Agency $agency, User $admin): Conversation
    {
        $agentIds = $agency->agents()->pluck('users.id')->all();
        $participants = collect([$admin->id])->merge($agentIds)->unique()->values()->all();

        $existing = Conversation::where('type', 'agency_agent')
            ->orderByDesc('updated_at')
            ->get()
            ->first(fn ($c) => count($c->participants) >= 3
                && in_array($admin->id, $c->participants, true)
                && count(array_intersect($agentIds, $c->participants)) === count($agentIds));

        return $existing ?? Conversation::create([
            'type' => 'agency_agent',
            'participants' => $participants,
        ]);
    }

    private function ensureMember(Conversation $conversation, User $user): void
    {
        abort_unless(in_array($user->id, $conversation->participants ?? [], true), 403);
    }

    private function formatConversation(Conversation $c, User $self, Agency $agency): array
    {
        $participants = $c->participants ?? [];
        $isBroadcast = count($participants) >= 3;
        $otherIds = array_values(array_filter($participants, fn ($id) => (int) $id !== (int) $self->id));
        $others = User::whereIn('id', $otherIds)->get(['id', 'name']);

        $lastMessage = Message::where('conversation_id', $c->id)->latest()->first();
        $unread = Message::where('conversation_id', $c->id)
            ->where('sender_id', '!=', $self->id)
            ->whereNull('read_at')
            ->count();

        $title = $isBroadcast
            ? 'Team Broadcast'
            : ($others->first()?->name ?? '—');

        return [
            'id' => $c->id,
            'title' => $title,
            'is_broadcast' => $isBroadcast,
            'participant_ids' => $participants,
            'participant_count' => count($participants),
            'other_initials' => $isBroadcast
                ? '📢'
                : $this->initials($others->first()?->name ?? '?'),
            'preview' => $lastMessage?->body
                ? mb_strimwidth($lastMessage->body, 0, 60, '…')
                : 'No messages yet',
            'updated_at' => $c->updated_at?->diffForHumans(null, true),
            'unread_count' => $unread,
        ];
    }

    private function initials(string $name): string
    {
        return collect(explode(' ', $name))
            ->take(2)
            ->map(fn ($w) => mb_substr($w, 0, 1))
            ->implode('');
    }
}
