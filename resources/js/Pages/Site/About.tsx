import { Head, Link } from '@inertiajs/react';
import SiteLayout, { Eyebrow, useSite, useTemplate } from '@/Layouts/SiteLayout';

type Props = { about: string | null; stats: { listings: number; agents: number } };

export default function SiteAbout({ about, stats }: Props) {
    const site = useSite();
    const t = useTemplate();

    return (
        <SiteLayout>
            <Head title="About us" />
            <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-16">
                <Eyebrow>About us</Eyebrow>
                <h1 className={`mt-5 text-[44px] sm:text-[60px] leading-[1.02] ${t.heading}`}>{site.name}</h1>
                {site.tagline && <p className="mt-3 text-[18px] text-ink-500">{site.tagline}</p>}

                <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
                    <div className={`p-5 bg-white border border-black/[0.06] ${t.card}`}>
                        <p className={`text-[40px] leading-none ${t.heading}`}>{stats.listings}</p>
                        <p className="text-[13px] text-ink-600">active listings</p>
                    </div>
                    <div className={`p-5 bg-white border border-black/[0.06] ${t.card}`}>
                        <p className={`text-[40px] leading-none ${t.heading}`}>{stats.agents}</p>
                        <p className="text-[13px] text-ink-600">agents</p>
                    </div>
                </div>

                <div className="mt-10 text-[16px] leading-relaxed text-ink-700 whitespace-pre-line">
                    {about || `${site.name} helps buyers, sellers, landlords and tenants with every step of their property journey.`}
                </div>

                <Link href="/contact" className="inline-flex mt-10 px-6 py-3 rounded-lg bg-ink-900 hover:bg-brand-600 text-white font-semibold text-[14px]">
                    Get in touch
                </Link>
            </section>
        </SiteLayout>
    );
}
