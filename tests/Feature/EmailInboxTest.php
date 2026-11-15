<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\EmailAccount;
use App\Models\EmailMessage;
use App\Models\User;
use App\Services\Mail\EmailService;
use App\Services\Mail\Mailbox;
use App\Services\Mail\MailException;
use App\Services\Mail\MimeParser;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Tests\TestCase;

/** Messages → Email: connect a POP3/IMAP mailbox, download, read, reply. */
class EmailInboxTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    private User $owner;

    /** @var array<string, string> uid => raw message on the fake server */
    public array $server = [];

    public ?string $failLogin = null;

    /** @var list<Email> */
    public array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active']);
        $agency->activateSubscription('promo', now()->addYear());

        $this->agent = User::factory()->create(['name' => 'Sipho Dlamini', 'email' => 'sipho@basket.test', 'role' => Role::Agent, 'status' => UserStatus::Active]);
        $this->agent->assignRole('agent');
        AgencyAgent::create(['agency_id' => $agency->id, 'user_id' => $this->agent->id, 'commission_split_percent' => 50, 'lead_allocation_position' => 0,
            'ffc_number' => 'FFC-1', 'ffc_certificate_path' => 'ffc/1.pdf', 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        $test = $this;
        $this->app->instance(EmailService::class, new class($test) extends EmailService {
            public function __construct(private EmailInboxTest $t)
            {
                parent::__construct(new MimeParser);
            }

            public function openMailbox(\App\Models\EmailAccount $account): Mailbox
            {
                if ($this->t->failLogin) {
                    throw new MailException($this->t->failLogin);
                }

                return new class($this->t) implements Mailbox {
                    public function __construct(private EmailInboxTest $t) {}

                    public function fetchNew(int $limit, callable $known): array
                    {
                        return array_filter($this->t->server, fn ($uid) => ! $known($uid), ARRAY_FILTER_USE_KEY);
                    }

                    public function close(): void {}
                };
            }

            public function checkSmtp(\App\Models\EmailAccount $account): void {}

            public function transport(\App\Models\EmailAccount $account): TransportInterface
            {
                return new class($this->t) implements TransportInterface {
                    public function __construct(private EmailInboxTest $t) {}

                    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
                    {
                        $this->t->sent[] = $message;

                        return new SentMessage($message, $envelope ?? Envelope::create($message));
                    }

                    public function __toString(): string
                    {
                        return 'fake://';
                    }
                };
            }
        });
    }

    private function connectPayload(array $over = []): array
    {
        return $over + [
            'email' => 'sipho@basket.test', 'display_name' => 'Sipho Dlamini', 'protocol' => 'pop3',
            'incoming_host' => 'pop.gmail.com', 'incoming_port' => 995, 'incoming_encryption' => 'ssl',
            'username' => 'sipho@basket.test', 'password' => 'app-pass-123',
            'smtp_host' => 'smtp.gmail.com', 'smtp_port' => 465, 'smtp_encryption' => 'ssl',
        ];
    }

    private function raw(string $from, string $subject, string $body, string $id): string
    {
        return "From: {$from}\r\nTo: Sipho <sipho@basket.test>\r\nSubject: {$subject}\r\nDate: Mon, 9 Nov 2026 10:15:00 +0200\r\nMessage-ID: <{$id}>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{$body}\r\n";
    }

    #[Test]
    public function an_agent_connects_a_pop3_mailbox_and_reads_mail(): void
    {
        $this->server['pop:a'] = $this->raw('"Thandi Buyer" <thandi@example.com>', 'Viewing on Saturday?', 'Is 12 Kloof Road still available?', 'm1@example.com');

        $this->actingAs($this->agent)->get('/agent/messages/email')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Messages/Email')->where('account', null)->where('role', 'agent'));

        $this->actingAs($this->agent)->post('/agent/messages/email/account', $this->connectPayload())
            ->assertSessionHas('success', fn ($m) => str_contains($m, '1 message'));

        $account = EmailAccount::firstOrFail();
        $this->assertSame('app-pass-123', $account->password);
        $this->assertNotSame('app-pass-123', \DB::table('email_accounts')->value('password'), 'password is encrypted at rest');

        $msg = EmailMessage::firstOrFail();
        $this->assertSame('thandi@example.com', $msg->from_email);
        $this->assertSame('Thandi Buyer', $msg->from_name);
        $this->assertNull($msg->read_at);

        $this->actingAs($this->agent)->get('/agent/messages')->assertInertia(fn (Assert $p) => $p->where('unread_email', 1));
        $this->actingAs($this->agent)->get("/agent/messages/email?message={$msg->id}")
            ->assertInertia(fn (Assert $p) => $p->where('open.subject', 'Viewing on Saturday?')->where('open.text', 'Is 12 Kloof Road still available?')->where('messages.0.who', 'Thandi Buyer'));
        $this->assertNotNull($msg->fresh()->read_at);

        // Check mail again: only new messages are added.
        $this->server['pop:b'] = $this->raw('owner@example.com', 'Mandate', 'Signed.', 'm2@example.com');
        $this->actingAs($this->agent)->post('/agent/messages/email/sync')->assertSessionHas('success', '1 new message.');
        $this->actingAs($this->agent)->post('/agent/messages/email/sync')->assertSessionHas('success', 'No new mail.');
        $this->assertSame(2, EmailMessage::count());
    }

    #[Test]
    public function a_failed_login_is_shown_and_nothing_is_saved(): void
    {
        $this->failLogin = 'The mail server rejected the username or password.';
        $this->actingAs($this->agent)->post('/agent/messages/email/account', $this->connectPayload())
            ->assertSessionHasErrors('connection');
        $this->assertSame(0, EmailAccount::count());
    }

    #[Test]
    public function replying_sends_from_the_mailbox_and_keeps_a_sent_copy(): void
    {
        $this->server['pop:a'] = $this->raw('thandi@example.com', 'Viewing', 'Saturday?', 'm1@example.com');
        $this->actingAs($this->agent)->post('/agent/messages/email/account', $this->connectPayload());
        $in = EmailMessage::firstOrFail();

        $this->actingAs($this->agent)->post('/agent/messages/email/send', ['to' => 'thandi@example.com', 'subject' => 'Re: Viewing', 'body' => 'Yes, 10am works.', 'reply_to' => $in->id])
            ->assertSessionHas('success', 'Email sent.');

        $this->assertCount(1, $this->sent);
        $email = $this->sent[0];
        $this->assertSame('sipho@basket.test', $email->getFrom()[0]->getAddress());
        $this->assertSame('<m1@example.com>', $email->getHeaders()->get('In-Reply-To')->getBodyAsString());
        $sent = EmailMessage::where('folder', 'sent')->firstOrFail();
        $this->assertSame('Yes, 10am works.', $sent->body_text);

        $this->actingAs($this->agent)->post('/agent/messages/email/send', ['to' => 'not-an-email', 'subject' => 'x', 'body' => 'y'])->assertSessionHasErrors('to');
    }

    #[Test]
    public function mailboxes_are_private_and_disconnect_removes_copies(): void
    {
        $this->server['pop:a'] = $this->raw('thandi@example.com', 'Private', 'Secret', 'm1@example.com');
        $this->actingAs($this->agent)->post('/agent/messages/email/account', $this->connectPayload());
        $id = EmailMessage::firstOrFail()->id;

        // The agency owner has no mailbox and cannot open the agent's mail.
        $this->actingAs($this->owner)->get("/agency/messages/email?message={$id}")
            ->assertInertia(fn (Assert $p) => $p->where('account', null)->where('open', null)->where('role', 'agency'));

        $this->actingAs($this->agent)->delete('/agent/messages/email/account')->assertRedirect('/agent/messages/email');
        $this->assertSame(0, EmailAccount::count());
        $this->assertSame(0, EmailMessage::count());
    }

    #[Test]
    public function the_parser_handles_multipart_encodings_and_attachments(): void
    {
        $raw = implode("\r\n", [
            'From: =?UTF-8?B?Wm9kd2EgTmtvc2k=?= <zodwa@example.co.za>',
            'To: a@example.com, "Smith, John" <john@example.com>',
            'Subject: =?ISO-8859-1?Q?Caf=E9_offer?=',
            'Message-ID: <abc@example.co.za>',
            'Content-Type: multipart/mixed; boundary="OUTER"',
            '',
            '--OUTER',
            'Content-Type: multipart/alternative; boundary="INNER"',
            '',
            '--INNER',
            'Content-Type: text/plain; charset=utf-8',
            'Content-Transfer-Encoding: quoted-printable',
            '',
            'Offer of R1 250 000 =E2=80=93 see attached.',
            '--INNER',
            'Content-Type: text/html; charset=utf-8',
            'Content-Transfer-Encoding: base64',
            '',
            base64_encode('<p>Offer of <b>R1 250 000</b></p>'),
            '--INNER--',
            '--OUTER',
            'Content-Type: application/pdf; name="OTP.pdf"',
            'Content-Disposition: attachment; filename="OTP.pdf"',
            'Content-Transfer-Encoding: base64',
            '',
            base64_encode('%PDF-1.4 fake'),
            '--OUTER--',
            '',
        ]);

        $p = (new MimeParser)->parse($raw);
        $this->assertSame('Zodwa Nkosi', $p['from_name']);
        $this->assertSame('zodwa@example.co.za', $p['from_email']);
        $this->assertSame('Café offer', $p['subject']);
        $this->assertSame('Offer of R1 250 000 – see attached.', $p['text']);
        $this->assertSame('<p>Offer of <b>R1 250 000</b></p>', $p['html']);
        $this->assertSame([['email' => 'a@example.com', 'name' => null], ['email' => 'john@example.com', 'name' => 'Smith, John']], $p['to']);
        $this->assertSame('OTP.pdf', $p['attachments'][0]['name']);
        $this->assertSame('abc@example.co.za', $p['message_id']);
    }
}
