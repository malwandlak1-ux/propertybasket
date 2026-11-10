import { CSSProperties, PropsWithChildren, ReactNode, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';

/**
 * Layout for generated agency websites (routes/sites.php). Driven by the
 * shared `site` prop (branding, contact, socials, template). The agency's
 * primary colour re-points Tailwind's brand-* ramp on this subtree (buttons,
 * highlights); the secondary colour (`--site-accent`) paints the portal
 * header, feature bands and footer.
 *
 * Templates:
 *  - portal (default): search-led property portal — solid header, photo
 *    hero with tabbed search bar, centred section titles, property-type and
 *    area tiles, "why us" band with lead form, multi-column footer.
 *  - minimal: text-led, white, square edges.
 */

export type SiteTemplate = 'portal' | 'minimal';

export type SiteProps = {
    name: string;
    template: SiteTemplate;
    published: boolean;
    logo: string | null;
    primary_color: string;
    accent_color: string;
    tagline: string | null;
    show_agents: boolean;
    contact: { email: string | null; phone: string | null; address: string | null };
    social_links: Partial<Record<'facebook' | 'instagram' | 'linkedin' | 'x' | 'youtube' | 'tiktok' | 'whatsapp', string>>;
    portal_url: string;
};

type Shared = { site: SiteProps; flash?: { success?: string | null; error?: string | null } };

export function useSite(): SiteProps {
    return usePage<Shared>().props.site;
}

/** Per-template styling knobs — pages read these instead of forking. */
export const TEMPLATE = {
    portal: {
        key: 'portal' as const,
        heading: 'font-light tracking-normal',
        page: 'bg-[#F7F8F9]',
        header: 'bg-[var(--site-accent)] text-white',
        navLink: 'text-white/80 hover:text-white',
        navActive: 'text-white',
        lightLogo: true,
        dark: 'bg-[var(--site-accent)] text-white',
        card: 'rounded-md',
        button: 'rounded-md',
    },
    minimal: {
        key: 'minimal' as const,
        heading: 'font-sans font-semibold tracking-tight',
        page: 'bg-white',
        header: 'bg-white border-b border-ink-200',
        navLink: 'text-ink-600 hover:text-ink-900',
        navActive: 'text-ink-900 font-semibold',
        lightLogo: false,
        dark: 'bg-ink-900 text-white',
        card: 'rounded-none',
        button: 'rounded-none',
    },
};

export function useTemplate() {
    const site = useSite();
    return TEMPLATE[site.template] ?? TEMPLATE.portal;
}

/** Small uppercase label with a short accent rule — used above section titles. */
export function Eyebrow({ children, light = false, className = '' }: { children: ReactNode; light?: boolean; className?: string }) {
    return (
        <div className={className}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${light ? 'text-white/80' : 'text-ink-500'}`}>{children}</p>
            <span className="block mt-2 h-px w-8 bg-brand-500" />
        </div>
    );
}

/** Centred section heading with a muted subtitle (portal style). */
export function SectionTitle({ title, subtitle, light = false }: { title: ReactNode; subtitle?: ReactNode; light?: boolean }) {
    const t = useTemplate();
    return (
        <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className={`text-[30px] sm:text-[38px] leading-tight ${t.heading} ${light ? 'text-white' : 'text-ink-900'}`}>{title}</h2>
            {subtitle && <p className={`mt-2 text-[15px] ${light ? 'text-white/70' : 'text-ink-500'}`}>{subtitle}</p>}
        </div>
    );
}

function brandVars(primary: string, accent: string): CSSProperties {
    const mix = (pct: number, w: string) => `color-mix(in srgb, ${primary} ${pct}%, ${w})`;
    return {
        '--site-primary': primary,
        '--site-accent': accent,
        '--color-brand-50': mix(8, 'white'),
        '--color-brand-100': mix(18, 'white'),
        '--color-brand-200': mix(35, 'white'),
        '--color-brand-300': mix(55, 'white'),
        '--color-brand-400': mix(80, 'white'),
        '--color-brand-500': primary,
        '--color-brand-600': mix(88, 'black'),
        '--color-brand-700': mix(74, 'black'),
        '--color-brand-800': mix(60, 'black'),
        '--color-brand': primary,
    } as CSSProperties;
}

const SOCIAL_LABELS: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X', youtube: 'YouTube', tiktok: 'TikTok',
};

export function SiteLogo({ light = false }: { light?: boolean }) {
    const site = useSite();
    if (site.logo) {
        return (
            <img
                src={site.logo}
                alt={site.name}
                className={`h-10 sm:h-11 w-auto max-w-[190px] object-contain ${light ? 'brightness-0 invert' : ''}`}
            />
        );
    }
    return <span className={`text-[22px] font-semibold leading-none tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>{site.name}</span>;
}

export default function SiteLayout({ children }: PropsWithChildren) {
    const { site, flash } = usePage<Shared>().props;
    const t = TEMPLATE[site.template] ?? TEMPLATE.portal;
    const [open, setOpen] = useState(false);
    const path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';

    const nav = [
        { href: '/', label: 'Home' },
        { href: '/properties?listing_type=for_sale', label: 'Buy' },
        { href: '/properties?listing_type=long_term_rent', label: 'Rent' },
        { href: '/contact?intent=sell', label: 'Sell' },
        ...(site.show_agents ? [{ href: '/agents', label: 'Agents' }] : []),
        { href: '/about', label: 'About' },
    ];
    const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

    const whatsapp = site.social_links.whatsapp?.replace(/[^\d]/g, '').replace(/^0/, '27');
    const socials = Object.entries(site.social_links).filter(([k, v]) => k !== 'whatsapp' && v);

    return (
        <div data-site-template={t.key} style={brandVars(site.primary_color, site.accent_color)} className={`min-h-screen flex flex-col text-ink-900 ${t.page}`}>
            {! site.published && (
                <div className="bg-warning text-white text-center text-[12px] font-semibold py-1.5 px-4">
                    Preview — this website is not published yet. Only you can see it.
                </div>
            )}

            <header className={`sticky top-0 z-30 ${t.header}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[68px] sm:h-[76px] flex items-center gap-6">
                    <Link href="/" className="flex items-center min-w-0">
                        <SiteLogo light={t.lightLogo} />
                    </Link>

                    <nav className="hidden lg:flex items-center gap-6 ml-auto">
                        {nav.map((n) => (
                            <Link key={n.label} href={n.href} className={`text-[14px] font-medium transition ${isActive(n.href) ? t.navActive : t.navLink}`}>
                                {n.label}
                            </Link>
                        ))}
                        <Link href="/contact" className={`ml-2 px-5 py-2.5 text-[14px] font-medium text-white bg-brand-500 hover:bg-brand-600 transition ${t.button}`}>
                            Contact us
                        </Link>
                    </nav>

                    <button
                        type="button"
                        onClick={() => setOpen((o) => ! o)}
                        className={`lg:hidden ml-auto p-2 -mr-2 ${t.lightLogo ? 'text-white' : 'text-ink-800'}`}
                        aria-label="Menu"
                        aria-expanded={open}
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                        </svg>
                    </button>
                </div>
                {open && (
                    <nav className="lg:hidden bg-white text-ink-900 border-t border-black/5 px-4 py-2 flex flex-col shadow-lg">
                        {[...nav, { href: '/contact', label: 'Contact us' }].map((n) => (
                            <Link key={n.label} href={n.href} className="py-3 text-[15px] border-b border-black/5 last:border-0" onClick={() => setOpen(false)}>
                                {n.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </header>

            {(flash?.success || flash?.error) && (
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 mt-4">
                    <div className={`rounded-md px-4 py-3 text-[14px] border ${flash?.error ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-success/10 border-success/30 text-success'}`}>
                        {flash?.error ?? flash?.success}
                    </div>
                </div>
            )}

            <main className="flex-1">{children}</main>

            <footer className={t.dark}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                    <div>
                        <SiteLogo light />
                        {site.tagline && <p className="mt-4 text-[14px] text-white/65 max-w-xs leading-relaxed">{site.tagline}</p>}
                        {site.contact.address && <p className="mt-4 text-[13px] text-white/55">{site.contact.address}</p>}
                    </div>
                    <FooterCol title="Discover">
                        <FooterLink href="/properties?listing_type=for_sale">Properties for sale</FooterLink>
                        <FooterLink href="/properties?listing_type=long_term_rent">Properties to rent</FooterLink>
                        <FooterLink href="/contact?intent=sell">Sell with us</FooterLink>
                        <FooterLink href="/contact?intent=let">Let with us</FooterLink>
                    </FooterCol>
                    <FooterCol title={site.name}>
                        <FooterLink href="/about">About us</FooterLink>
                        {site.show_agents && <FooterLink href="/agents">Our agents</FooterLink>}
                        <FooterLink href="/contact">Contact</FooterLink>
                    </FooterCol>
                    <FooterCol title="Contact us">
                        {site.contact.phone && <a href={`tel:${site.contact.phone}`} className="text-white/75 hover:text-white">{site.contact.phone}</a>}
                        {site.contact.email && <a href={`mailto:${site.contact.email}`} className="text-white/75 hover:text-white break-all">{site.contact.email}</a>}
                        {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-white/75 hover:text-white">WhatsApp</a>}
                        {socials.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                                {socials.map(([k, v]) => (
                                    <a key={k} href={v as string} target="_blank" rel="noopener noreferrer" className="text-white/75 hover:text-white">{SOCIAL_LABELS[k] ?? k}</a>
                                ))}
                            </div>
                        )}
                    </FooterCol>
                </div>
                <div className="border-t border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/55">
                        <span>© {new Date().getFullYear()} {site.name}. All rights reserved.</span>
                        <a href={site.portal_url} target="_blank" rel="noopener" className="hover:text-white/85">Powered by Property Basket</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white mb-4">{title}</p>
            <div className="flex flex-col gap-2.5 text-[14px]">{children}</div>
        </div>
    );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
    return <Link href={href} className="text-white/75 hover:text-white">{children}</Link>;
}
