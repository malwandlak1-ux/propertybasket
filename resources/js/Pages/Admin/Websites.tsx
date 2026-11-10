import { Head, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FlashBanners, PageHeader, SectionCard, SummaryStrip, thRowCls } from '@/Components/Dashboard/Charts';

type Site = {
    id: number;
    agency: string | null;
    agency_status: string | null;
    subdomain_host: string;
    custom_domain: string | null;
    domain_status: 'none' | 'pending' | 'verified' | 'live';
    verified_at: string | null;
    status: 'draft' | 'published';
    template: string;
    url: string;
    listings: number;
    leads_30d: number;
};

type Props = {
    sites: Site[];
    stats: { total: number; published: number; queue: number; live_domains: number };
    docroot_hint: string;
};

const DOMAIN_BADGE: Record<Site['domain_status'], string> = {
    none: 'bg-ink-100 text-ink-500',
    pending: 'bg-warning/15 text-warning',
    verified: 'bg-sky-100 text-sky-700',
    live: 'bg-success/15 text-success',
};

export default function AdminWebsites({ sites, stats, docroot_hint }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const queue = sites.filter((s) => s.domain_status === 'verified');

    function markLive(s: Site) {
        if (! confirm(`Have you added ${s.custom_domain} in hPanel (parked on ${docroot_hint}) and issued SSL? Mark it live?`)) return;
        router.post(`/admin/websites/${s.id}/mark-live`, {}, { preserveScroll: true });
    }

    function disconnect(s: Site) {
        if (! confirm(`Stop serving ${s.custom_domain}? The site stays on ${s.subdomain_host}.`)) return;
        router.post(`/admin/websites/${s.id}/disconnect`, {}, { preserveScroll: true });
    }

    return (
        <AdminLayout crumb="Agency websites" section="Accounts">
            <Head title="Agency websites" />
            <div className="px-4 sm:px-7 py-6">
                <PageHeader title="Agency websites" subtitle="Generated agency sites and the custom-domain activation queue." />
                <FlashBanners flash={flash} />

                <SummaryStrip
                    title="Website stats"
                    cells={[
                        { label: 'Domains to activate', value: stats.queue, tone: stats.queue ? 'warning' : undefined },
                        { label: 'Websites', value: stats.total },
                        { label: 'Published', value: stats.published },
                        { label: 'Live custom domains', value: stats.live_domains },
                    ]}
                />

                {queue.length > 0 && (
                    <SectionCard
                        title="Activation queue"
                        subtitle={`For each domain: in Hostinger hPanel add it as a parked domain on ${docroot_hint}, issue the SSL certificate, then click Mark live.`}
                    >
                        <ul className="divide-y divide-ink-100">
                            {queue.map((s) => (
                                <li key={s.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
                                    <div>
                                        <p className="text-[14px] font-semibold">{s.custom_domain}</p>
                                        <p className="text-[12px] text-ink-500">{s.agency} · DNS verified {s.verified_at}</p>
                                    </div>
                                    <button type="button" onClick={() => markLive(s)} className="px-4 py-2 rounded-full bg-success text-white text-[13px] font-semibold hover:opacity-90">
                                        Mark live
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                )}

                <SectionCard title="All websites" flush>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className={thRowCls}>
                                    <th className="px-4 py-2.5">Agency</th>
                                    <th className="px-4 py-2.5">Address</th>
                                    <th className="px-4 py-2.5">Custom domain</th>
                                    <th className="px-4 py-2.5">Status</th>
                                    <th className="px-4 py-2.5 text-right">Listings</th>
                                    <th className="px-4 py-2.5 text-right">Leads (30d)</th>
                                    <th className="px-4 py-2.5" />
                                </tr>
                            </thead>
                            <tbody>
                                {sites.length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-500">No agency has set up a website yet.</td></tr>
                                )}
                                {sites.map((s) => (
                                    <tr key={s.id} className="border-b border-ink-100 last:border-0">
                                        <td className="px-4 py-3 font-medium">{s.agency}<span className="block text-[11px] text-ink-400 capitalize">{s.template}</span></td>
                                        <td className="px-4 py-3"><a href={s.url} target="_blank" rel="noopener" className="text-brand-700 hover:underline">{s.subdomain_host}</a></td>
                                        <td className="px-4 py-3">
                                            {s.custom_domain ? (
                                                <>
                                                    <span>{s.custom_domain}</span>{' '}
                                                    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${DOMAIN_BADGE[s.domain_status]}`}>{s.domain_status}</span>
                                                </>
                                            ) : <span className="text-ink-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${s.status === 'published' ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-600'}`}>{s.status}</span>
                                            {s.agency_status !== 'active' && <span className="ml-1 text-[11px] text-danger">agency {s.agency_status}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{s.listings}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{s.leads_30d}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {s.domain_status === 'live' && (
                                                <button type="button" onClick={() => disconnect(s)} className="text-[12px] text-ink-500 hover:text-danger">Disconnect domain</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            </div>
        </AdminLayout>
    );
}
