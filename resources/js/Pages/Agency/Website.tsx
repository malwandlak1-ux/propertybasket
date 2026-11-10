import { FormEvent, ReactNode, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Card, FlashBanners, PageHeader, Segmented, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';

/**
 * /agency/website — build & run the agency's generated website. Listings
 * aren't managed here: the site shows every available listing automatically,
 * and anything marked sold / rented drops off the site and the portal.
 */

type Template = 'portal' | 'showcase' | 'minimal';

type Website = {
    subdomain: string;
    subdomain_host: string;
    custom_domain: string | null;
    domain_status: 'none' | 'pending' | 'verified' | 'live';
    template: Template;
    status: 'draft' | 'published';
    primary_color: string;
    accent_color: string;
    hero_image: string | null;
    hero_heading: string | null;
    tagline: string | null;
    about: string | null;
    social_links: Partial<Record<string, string>>;
    seo_title: string | null;
    seo_description: string | null;
    show_agents: boolean;
    analytics_id: string | null;
    published_at: string | null;
    url: string;
    preview_url: string;
};

type AgentRow = { id: number; name: string; email: string; avatar: string | null; bio: string | null; show_on_website: boolean };

type Props = {
    agency: { name: string; logo: string | null; email: string | null; phone: string | null };
    website: Website;
    agents: AgentRow[];
    live_listings: number;
    templates: Template[];
    dns: { cname_target: string; server_ip: string | null };
};

type Tab = 'setup' | 'content' | 'agents' | 'domain';

const TEMPLATE_INFO: Record<Template, { name: string; blurb: string }> = {
    portal: { name: 'Portal', blurb: 'Search-led property portal: photo hero with tabbed search, property-type and area tiles, enquiry form.' },
    showcase: { name: 'Showcase', blurb: 'Bright and modern: light photo hero with a highlighted headline, stats, lifestyle and location cards.' },
    minimal: { name: 'Minimal', blurb: 'Text-led, white, square edges and lots of space.' },
};

const SOCIALS = [
    ['facebook', 'Facebook URL'], ['instagram', 'Instagram URL'], ['linkedin', 'LinkedIn URL'],
    ['x', 'X (Twitter) URL'], ['youtube', 'YouTube URL'], ['tiktok', 'TikTok URL'], ['whatsapp', 'WhatsApp number'],
] as const;

// Matches Components/FormField.tsx
const input = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] focus:ring-2 focus:ring-brand/20 focus:border-brand transition outline-none';

