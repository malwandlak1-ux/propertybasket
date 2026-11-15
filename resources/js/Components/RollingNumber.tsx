import { useEffect, useState } from 'react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * A number whose digits roll to their new value, each on its own 0–9 strip
 * (a bigger digit rolls up, a smaller one down). Columns are keyed from the
 * right, so when the length changes a new digit opens up from zero width and
 * a dropped one closes, and whatever sits beside the number glides along.
 */
export default function RollingNumber({ value, format = (n) => n.toLocaleString('en-ZA'), duration = 600, stagger = 40, className = '' }: {
    value: number;
    format?: (n: number) => string;
    duration?: number;
    stagger?: number;
    className?: string;
}) {
    const chars = format(value).replace(/\s/g, ' ').split('');
    const label = format(value);

    return (
        <span className={`inline-flex tabular-nums leading-none ${className}`} aria-label={label} role="text">
            {chars.map((ch, i) => {
                const fromRight = chars.length - 1 - i;
                return /\d/.test(ch)
                    ? <DigitColumn key={`d${fromRight}`} digit={Number(ch)} duration={duration} delay={i * stagger} />
                    : <Sep key={`s${fromRight}`} ch={ch} />;
            })}
        </span>
    );
}

function useMounted() {
    const [on, setOn] = useState(false);
    useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
    return on;
}

function DigitColumn({ digit, duration, delay }: { digit: number; duration: number; delay: number }) {
    const mounted = useMounted();
    const ease = 'cubic-bezier(.34,1.45,.64,1)'; // a little overshoot, like back.out
    return (
        <span aria-hidden className="relative inline-block overflow-hidden pb-roll"
            style={{ height: '1em', width: mounted ? '0.62em' : 0, transition: `width ${duration}ms ${ease}` }}>
            <span className="absolute left-0 top-0 flex flex-col pb-roll"
                style={{ transform: `translateY(-${digit * 10}%)`, transition: `transform ${duration}ms ${ease} ${delay}ms` }}>
                {DIGITS.map((d) => <span key={d} className="h-[1em] leading-none text-center w-[0.62em]">{d}</span>)}
            </span>
        </span>
    );
}

function Sep({ ch }: { ch: string }) {
    const mounted = useMounted();
    const w = ch === ' ' ? '0.25em' : '0.3em';
    return (
        <span aria-hidden className="inline-block overflow-hidden text-center pb-roll"
            style={{ height: '1em', width: mounted ? w : 0, transition: 'width 400ms ease' }}>{ch === ' ' ? ' ' : ch}</span>
    );
}
