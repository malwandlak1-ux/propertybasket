<?php

namespace App\Services\WhatsApp;

/**
 * Reads a Meta template's components into what the campaign builder needs:
 * body text, its placeholders in order, and whether the pilot can send it
 * (body variables only — no media headers or dynamic buttons yet).
 */
class TemplateParser
{
    public static function parse(array $components): array
    {
        $body = $header = $footer = null;
        $reason = null;

        foreach ($components as $c) {
            $type = strtoupper($c['type'] ?? '');
            if ($type === 'BODY') {
                $body = $c['text'] ?? '';
            } elseif ($type === 'FOOTER') {
                $footer = $c['text'] ?? null;
            } elseif ($type === 'HEADER') {
                $format = strtoupper($c['format'] ?? 'TEXT');
                if ($format !== 'TEXT') {
                    $reason = 'Has a ' . strtolower($format) . ' header (not supported yet)';
                } else {
                    $header = $c['text'] ?? null;
                    if ($header && str_contains($header, '{{')) {
                        $reason = 'Header has a variable (not supported yet)';
                    }
                }
            } elseif ($type === 'BUTTONS') {
                foreach ($c['buttons'] ?? [] as $b) {
                    $bt = strtoupper($b['type'] ?? '');
                    if (($bt === 'URL' && str_contains($b['url'] ?? '', '{{')) || in_array($bt, ['COPY_CODE', 'OTP', 'CATALOG', 'MPM', 'FLOW'], true)) {
                        $reason = 'Has a dynamic button (not supported yet)';
                    }
                }
            } elseif (in_array($type, ['CAROUSEL', 'LIMITED_TIME_OFFER'], true)) {
                $reason = 'Uses a ' . strtolower($type) . ' (not supported yet)';
            }
        }

        return [
            'body'               => $body,
            'header'             => $header,
            'footer'             => $footer,
            'params'             => self::placeholders((string) $body),
            'sendable'           => $body !== null && $reason === null,
            'unsupported_reason' => $body === null ? 'No body text' : $reason,
        ];
    }

    /** Placeholder names in first-seen order: ["1","2"] or ["owner_name"]. */
    public static function placeholders(string $text): array
    {
        preg_match_all('/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/', $text, $m);

        return array_values(array_unique($m[1]));
    }

    /** Body text with values swapped in, for previews and the message log. */
    public static function render(string $body, array $values): string
    {
        return preg_replace_callback('/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/', fn ($m) => (string) ($values[$m[1]] ?? $m[0]), $body);
    }

    /** The "components" block for a send: body parameters, named or positional. */
    public static function components(array $params, array $values): array
    {
        if (! $params) {
            return [];
        }
        $named = ! ctype_digit((string) $params[0]);

        return [[
            'type'       => 'body',
            'parameters' => array_map(fn ($p) => array_filter([
                'type'           => 'text',
                'parameter_name' => $named ? $p : null,
                'text'           => (string) ($values[$p] ?? ''),
            ], fn ($v) => $v !== null), $params),
        ]];
    }
}
