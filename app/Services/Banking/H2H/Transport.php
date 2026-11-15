<?php

namespace App\Services\Banking\H2H;

/** Moves files to and from a bank's host-to-host server. */
interface Transport
{
    /** Upload a file into the bank's upload directory. */
    public function put(string $name, string $contents): void;

    /** File names waiting in the bank's download directory. @return string[] */
    public function list(): array;

    public function get(string $name): string;
}
