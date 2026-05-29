import { ReactNode, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';

type Props = { children: ReactNode };

type SharedProps = { auth?: { user?: { id: number; name: string; role: string } | null } };

export default function PublicLayout({ children }: Props) {
    const { auth } = usePage<SharedProps>().props;
    const user = auth?.user;
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-ink-50 text-ink-900">
            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-ink-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-end justify-between gap-3">
                    <Link href="/" className="shrink-0 self-end">
                        {/* 5× smaller than before: 114 → 24 on desktop, 56 → 22 on mobile */}
                        <span className="md:hidden inline-block"><AppLogo height={22} /></span>
                        <span className="hidden md:inline-block"><AppLogo height={24} /></span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-7 text-[14px] font-medium text-ink-700">
                        <Link href="/properties" className="hover:text-ink-900">Properties</Link>
                        <Link href="/agencies" className="hover:text-ink-900">Agencies</Link>
                        <Link href="/advice" className="hover:text-ink-900">Advice</Link>
                        {user && <Link href="/contractors" className="hover:text-ink-900">Contractors</Link>}
                    </nav>

                    <div className="hidden md:flex items-center gap-3 text-[14px]">
                        {user ? (
                            <Link
                                href="/dashboard"
                                className="px-4 py-2 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 transition"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link href="/login" className="text-ink-700 hover:text-ink-900 font-medium">
                                    Sign in
                                </Link>
                                <Link
                                    href="/register"
                                    className="px-4 py-2 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 transition"
                                >
                                    Get started
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Hamburger — mobile only */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-ink-100 transition"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <svg className="w-6 h-6 text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            {menuOpen
                                ? <path d="M6 6l12 12M18 6l-12 12"/>
                                : <path d="M3 6h18M3 12h18M3 18h18"/>}
                        </svg>
                    </button>
                </div>

                {/* Mobile dropdown menu */}
                {menuOpen && (
                    <nav className="md:hidden border-t border-ink-200 bg-white px-4 py-3 space-y-1">
                        <Link href="/properties" className="block px-3 py-2 rounded-lg text-[14px] hover:bg-ink-100">Properties</Link>
                        <Link href="/agencies" className="block px-3 py-2 rounded-lg text-[14px] hover:bg-ink-100">Agencies</Link>
                        <Link href="/advice" className="block px-3 py-2 rounded-lg text-[14px] hover:bg-ink-100">Advice</Link>
                        {user && <Link href="/contractors" className="block px-3 py-2 rounded-lg text-[14px] hover:bg-ink-100">Contractors</Link>}
                        <div className="border-t border-ink-200 my-2" />
                        {user ? (
                            <Link href="/dashboard" className="block text-center px-4 py-2 rounded-lg bg-ink-900 text-white font-semibold">
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link href="/login" className="block px-3 py-2 rounded-lg text-[14px] hover:bg-ink-100">Sign in</Link>
                                <Link href="/register" className="block text-center px-4 py-2 mt-1 rounded-lg bg-ink-900 text-white font-semibold">
                                    Get started
                                </Link>
                            </>
                        )}
                    </nav>
                )}
            </header>

            <main className="flex-1">{children}</main>

            <SiteFooter />
        </div>
    );
}

function SiteFooter() {
    const [email, setEmail]     = useState('');
    const [subscribed, setSubscribed] = useState(false);

    function subscribe(e: React.FormEvent) {
        e.preventDefault();
        // No newsletter backend yet — confirm visually so the UI feels alive.
        if (! email) return;
        setSubscribed(true);
        setEmail('');
        setTimeout(() => setSubscribed(false), 4000);
    }

    function scrollTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const linkCls = 'block text-[13px] text-white/80 hover:text-white transition';

    return (
        <footer className="bg-[#3D3D3D] text-white mt-16">
            {/* Upper block */}
            <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
                {/* Brand */}
                <div>
                    <img
                        src="/images/logo-icon-white.png"
                        alt="Property Basket"
                        className="h-24 w-auto"
                    />
                    <p className="mt-4 text-[13px] text-white/80">Your All-inclusive property portal</p>
                </div>

                {/* Quick Links */}
                <div>
                    <h3 className="text-[18px] font-bold mb-6">Quick Links</h3>
                    <div className="space-y-3">
                        <Link href="/" className={linkCls}>Board</Link>
                        <Link href="/news" className={linkCls}>News updates</Link>
                        <Link href="/agencies" className={linkCls}>Agents</Link>
                        <Link href="/privacy" className={linkCls}>Privacy Policy</Link>
                    </div>
                </div>

                {/* Contact + Newsletter */}
                <div>
                    <h3 className="text-[15px] font-semibold mb-4">We would like to hear from you</h3>
                    <div className="space-y-3 text-[13px] text-white/80">
                        <a href="tel:+27615868633" className="flex items-center gap-2 hover:text-white transition">
                            <svg className="w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            +27 61 586 8633
                        </a>
                        <a href="mailto:info@propertybasket.co.za" className="flex items-center gap-2 hover:text-white transition">
                            <svg className="w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <rect x="3" y="5" width="18" height="14" rx="2"/>
                                <path d="M3 7l9 6 9-6"/>
                            </svg>
                            info@propertybasket.co.za
                        </a>
                        <Link href="/contact" className="inline-block font-bold text-white hover:underline">
                            Contact us
                        </Link>
                    </div>

                    <h3 className="text-[18px] font-bold mt-8 mb-3">Newsletter</h3>
                    <form onSubmit={subscribe} className="flex gap-2">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            className="flex-1 bg-white text-ink-900 placeholder:text-ink-400 rounded-md px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-white/30"
                        />
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-ink-900 hover:bg-ink-800 text-white rounded-md text-[14px] font-semibold transition"
                        >
                            Submit
                        </button>
                    </form>
                    <p className="text-[12px] text-white/70 mt-3">
                        {subscribed ? "Thanks — we'll keep you posted." : 'Sign up to our newsletter.'}
                    </p>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="bg-[#2A2A2A]">
                <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-3 items-center gap-4">
                    <p className="text-[12px] text-white/70 col-span-3 sm:col-span-1 order-3 sm:order-1 text-center sm:text-left">
                        © Property Basket — All rights reserved
                    </p>

                    <div className="col-span-3 sm:col-span-1 flex justify-center order-1 sm:order-2">
                        <Link href="/" aria-label="Property Basket home">
                            <img src="/images/logo-icon-white.png" alt="Property Basket" className="h-7 w-auto" />
                        </Link>
                    </div>

                    <div className="col-span-3 sm:col-span-1 flex items-center justify-center sm:justify-end gap-3 order-2 sm:order-3">
                        <SocialIcon href="https://facebook.com" label="Facebook">
                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                        </SocialIcon>
                        <SocialIcon href="https://instagram.com" label="Instagram">
                            <rect x="3" y="3" width="18" height="18" rx="5"/>
                            <circle cx="12" cy="12" r="3.5"/>
                            <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>
                        </SocialIcon>
                        <SocialIcon href="https://youtube.com" label="YouTube">
                            <path d="M22 8s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C16.2 5 12 5 12 5s-4.2 0-7.1.1c-.4 0-1.3 0-2.1.9C2.2 6.6 2 8 2 8s-.2 1.6-.2 3.2v1.5C1.8 14.4 2 16 2 16s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 7.3.2 7.3.2s4.2 0 7.1-.1c.4 0 1.3 0 2.1-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22.2 9.6 22 8 22 8z"/>
                            <path d="M10 9.3v5.4l5-2.7z" fill="currentColor"/>
                        </SocialIcon>
                        <SocialIcon href="https://wa.me/27615868633" label="WhatsApp">
                            <path d="M20.5 3.5A10 10 0 0 0 3.4 16.4L2 22l5.7-1.5A10 10 0 1 0 20.5 3.5z"/>
                            <path d="M8 8c-.3 0-.7 0-1 .4-.4.4-1.3 1.2-1.3 3 0 1.7 1.3 3.5 1.5 3.7.2.3 2.5 3.9 6.3 5.3 3 1.1 3.6.9 4.3.8.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.2-.4-.3-.8-.5-.4-.2-2.2-1.1-2.6-1.2-.3-.1-.6-.2-.8.2-.3.4-1 1.2-1.2 1.4-.2.2-.4.3-.8.1-.4-.2-1.5-.5-2.9-1.8-1.1-1-1.8-2.2-2-2.6-.2-.4 0-.6.2-.8.2-.2.4-.4.6-.7.2-.2.3-.4.4-.7.1-.3.1-.5 0-.7-.1-.2-.8-1.9-1-2.6-.3-.7-.5-.6-.7-.6z" fill="currentColor"/>
                        </SocialIcon>
                        <SocialIcon href="#" label="X">
                            <path d="M4 4l16 16M20 4L4 20"/>
                        </SocialIcon>

                        <button
                            onClick={scrollTop}
                            aria-label="Back to top"
                            className="ml-4 w-8 h-8 rounded-full border border-white/30 hover:border-white hover:bg-white/10 flex items-center justify-center transition"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                                <path d="M18 15l-6-6-6 6"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
    return (
        <a
            href={href}
            aria-label={label}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full border border-white/30 hover:border-white hover:bg-white/10 flex items-center justify-center transition"
        >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                {children}
            </svg>
        </a>
    );
}
