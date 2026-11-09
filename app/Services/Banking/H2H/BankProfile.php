<?php

namespace App\Services\Banking\H2H;

/**
 * Per-bank details for host-to-host payment files. Each bank's spec is confirmed during its
 * onboarding (test phase); these defaults follow ISO 20022 pain.001.001.03 as used in South Africa.
 */
final class BankProfile
{
    private function __construct(
        public readonly string $key,
        public readonly string $name,
        public readonly string $bic,
        public readonly string $universalBranch,
        public readonly string $painVersion,
        public readonly string $fileExtension,
    ) {}

    public static function for(string $bank): self
    {
        return match ($bank) {
            'fnb' => new self('fnb', 'FNB', 'FIRNZAJJ', '250655', 'pain.001.001.03', 'xml'),
            default => throw new \InvalidArgumentException("No host-to-host profile for bank '{$bank}' yet."),
        };
    }

    /** Banks the platform can onboard so far. */
    public static function supported(): array
    {
        return ['fnb' => 'FNB'];
    }
}
