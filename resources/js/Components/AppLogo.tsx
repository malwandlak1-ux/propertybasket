import { Link } from '@inertiajs/react';
import { useBrand } from '@/Hooks/useEdition';

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
 * On a white-label site (edition brand logo set, e.g. careline) the client's
 * own logo image replaces the Property Basket mark; on dark backgrounds it
 * sits on a white chip so its colours stay legible.
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
    const brand = useBrand();
    const isWhite = variant === 'white';

    if (brand.logo) {
        // Wordmark logos read small at icon height — give them a bit more room.
        const h = Math.round(height * 2.2);
        const img = <img src={brand.logo} alt={brand.name} style={{ height: h, width: 'auto' }} className="shrink-0 max-w-[210px] object-contain" />;
        const mark = isWhite ? <span className="inline-flex rounded-xl bg-white px-3 py-2 shadow-soft">{img}</span> : img;
        return href ? (
            <Link href={href} aria-label={`${brand.name} home`} className="inline-flex items-center">{mark}</Link>
        ) : mark;
    }

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
