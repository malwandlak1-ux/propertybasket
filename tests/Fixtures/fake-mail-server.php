<?php

/*
 * Scripted one-connection POP3 / IMAP server for SocketMailboxTest.
 * Usage: php fake-mail-server.php <port> <pop3|imap> <password>
 * Serves two messages; prints "READY" once listening.
 */

[$_, $port, $mode, $password] = $argv;
$server = stream_socket_server("tcp://127.0.0.1:{$port}", $errno, $err);
if (! $server) {
    fwrite(STDERR, $err);
    exit(1);
}
echo "READY\n";
fflush(STDOUT);

$msgs = [
    1 => "From: Old <old@example.com>\r\nSubject: First\r\nMessage-ID: <one@x>\r\n\r\nHello one\r\n.dot line\r\n",
    2 => "From: New <new@example.com>\r\nSubject: Second\r\nMessage-ID: <two@x>\r\n\r\nHello two\r\n",
];

$c = stream_socket_accept($server, 15);
$w = fn (string $s) => fwrite($c, $s);

if ($mode === 'pop3') {
    $w("+OK fake POP3\r\n");
    $authed = false;
    while (($l = fgets($c)) !== false) {
        $l = rtrim($l, "\r\n");
        [$cmd, $arg] = array_pad(explode(' ', $l, 2), 2, '');
        switch (strtoupper($cmd)) {
            case 'USER': $w("+OK\r\n"); break;
            case 'PASS':
                $authed = $arg === $password;
                $w($authed ? "+OK logged in\r\n" : "-ERR [AUTH] Invalid credentials\r\n");
                break;
            case 'UIDL':
                $w("+OK\r\n1 uid-one\r\n2 uid-two\r\n.\r\n");
                break;
            case 'RETR':
                $body = preg_replace('/^\./m', '..', $msgs[(int) $arg]);
                $w("+OK\r\n{$body}.\r\n");
                break;
            case 'DELE': $w("-ERR deletes are not expected\r\n"); file_put_contents(__DIR__ . '/../../storage/framework/testing-dele', '1'); break;
            case 'QUIT': $w("+OK bye\r\n"); break 2;
            default: $w("-ERR unknown\r\n");
        }
    }
} else {
    $w("* OK fake IMAP ready\r\n");
    while (($l = fgets($c)) !== false) {
        $l = rtrim($l, "\r\n");
        [$tag, $rest] = explode(' ', $l, 2);
        if (str_starts_with($rest, 'LOGIN')) {
            preg_match('/^LOGIN "((?:[^"\\\\]|\\\\.)*)" "((?:[^"\\\\]|\\\\.)*)"$/', $rest, $m);
            $pass = stripcslashes($m[2] ?? '');
            $w($pass === $password ? "{$tag} OK LOGIN done\r\n" : "{$tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n");
        } elseif ($rest === 'EXAMINE INBOX') {
            $w("* 2 EXISTS\r\n{$tag} OK [READ-ONLY] EXAMINE done\r\n");
        } elseif ($rest === 'UID SEARCH ALL') {
            $w("* SEARCH 41 42\r\n{$tag} OK SEARCH done\r\n");
        } elseif (preg_match('/^UID FETCH (\d+) BODY\.PEEK\[\]$/', $rest, $m)) {
            $raw = $msgs[(int) $m[1] - 40];
            $n = (int) $m[1] - 40;
            $w("* {$n} FETCH (UID {$m[1]} BODY[] {" . strlen($raw) . "}\r\n{$raw})\r\n{$tag} OK FETCH done\r\n");
        } elseif ($rest === 'LOGOUT') {
            $w("* BYE\r\n{$tag} OK LOGOUT done\r\n");
            break;
        } else {
            $w("{$tag} BAD unexpected {$rest}\r\n");
        }
    }
}
fclose($c);