export default function AgencyWebsite({ agency, website, agents, live_listings, templates, dns }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const [tab, setTab] = useState<Tab>('setup');
    const live = website.status === 'published';

    const form = useForm({
        subdomain: website.subdomain,
        template: website.template,
        primary_color: website.primary_color,
        accent_color: website.accent_color,
        hero_heading: website.hero_heading ?? '',
        tagline: website.tagline ?? '',
        about: website.about ?? '',
        social_links: { ...website.social_links } as Record<string, string>,
        seo_title: website.seo_title ?? '',
        seo_description: website.seo_description ?? '',
        show_agents: website.show_agents,
        analytics_id: website.analytics_id ?? '',
        hero_image: null as File | null,
        remove_hero: false,
    });

    function save(e?: FormEvent) {
        e?.preventDefault();
        form.post('/agency/website', { preserveScroll: true, forceFormData: true, onSuccess: () => form.setData('hero_image', null) });
    }

    function togglePublish() {
        if (live && ! confirm('Take your website offline? Visitors will see a "not found" page until you publish again.')) return;
        router.post('/agency/website/publish', { publish: ! live }, { preserveScroll: true });
    }

    const [heroPreview, setHeroPreview] = useState<string | null>(website.hero_image);

    return (
        <AgencyLayout agencyName={agency.name} crumb="Website">
            <Head title="Website" />
            <section className="px-4 sm:px-7 py-6 max-w-6xl">
                <PageHeader
                    title="Your website"
                    subtitle="A branded website for your agency. Listings sync automatically, and sold or rented properties come off straight away."
                    actions={
                        <>
                            <a href={live ? website.url : website.preview_url} target="_blank" rel="noopener" className={btnOutline}>
                                {live ? 'View site ↗' : 'Preview ↗'}
                            </a>
                            <button type="button" onClick={togglePublish} className={btnPrimary}>
                                {live ? 'Unpublish' : 'Publish website'}
                            </button>
                        </>
                    }
                />
                <FlashBanners flash={flash} />

                {/* Status strip */}
                <div className="grid gap-3 sm:grid-cols-3 mb-5">
                    <Stat label="Status" value={live ? 'Live' : 'Draft'} tone={live ? 'success' : 'warning'} />
                    <Stat label="Address" value={website.domain_status === 'live' && website.custom_domain ? website.custom_domain : website.subdomain_host} />
                    <Stat label="Listings on site" value={String(live_listings)} />
                </div>

                <div className="mb-5 overflow-x-auto">
                    <Segmented<Tab>
                        value={tab}
                        onChange={setTab}
                        options={[
                            { value: 'setup', label: 'Address & template' },
                            { value: 'content', label: 'Branding & content' },
                            { value: 'agents', label: 'Agents' },
                            { value: 'domain', label: 'Custom domain' },
                        ]}
                    />
                </div>

                {tab === 'setup' && (
                    <form onSubmit={save} className="space-y-5">
                        <Card title="Website address" subtitle="Your free address. You can connect your own domain under Custom domain.">
                            <div className="flex items-stretch max-w-xl">
                                <input
                                    value={form.data.subdomain}
                                    onChange={(e) => form.setData('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    className={`${input} rounded-r-none`}
                                />
                                <span className="px-3 grid place-items-center rounded-r-lg border border-l-0 border-ink-200 bg-ink-50 text-[13px] text-ink-500 whitespace-nowrap">
                                    .{website.subdomain_host.split('.').slice(1).join('.')}
                                </span>
                            </div>
                            {form.errors.subdomain && <p className="text-danger text-[12px] mt-1.5">{form.errors.subdomain}</p>}
                        </Card>

                        <Card title="Template" subtitle="Every template uses your logo, colours, photos and listings.">
                            <div className="grid gap-4 md:grid-cols-3">
                                {templates.map((key) => {
                                    const info = TEMPLATE_INFO[key];
                                    const active = form.data.template === key;
                                    return (
                                        <button
                                            type="button"
                                            key={key}
                                            onClick={() => form.setData('template', key)}
                                            className={`text-left rounded-2xl border-2 overflow-hidden transition ${active ? 'border-brand-500 shadow-lift' : 'border-ink-200 hover:border-ink-300'}`}
                                        >
                                            <TemplateThumb template={key} primary={form.data.primary_color} accent={form.data.accent_color} name={agency.name} />
                                            <div className="p-4">
                                                <p className="font-semibold text-[14px] flex items-center gap-2">
                                                    {info.name}
                                                    {active && <span className="text-[10px] uppercase tracking-wider bg-brand-500 text-white rounded-full px-2 py-0.5">Selected</span>}
                                                </p>
                                                <p className="text-[12.5px] text-ink-500 mt-1">{info.blurb}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <SaveBar processing={form.processing} dirty={form.isDirty} />
                    </form>
                )}

                {tab === 'content' && (
                    <form onSubmit={save} className="space-y-5">
                        <Card title="Brand" subtitle={agency.logo ? 'Your logo comes from Settings → General Profile.' : 'Add a logo under Settings → General Profile — until then your name is shown.'}>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <ColorField label="Primary colour" hint="Buttons, accents, highlights" value={form.data.primary_color} onChange={(v) => form.setData('primary_color', v)} error={form.errors.primary_color} />
                                <ColorField label="Secondary colour" hint="Header, feature bands and footer" value={form.data.accent_color} onChange={(v) => form.setData('accent_color', v)} error={form.errors.accent_color} />
                            </div>
                        </Card>

                        <Card title="Home page">
                            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                                <div className="space-y-4">
                                    <Field label={form.data.template === 'showcase' ? 'Headline — wrap words in *stars* to colour them' : 'Headline'} error={form.errors.hero_heading}>
                                        <input value={form.data.hero_heading} onChange={(e) => form.setData('hero_heading', e.target.value)} placeholder={`Find your next home with ${agency.name}`} className={input} maxLength={160} />
                                    </Field>
                                    <Field label="Tagline" error={form.errors.tagline}>
                                        <input value={form.data.tagline} onChange={(e) => form.setData('tagline', e.target.value)} placeholder="Premium properties. Lasting relationships." className={input} maxLength={200} />
                                    </Field>
                                    <label className="flex items-center gap-2 text-[13px]">
                                        <input type="checkbox" checked={form.data.show_agents} onChange={(e) => form.setData('show_agents', e.target.checked)} className="rounded border-ink-300 text-brand-600" />
                                        Show the "Our people" section and agent pages
                                    </label>
                                </div>
                                <div>
                                    <p className="text-[12px] font-semibold text-ink-700 mb-1.5">Hero photo</p>
                                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-ink-100 grid place-items-center">
                                        {heroPreview ? <img src={heroPreview} alt="" className="w-full h-full object-cover" /> : <span className="text-[12px] text-ink-400">No photo — dark background</span>}
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        <label className={`${btnOutline} cursor-pointer !py-1.5`}>
                                            Upload
                                            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                                                const f = e.target.files?.[0] ?? null;
                                                form.setData((d) => ({ ...d, hero_image: f, remove_hero: false }));
                                                if (f) setHeroPreview(URL.createObjectURL(f));
                                            }} />
                                        </label>
                                        {heroPreview && (
                                            <button type="button" className={`${btnOutline} !py-1.5`} onClick={() => { form.setData((d) => ({ ...d, hero_image: null, remove_hero: true })); setHeroPreview(null); }}>
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-ink-400 mt-1.5">Landscape JPG/PNG/WebP, max 4 MB.</p>
                                    {form.errors.hero_image && <p className="text-danger text-[12px] mt-1">{form.errors.hero_image}</p>}
                                </div>
                            </div>
                        </Card>

                        <Card title="About page">
                            <textarea rows={7} value={form.data.about} onChange={(e) => form.setData('about', e.target.value)} placeholder="Tell visitors who you are, the areas you cover and what makes your service different." className={input} />
                            {form.errors.about && <p className="text-danger text-[12px] mt-1">{form.errors.about}</p>}
                        </Card>

                        <Card title="Social links">
                            <div className="grid gap-4 sm:grid-cols-2">
                                {SOCIALS.map(([key, label]) => (
                                    <Field key={key} label={label} error={(form.errors as Record<string, string>)[`social_links.${key}`]}>
                                        <input
                                            value={form.data.social_links[key] ?? ''}
                                            onChange={(e) => form.setData('social_links', { ...form.data.social_links, [key]: e.target.value })}
                                            placeholder={key === 'whatsapp' ? '082 123 4567' : 'https://'}
                                            className={input}
                                        />
                                    </Field>
                                ))}
                            </div>
                        </Card>

                        <Card title="Search engines" subtitle="How your site appears on Google.">
                            <div className="grid gap-4">
                                <Field label={`Page title (${form.data.seo_title.length}/70)`} error={form.errors.seo_title}>
                                    <input value={form.data.seo_title} onChange={(e) => form.setData('seo_title', e.target.value)} maxLength={70} placeholder={agency.name} className={input} />
                                </Field>
                                <Field label={`Description (${form.data.seo_description.length}/170)`} error={form.errors.seo_description}>
                                    <textarea rows={2} value={form.data.seo_description} onChange={(e) => form.setData('seo_description', e.target.value)} maxLength={170} className={input} />
                                </Field>
                                <Field label="Google Analytics ID (optional)" error={form.errors.analytics_id}>
                                    <input value={form.data.analytics_id} onChange={(e) => form.setData('analytics_id', e.target.value.toUpperCase())} placeholder="G-XXXXXXXXXX" className={`${input} max-w-xs`} />
                                </Field>
                            </div>
                        </Card>

                        <SaveBar processing={form.processing} dirty={form.isDirty} />
                    </form>
                )}

                {tab === 'agents' && (
                    <Card title="Agent profiles" subtitle="Each agent gets a profile page on your site showing their own listings. Agents can also write their bio themselves.">
                        {agents.length === 0 ? (
                            <p className="text-[13px] text-ink-500">No active agents yet.</p>
                        ) : (
                            <div className="divide-y divide-ink-100">
                                {agents.map((a) => <AgentEditor key={a.id} agent={a} />)}
                            </div>
                        )}
                    </Card>
                )}

                {tab === 'domain' && <DomainPanel website={website} dns={dns} />}
            </section>
        </AgencyLayout>
    );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' }) {
    return (
        <div className="bg-white rounded-2xl shadow-soft px-5 py-4">
            <p className="text-[11px] uppercase tracking-wider text-ink-500">{label}</p>
            <p className={`mt-1 text-[16px] font-semibold truncate ${tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : ''}`}>{value}</p>
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="block text-[12px] font-semibold text-ink-700 mb-1.5">{label}</span>
            {children}
            {error && <span className="block text-danger text-[12px] mt-1">{error}</span>}
        </label>
    );
}

function ColorField({ label, hint, value, onChange, error }: { label: string; hint: string; value: string; onChange: (v: string) => void; error?: string }) {
    return (
        <div>
            <p className="text-[12px] font-semibold text-ink-700">{label}</p>
            <p className="text-[11.5px] text-ink-400 mb-1.5">{hint}</p>
            <div className="flex items-center gap-2">
                <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-11 h-11 rounded-lg border border-ink-200 p-1 cursor-pointer" />
                <input value={value} onChange={(e) => onChange(e.target.value)} className={`${input} max-w-[130px] font-mono`} maxLength={7} />
            </div>
            {error && <p className="text-danger text-[12px] mt-1">Use a hex colour like #F26A1B</p>}
        </div>
    );
}

function SaveBar({ processing, dirty }: { processing: boolean; dirty: boolean }) {
    return (
        <div className="flex items-center justify-end gap-3">
            {dirty && <span className="text-[12px] text-ink-500">Unsaved changes</span>}
            <button disabled={processing} className={btnPrimary}>{processing ? 'Saving…' : 'Save changes'}</button>
        </div>
    );
}

/** Miniature of the template using the agency's current colours. */
function TemplateThumb({ template, primary, accent, name }: { template: Template; primary: string; accent: string; name: string }) {
    if (template === 'portal') {
        return (
            <div className="aspect-[16/10] flex flex-col bg-[#F7F8F9]">
                <div className="flex items-center justify-between px-2.5 py-1.5" style={{ background: accent }}>
                    <span className="text-[9px] font-semibold text-white">{name}</span>
                    <span className="flex gap-1 items-center">
                        {[0, 1, 2].map((i) => <span key={i} className="w-3 h-0.5 rounded bg-white/60" />)}
                        <span className="w-5 h-2 rounded-sm" style={{ background: primary }} />
                    </span>
                </div>
                <div className="relative flex-1 flex flex-col items-center justify-center gap-1" style={{ background: `color-mix(in srgb, ${accent} 75%, #94a3b8)` }}>
                    <span className="text-white text-[10px] font-light">Find your place</span>
                    <span className="w-4/5 h-3 rounded-sm bg-white flex items-center justify-end pr-0.5">
                        <span className="w-6 h-2 rounded-sm" style={{ background: primary }} />
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1.5">
                    {[0, 1, 2].map((i) => <span key={i} className="h-4 rounded-sm bg-white border border-black/5" />)}
                </div>
            </div>
        );
    }
    if (template === 'showcase') {
        return (
            <div className="aspect-[16/10] flex flex-col bg-[#F7F8F9]">
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border-b border-black/5">
                    <span className="text-[9px] font-bold text-ink-900">{name}</span>
                    <span className="flex gap-1 items-center">
                        {[0, 1, 2].map((i) => <span key={i} className="w-3 h-0.5 rounded bg-ink-300" />)}
                    </span>
                    <span className="w-6 h-2 rounded-sm" style={{ background: primary }} />
                </div>
                <div className="relative flex-1 px-2.5 py-2 flex flex-col justify-between" style={{ background: 'linear-gradient(90deg,#fff 35%,#dbe7f0)' }}>
                    <span className="text-[10px] font-bold leading-tight text-ink-900">Where <span style={{ color: primary }}>great homes</span><br />meet you</span>
                    <span className="flex">
                        <span className="w-4 h-1.5 rounded-t-sm bg-white" />
                        <span className="w-4 h-1.5 rounded-t-sm" style={{ background: accent }} />
                    </span>
                </div>
                <div className="grid grid-cols-4 gap-1 p-1.5">
                    {[0, 1, 2, 3].map((i) => <span key={i} className="h-4 rounded bg-white border border-black/5" />)}
                </div>
                <span className="mx-1.5 mb-1.5 h-2 rounded" style={{ background: accent }} />
            </div>
        );
    }
    return (
        <div className="aspect-[16/10] p-2.5 flex flex-col gap-1.5 bg-white">
            <div className="flex items-center justify-between border-b border-ink-200 pb-1">
                <span className="text-[9px] font-semibold text-ink-900">{name}</span>
                <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-3 h-0.5 bg-ink-300" />)}</span>
            </div>
            <div className="flex-1 flex flex-col justify-center gap-1">
                <span className="text-[11px] font-semibold text-ink-900 leading-tight">Find your place</span>
                <span className="w-4/5 h-3 border border-ink-300 flex justify-end"><span className="w-6 h-full" style={{ background: primary }} /></span>
            </div>
            <div className="grid grid-cols-3 gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="h-4 bg-ink-50 border border-ink-200" />)}
            </div>
        </div>
    );
}

function AgentEditor({ agent }: { agent: AgentRow }) {
    const form = useForm({ bio: agent.bio ?? '', show_on_website: agent.show_on_website });

    function save(next?: Partial<{ bio: string; show_on_website: boolean }>) {
        form.transform((d) => ({ ...d, ...next }));
        form.patch(`/agency/website/agents/${agent.id}`, { preserveScroll: true });
    }

    return (
        <div className="py-4 grid gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-start">
            <div className="flex items-center gap-3 min-w-0">
                {agent.avatar ? (
                    <img src={agent.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                    <span className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-[13px] font-bold">{agent.name.charAt(0)}</span>
                )}
                <div className="min-w-0">
                    <p className="text-[14px] font-semibold truncate">{agent.name}</p>
                    <p className="text-[12px] text-ink-500 truncate">{agent.email}</p>
                </div>
            </div>
            <textarea
                rows={2}
                value={form.data.bio}
                onChange={(e) => form.setData('bio', e.target.value)}
                placeholder="Short bio shown on their profile page"
                className={input}
            />
            <div className="flex sm:flex-col gap-2 items-end">
                <label className="flex items-center gap-2 text-[12px] whitespace-nowrap">
                    <input
                        type="checkbox"
                        checked={form.data.show_on_website}
                        onChange={(e) => { form.setData('show_on_website', e.target.checked); save({ show_on_website: e.target.checked }); }}
                        className="rounded border-ink-300 text-brand-600"
                    />
                    Show on site
                </label>
                <button type="button" onClick={() => save()} disabled={form.processing || ! form.isDirty} className={`${btnOutline} !py-1.5 !px-3`}>
                    {form.processing ? 'Saving…' : 'Save bio'}
                </button>
            </div>
        </div>
    );
}

function DomainPanel({ website, dns }: { website: Website; dns: Props['dns'] }) {
    const form = useForm({ custom_domain: website.custom_domain ?? '' });
    const [verifying, setVerifying] = useState(false);
    const host = website.custom_domain ?? 'www.youragency.co.za';

    const STATUS: Record<Website['domain_status'], { label: string; cls: string; text: string }> = {
        none: { label: 'Not connected', cls: 'bg-ink-100 text-ink-600', text: 'Using your free address.' },
        pending: { label: 'Waiting for DNS', cls: 'bg-warning/15 text-warning', text: 'Add the DNS record below at your domain provider, then click Verify.' },
        verified: { label: 'Verified — switching on', cls: 'bg-sky-100 text-sky-700', text: 'DNS is pointing to us. Our team is activating your domain and SSL certificate (usually within one business day).' },
        live: { label: 'Live', cls: 'bg-success/15 text-success', text: 'Your website is served on your own domain with HTTPS.' },
    };
    const s = STATUS[website.domain_status];

    return (
        <div className="space-y-5">
            <Card title="Your own domain" subtitle="Already own a domain like youragency.co.za? Point it at your Property Basket website.">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className={`text-[12px] font-semibold rounded-full px-3 py-1 ${s.cls}`}>{s.label}</span>
                    <span className="text-[13px] text-ink-500">{s.text}</span>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); form.post('/agency/website/domain', { preserveScroll: true }); }} className="flex flex-wrap gap-2 max-w-xl">
                    <input value={form.data.custom_domain} onChange={(e) => form.setData('custom_domain', e.target.value)} placeholder="www.youragency.co.za" className={`${input} flex-1 min-w-[220px]`} />
                    <button disabled={form.processing} className={btnPrimary}>{website.custom_domain ? 'Update' : 'Connect domain'}</button>
                </form>
                {form.errors.custom_domain && <p className="text-danger text-[12px] mt-1.5">{form.errors.custom_domain}</p>}
            </Card>

            {website.custom_domain && website.domain_status !== 'live' && (
                <Card title="DNS setup" subtitle="Log in where you bought your domain (e.g. Afrihost, Domains.co.za, Hostinger) and add this record.">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-500">
                                    <th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Name / Host</th><th className="py-2">Points to</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                <tr className="border-t border-ink-100">
                                    <td className="py-2.5 pr-4">CNAME</td>
                                    <td className="py-2.5 pr-4">{host.startsWith('www.') ? 'www' : host}</td>
                                    <td className="py-2.5">{dns.cname_target}</td>
                                </tr>
                                {dns.server_ip && (
                                    <tr className="border-t border-ink-100">
                                        <td className="py-2.5 pr-4">A</td>
                                        <td className="py-2.5 pr-4">@</td>
                                        <td className="py-2.5">{dns.server_ip}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[12px] text-ink-500 mt-3">DNS changes can take a few minutes up to 24 hours to spread.</p>
                    <button
                        type="button"
                        disabled={verifying}
                        onClick={() => { setVerifying(true); router.post('/agency/website/domain/verify', {}, { preserveScroll: true, onFinish: () => setVerifying(false) }); }}
                        className={`${btnPrimary} mt-4`}
                    >
                        {verifying ? 'Checking DNS…' : 'Verify DNS'}
                    </button>
                </Card>
            )}
        </div>
    );
}
