import { Link } from '@inertiajs/react';

/**
 * AppLogo — shared logo component used in every dashboard layout and auth screen.
 *
 * variant="dark"  → black icon + "Property" / "Basket" stacked in dark ink text
 *                   Use on white / light-gray backgrounds (sidebars, public nav)
 *
 * variant="white" → white icon + "Property" / "Basket" stacked in white text
 *                   Use on dark / coloured backgrounds (auth left-panel mesh)
 *
 * Both variants render the icon PNG + a two-line text block so the visual size
 * is predictable regardless of any padding inside the icon file.
 *
 * Pass `href` to make the whole logo a link (e.g. dashboards link back to the
 * public home page). Without `href` it renders as a plain, non-clickable mark.
 */
type Props = {
    variant?: 'dark' | 'white';
    /** Height of the icon in px. Text scales to match. Defaults to 32. */
    height?: number;
    /** If set, the logo becomes a link to this URL (Inertia navigation). */
    href?: string;
};

export default function AppLogo({ variant = 'dark', height = 32, href }: Props) {
    const isWhite = variant === 'white';
    const iconSrc = isWhite ? '/images/logo-icon-white.png' : '/images/logo-icon.png';
    const textColor = isWhite ? 'text-white' : 'text-ink-900';

    // Each text line should be roughly 45% of the icon height, stacked tight.
    const fontSize = Math.round(height * 0.42);
    // Nudge the two-line wordmark down a touch so its optical centre lines up
    // with the icon (the tight line-box otherwise rides high).
    const nudge = Math.round(height * 0.1);

    const inner = (
        <div className="flex items-center gap-1.5">
            <img
                src={iconSrc}
                alt="Property Basket"
                height={height}
                style={{ height, width: 'auto' }}
                className="shrink-0"
            />
            <div
                className={`flex flex-col leading-none ${textColor}`}
                style={{ gap: 2, transform: `translateY(${nudge}px)` }}
            >
                <span className="font-extrabold tracking-tight" style={{ fontSize, lineHeight: 1 }}>
                    Property
                </span>
                <span className="font-extrabold tracking-tight" style={{ fontSize, lineHeight: 1 }}>
                    Basket
                </span>
            </div>
        </div>
    );

    if (href) {
        return (
            <Link href={href} aria-label="Property Basket — home" className="inline-flex items-center">
                {inner}
            </Link>
        );
    }

    return inner;
}
