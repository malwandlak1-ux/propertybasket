<?php

namespace Tests\Feature;

use App\Models\EmailAccount;
use App\Services\Mail\MailException;
use App\Services\Mail\SocketMailbox;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** The real POP3/IMAP client against a scripted local server. */
class SocketMailboxTest extends TestCase
{
    /** @var resource|null */
    private $proc = null;

    protected function tearDown(): void
    {
        if ($this->proc) {
            proc_terminate($this->proc);
            proc_close($this->proc);
        }
        @unlink(storage_path('framework/testing-dele'));
        parent::tearDown();
    }

    private function serve(string $mode): int
    {
        $port = random_int(20000, 40000);
        $this->proc = proc_open([PHP_BINARY, base_path('tests/Fixtures/fake-mail-server.php'), (string) $port, $mode, 'p@ss "w0rd"'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $this->assertSame("READY\n", fgets($pipes[1]));

        return $port;
    }

    private function account(string $mode, int $port, string $password): EmailAccount
    {
        return new EmailAccount(['protocol' => $mode, 'incoming_host' => '127.0.0.1', 'incoming_port' => $port, 'incoming_encryption' => 'none', 'username' => 'agent@example.com', 'password' => $password]);
    }

    public static function modes(): array
    {
        return [['pop3'], ['imap']];
    }

    #[Test]
    #[DataProvider('modes')]
    public function it_downloads_the_newest_unknown_messages_without_deleting(string $mode): void
    {
        $box = new SocketMailbox($this->account($mode, $this->serve($mode), 'p@ss "w0rd"'));
        $known = [];
        $got = $box->fetchNew(10, function ($uid) use (&$known) { $known[] = $uid; return false; });
        $box->close();

        $this->assertCount(2, $got);
        $raws = array_values($got);
        $this->assertStringContainsString('Subject: Second', $raws[0], 'newest first');
        $this->assertStringContainsString("Hello one\r\n.dot line", $raws[1], 'dot-unstuffing / literal intact');
        $this->assertFileDoesNotExist(storage_path('framework/testing-dele'));
        $this->assertSame($mode === 'imap' ? ['imap:42', 'imap:41'] : array_keys($got), $known);
    }

    #[Test]
    #[DataProvider('modes')]
    public function known_messages_are_skipped(string $mode): void
    {
        $box = new SocketMailbox($this->account($mode, $this->serve($mode), 'p@ss "w0rd"'));
        $first = null;
        $got = $box->fetchNew(10, function ($uid) use (&$first) { $first ??= $uid; return $uid === $first; });
        $box->close();
        $this->assertCount(1, $got);
        $this->assertStringContainsString('Subject: First', array_values($got)[0]);
    }

    #[Test]
    #[DataProvider('modes')]
    public function a_wrong_password_gives_a_clear_error(string $mode): void
    {
        $this->expectException(MailException::class);
        $this->expectExceptionMessage('rejected the username or password');
        new SocketMailbox($this->account($mode, $this->serve($mode), 'nope'));
    }

    #[Test]
    public function an_unreachable_server_gives_a_clear_error(): void
    {
        $this->expectExceptionMessage("Couldn't reach 127.0.0.1 on port 1");
        new SocketMailbox($this->account('pop3', 1, 'x'));
    }
}
