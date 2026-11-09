<?php

namespace App\Http\Controllers;

use App\Models\EmailAccount;
use App\Models\EmailMessage;
use App\Services\Mail\EmailService;
use App\Services\Mail\MailException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Messages → Email: a user's own mailbox (POP3/IMAP in, SMTP out).
 * Mounted under /agent/messages/email and /agency/messages/email.
 */
class EmailController extends Controller
{
    public function __construct(private EmailService $mail) {}

    public function index(Request $request): Response
    {
        $account = $this->account($request);
        $folder = $request->query('folder') === 'sent' ? 'sent' : 'inbox';
        $search = trim((string) $request->query('q', ''));

        $messages = [];
        $open = null;
        if ($account) {
            $messages = $account->messages()->where('folder', $folder)
                ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                    ->where('subject', 'like', "%{$search}%")
                    ->orWhere('from_email', 'like', "%{$search}%")
                    ->orWhere('from_name', 'like', "%{$search}%")))
                ->orderByDesc('received_at')->orderByDesc('id')
                ->limit(200)
                ->get(['id', 'folder', 'from_email', 'from_name', 'to', 'subject', 'body_text', 'attachments', 'received_at', 'read_at'])
                ->map(fn (EmailMessage $m) => [
                    'id' => $m->id,
                    'who' => $folder === 'sent'
                        ? collect($m->to ?? [])->map(fn ($t) => $t['name'] ?: $t['email'])->implode(', ')
                        : ($m->from_name ?: $m->from_email),
                    'subject' => $m->subject ?: '(no subject)',
                    'preview' => Str::limit(preg_replace('/\s+/', ' ', (string) $m->body_text), 90),
                    'at' => $m->received_at?->timezone('Africa/Johannesburg')->isToday()
                        ? $m->received_at->timezone('Africa/Johannesburg')->format('H:i')
                        : $m->received_at?->timezone('Africa/Johannesburg')->format('d M'),
                    'unread' => $m->read_at === null,
                    'has_attachments' => ! empty($m->attachments),
                ])->all();

            if ($id = $request->integer('message')) {
                $m = $account->messages()->find($id);
                if ($m) {
                    if (! $m->read_at) {
                        $m->update(['read_at' => now()]);
                    }
                    $open = [
                        'id' => $m->id,
                        'folder' => $m->folder,
                        'from_email' => $m->from_email,
                        'from_name' => $m->from_name,
                        'to' => $m->to ?? [],
                        'cc' => $m->cc ?? [],
                        'subject' => $m->subject ?: '(no subject)',
                        'text' => $m->body_text,
                        'html' => $m->body_html,
                        'attachments' => $m->attachments ?? [],
                        'at' => $m->received_at?->timezone('Africa/Johannesburg')->format('D d M Y, H:i'),
                    ];
                }
            }
        }

        $page = [
            'base' => $this->base($request),
            'chatsUrl' => $this->chatsUrl($request),
            'account' => $account ? [
                'email' => $account->email,
                'display_name' => $account->display_name,
                'protocol' => $account->protocol,
                'incoming_host' => $account->incoming_host,
                'last_synced' => $account->last_synced_at?->diffForHumans(),
                'last_error' => $account->last_error,
                'unread' => $account->messages()->where('folder', 'inbox')->whereNull('read_at')->count(),
            ] : null,
            'folder' => $folder,
            'search' => $search,
            'messages' => $messages,
            'open' => $open,
            'defaultEmail' => $request->user()->email,
            'defaultName' => $request->user()->name,
        ];

        return Inertia::render('Messages/Email', $page + ['role' => $request->routeIs('agency.*') ? 'agency' : 'agent']);
    }

    public function connect(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:180'],
            'display_name' => ['nullable', 'string', 'max:120'],
            'protocol' => ['required', Rule::in(EmailAccount::PROTOCOLS)],
            'incoming_host' => ['required', 'string', 'max:180', 'regex:/^[A-Za-z0-9.-]+$/'],
            'incoming_port' => ['required', 'integer', 'between:1,65535'],
            'incoming_encryption' => ['required', Rule::in(EmailAccount::ENCRYPTION)],
            'username' => ['required', 'string', 'max:180'],
            'password' => ['required', 'string', 'max:500'],
            'smtp_host' => ['required', 'string', 'max:180', 'regex:/^[A-Za-z0-9.-]+$/'],
            'smtp_port' => ['required', 'integer', 'between:1,65535'],
            'smtp_encryption' => ['required', Rule::in(EmailAccount::ENCRYPTION)],
            'smtp_username' => ['nullable', 'string', 'max:180'],
            'smtp_password' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $account = EmailAccount::firstOrNew(['user_id' => $user->id]);
        $account->fill($data);

        try {
            $this->mail->check($account);
        } catch (MailException $e) {
            return back()->withErrors(['connection' => $e->getMessage()])->withInput($request->except('password', 'smtp_password'));
        }

        $account->save();
        try {
            $n = $this->mail->sync($account);
        } catch (MailException $e) {
            return back()->with('success', 'Mailbox connected, but the first download failed: ' . $e->getMessage());
        }

        return back()->with('success', "Mailbox connected. {$n} " . Str::plural('message', $n) . ' downloaded.');
    }

    public function disconnect(Request $request): RedirectResponse
    {
        $this->account($request)?->delete();

        return redirect($this->base($request))->with('success', 'Mailbox disconnected. Downloaded copies were removed; nothing was deleted from your mail server.');
    }

    public function sync(Request $request): RedirectResponse
    {
        $account = $this->account($request) ?? abort(404);
        try {
            $n = $this->mail->sync($account);
        } catch (MailException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', $n ? "{$n} new " . Str::plural('message', $n) . '.' : 'No new mail.');
    }

    public function send(Request $request): RedirectResponse
    {
        $account = $this->account($request) ?? abort(404);
        $data = $request->validate([
            'to' => ['required', 'string', 'max:2000'],
            'cc' => ['nullable', 'string', 'max:2000'],
            'subject' => ['required', 'string', 'max:450'],
            'body' => ['required', 'string', 'max:50000'],
            'reply_to' => ['nullable', 'integer'],
        ]);
        $to = $this->emails($data['to']);
        $cc = $this->emails($data['cc'] ?? '');
        if (! $to || $to === false || $cc === false) {
            return back()->withErrors(['to' => 'Enter valid email addresses, separated by commas.']);
        }
        $replyTo = ! empty($data['reply_to']) ? $account->messages()->find($data['reply_to']) : null;

        try {
            $this->mail->send($account, $to, $cc ?: [], $data['subject'], $data['body'], $replyTo);
        } catch (MailException $e) {
            return back()->withErrors(['send' => $e->getMessage()]);
        }

        return back()->with('success', 'Email sent.');
    }

    /** @return list<string>|false */
    private function emails(string $value): array|false
    {
        $list = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $value) ?: [])));
        foreach ($list as $e) {
            if (! filter_var($e, FILTER_VALIDATE_EMAIL)) {
                return false;
            }
        }

        return array_slice($list, 0, 50);
    }

    private function account(Request $request): ?EmailAccount
    {
        return EmailAccount::where('user_id', $request->user()->id)->first();
    }

    private function base(Request $request): string
    {
        return $request->routeIs('agency.*') ? '/agency/messages/email' : '/agent/messages/email';
    }

    private function chatsUrl(Request $request): string
    {
        return $request->routeIs('agency.*') ? '/agency/messages' : '/agent/messages';
    }
}
