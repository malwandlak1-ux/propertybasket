<?php

namespace App\Services\Banking\H2H;

use App\Models\BankLink;
use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Net\SFTP;

/** SFTP to the bank (key or password login), using the link's upload/download folders. */
class SftpTransport implements Transport
{
    private ?SFTP $sftp = null;

    public function __construct(private BankLink $link) {}

    public function put(string $name, string $contents): void
    {
        $path = rtrim($this->link->upload_dir, '/') . '/' . $name;
        // Write under a temporary name, then rename, so the bank never picks up half a file.
        $tmp = $path . '.part';
        if (! $this->sftp()->put($tmp, $contents) || ! $this->sftp()->rename($tmp, $path)) {
            throw new BankLinkException("Couldn’t upload {$name} to the bank’s server.");
        }
    }

    public function list(): array
    {
        $names = $this->sftp()->nlist(rtrim($this->link->download_dir, '/') ?: '/');
        if ($names === false) {
            throw new BankLinkException('Couldn’t read the bank’s download folder.');
        }

        return array_values(array_filter($names, fn ($n) => ! in_array($n, ['.', '..'], true) && ! str_ends_with($n, '.part')));
    }

    public function get(string $name): string
    {
        $data = $this->sftp()->get(rtrim($this->link->download_dir, '/') . '/' . $name);
        if ($data === false) {
            throw new BankLinkException("Couldn’t download {$name} from the bank’s server.");
        }

        return $data;
    }

    private function sftp(): SFTP
    {
        if ($this->sftp) {
            return $this->sftp;
        }
        if (! class_exists(SFTP::class)) {
            throw new BankLinkException('The SFTP library isn’t installed on this server (composer require phpseclib/phpseclib).');
        }
        $sftp = new SFTP($this->link->sftp_host, $this->link->sftp_port ?: 22, 20);
        $secret = filled($this->link->sftp_private_key)
            ? PublicKeyLoader::load($this->link->sftp_private_key, $this->link->sftp_password ?: false)
            : (string) $this->link->sftp_password;
        try {
            $ok = $sftp->login($this->link->sftp_username, $secret);
        } catch (\Throwable $e) {
            throw new BankLinkException('Couldn’t connect to the bank’s server: ' . $e->getMessage(), previous: $e);
        }
        if (! $ok) {
            throw new BankLinkException('The bank’s server refused the login (check the username and key).');
        }

        return $this->sftp = $sftp;
    }
}
