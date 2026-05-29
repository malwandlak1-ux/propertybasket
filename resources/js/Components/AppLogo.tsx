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
 */
type Props = {
    variant?: 'dark' | 'white';
    /** Height of the icon in px. Text scales to match. Defaults to 32. */
    height?: number;
};

export default function AppLogo({ variant = 'dark', height = 32 }: Props) {
    const isWhite = variant === 'white';
    const iconSrc = isWhite ? '/images/logo-icon-white.png' : '/images/logo-icon.png';
    const textColor = isWhite ? 'text-white' : 'text-ink-900';

    // Each text line should be roughly 45% of the icon height, stacked tight.
    const fontSize = Math.round(height * 0.42);

    return (
        <div className="flex items-center gap-1.5">
            <img
                src={iconSrc}
                alt="Property Basket"
                height={height}
                style={{ height, width: 'auto' }}
                className="shrink-0"
            />
            <div className={`flex flex-col leading-none ${textColor}`} style={{ gap: 2 }}>
                <span className="font-extrabold tracking-tight" style={{ fontSize, lineHeight: 1 }}>
                    Property
                </span>
                <span className="font-extrabold tracking-tight" style={{ fontSize, lineHeight: 1 }}>
                    Basket
                </span>
            </div>
        </div>
    );
}
