import { FormEvent, Fragment, ReactNode, useMemo, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { FlashBanners, PageHeader, SummaryStrip, btnOutline, btnPrimary, selectCls, thRowCls } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import CrmTabs from './CrmTabs';
import ImportModal from './ImportModal';
import ProspectDrawer from './ProspectDrawer';
import {
    Farm, Profile, Prospect, STATUS, STATUSES, StatusKey, Suburb, isCompany, money, moneyFull, normPhone, numf, pct, signalCls,
} from './constants';

type Props = {
    base: string;
    farm: Farm;
    editable: boolean;
    profile?: Profile;
    agents?: { id: number; name: string }[];
    agentId?: number | null;
};

export default function FarmingView({ base, farm, editable, profile, agents, agentId }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const href = (params: Record<string, number | undefined>) => {
        const q = new URLSearchParams();
        Object.entries({ ...params, agent: agentId ?? undefined }).forEach(([k, v]) => v && q.set(k, String(v)));
        const s = q.toString();
        return `${base}/farming${s ? `?${s}` : ''}`;
    };

    const crumbs: { label: string; href?: string }[] = [{ label: 'All regions', href: farm.level === 'regions' ? undefined : href({}) }];
    if (farm.level !== 'regions') {
        crumbs.push({ label: farm.region.name, href: farm.level === 'region' ? undefined : href({ region: farm.region.id }) });
    }
    if (farm.level === 'suburb' || farm.level === 'scheme') {
        crumbs.push({ label: farm.suburb.name, href: farm.level === 'suburb' ? undefined : href({ suburb: farm.suburb.id }) });
    }
    if (farm.level === 'scheme') crumbs.push({ label: farm.scheme.name });

    return (
        <div className="px-4 sm:px-7 py-6">
            <CrmTabs base={base} active="farming" agents={agents} agentId={agentId} />
            <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500 mb-3" aria-label="Breadcrumb">
                {crumbs.map((c, i) => (
                    <Fragment key={i}>
                        {i > 0 && <span className="text-ink-300">›</span>}
                        {c.href ? <Link href={c.href} className="font-semibold hover:text-brand-700">{c.label}</Link> : <span className="font-semibold text-ink-900">{c.label}</span>}
                    </Fragment>
                ))}
            </nav>
            <FlashBanners flash={flash} />

            {farm.level === 'regions' && <Regions farm={farm} href={href} editable={editable} />}
            {farm.level === 'region' && <Region farm={farm} href={href} editable={editable} />}
            {farm.level === 'suburb' && <SuburbLevel farm={farm} href={href} editable={editable} />}
            {farm.level === 'scheme' && <SchemeLevel farm={farm} base={base} editable={editable} profile={profile} />}
        </div>
    );
}

type Href = (p: Record<string, number | undefined>) => string;

// ── Level 1: regions ────────────────────────────────────────────────────────

function Regions({ farm, href, editable }: { farm: Extract<Farm, { level: 'regions' }>; href: Href; editable: boolean }) {
    const tot = farm.regions.reduce((a, r) => ({ s: a.s + r.suburbs, sc: a.sc + r.schemes, p: a.p + r.prospects, c: a.c + r.contacted }), { s: 0, sc: 0, p: 0, c: 0 });
    const [adding, setAdding] = useState(false);
    return (
        <>
            <PageHeader
                title="Property Farming"
                subtitle={editable
                    ? 'Pick a farming region to drill into its suburbs, sectional titles and owner prospect lists.'
                    : 'Every agent’s farms. Drill into a region to see suburbs, schemes and owner lists (view only).'}
                actions={editable && <button type="button" onClick={() => setAdding(true)} className={btnOutline}>+ Add region</button>}
            />
            <SummaryStrip
                title="Farming summary"
                cells={[
                    { label: 'Owner prospects', value: tot.p.toLocaleString('en-ZA'), sub: `${tot.sc} scheme${tot.sc === 1 ? '' : 's'} farmed` },
                    { label: 'Contacted', value: tot.c.toLocaleString('en-ZA'), sub: tot.p ? `${Math.round((tot.c / tot.p) * 100)}% of owners worked` : 'No owners loaded yet' },
                    { label: 'Suburbs mapped', value: tot.s, sub: `${farm.regions.length} regions` },
                    { label: 'Sectional titles', value: tot.sc, sub: editable ? 'Your schemes' : 'Across agents' },
                ]}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {farm.regions.map((r) => {
                    const p = r.prospects ? Math.round((r.contacted / r.prospects) * 100) : 0;
                    return (
                        <Link key={r.id} href={href({ region: r.id })} className="block bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 hover:shadow-lift hover:-translate-y-0.5 transition pb-rise">
                            <h3 className="text-[16.5px] font-semibold tracking-tight">{r.name}</h3>
                            <p className="text-[12.5px] text-ink-500">{r.suburbs} suburbs · {r.schemes} sectional title{r.schemes === 1 ? '' : 's'}</p>
                            {r.prospects ? <Progress label="Prospects contacted" value={r.contacted} total={r.prospects} /> : <p className="mt-4 text-[12.5px] text-ink-400">No prospects loaded yet</p>}
                            <CardStats items={[[r.suburbs, 'Suburbs'], [r.prospects.toLocaleString('en-ZA'), 'Owners'], [`${p}%`, 'Worked']]} />
                        </Link>
                    );
                })}
            </div>
            {adding && <AddRegionModal onClose={() => setAdding(false)} />}
        </>
    );
}

// ── Level 2: suburbs of a region ────────────────────────────────────────────

const SUBURB_COLS: { key: string; label: string; num?: boolean; get: (s: Suburb) => number | string | null | undefined; fmt?: (v: number) => string }[] = [
    { key: 'name', label: 'Suburb', get: (s) => s.name },
    { key: 'signal', label: 'Signal', get: (s) => ({ High: 0, Moderate: 1, Watch: 2, Excluded: 3 } as Record<string, number>)[s.signal ?? ''] ?? 9 },
    { key: 'priority', label: 'Pri', num: true, get: (s) => s.priority },
    { key: 'stock', label: 'Stock', num: true, get: (s) => s.stats?.totalStock, fmt: numf },
    { key: 'sect', label: 'Sect.', num: true, get: (s) => s.stats?.sectionalPct, fmt: pct },
    { key: 'own11', label: 'Own 11yr+', num: true, get: (s) => s.stats?.owners11, fmt: pct },
    { key: 'own50', label: 'Own 50+', num: true, get: (s) => s.stats?.owners50, fmt: pct },
    { key: 'transf', label: 'Transf 12mo', num: true, get: (s) => s.stats?.transfers12, fmt: numf },
    { key: 'turn', label: 'Turnover', num: true, get: (s) => s.stats?.turnover, fmt: pct },
    { key: 'price', label: 'Avg price', num: true, get: (s) => s.stats?.avgPrice12, fmt: money },
    { key: 'schemes', label: 'Schemes', num: true, get: (s) => s.schemes },
];

function Region({ farm, href, editable }: { farm: Extract<Farm, { level: 'region' }>; href: Href; editable: boolean }) {
    const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'priority', dir: 1 });
    const [adding, setAdding] = useState(false);
    const subs = useMemo(() => {
        const col = SUBURB_COLS.find((c) => c.key === sort.key)!;
        return [...farm.suburbs].sort((a, b) => {
            const av = col.get(a), bv = col.get(b);
            if (av == null || av === '') return 1;
            if (bv == null || bv === '') return -1;
            if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sort.dir;
            return ((av as number) - (bv as number)) * sort.dir;
        });
    }, [farm.suburbs, sort]);
    const withStats = farm.suburbs.filter((s) => s.stats?.totalStock);
    const sum = (f: (s: Suburb) => number | undefined) => withStats.reduce((a, s) => a + (f(s) ?? 0), 0);
    const avgTurn = withStats.length ? sum((s) => s.stats?.turnover) / withStats.length : null;

    return (
        <>
            <PageHeader
                title={farm.region.name}
                subtitle="Suburb master: Lightstone deeds-office signals. Click a suburb to open its sectional titles and owner lists."
                actions={editable && <button type="button" onClick={() => setAdding(true)} className={btnOutline}>+ Add suburb</button>}
            />
            <SummaryStrip
                title="Region summary"
                cells={[
                    { label: 'Suburbs', value: farm.suburbs.length, sub: `${withStats.length} with Lightstone stats` },
                    { label: 'Total stock', value: numf(sum((s) => s.stats?.totalStock)), sub: 'Registered properties' },
                    { label: 'Transfers 12mo', value: numf(sum((s) => s.stats?.transfers12)), sub: 'Sales in the last year' },
                    { label: 'Avg turnover', value: pct(avgTurn), sub: 'Stock that sold in 12 months' },
                ]}
            />
            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-[13px]">
                    <thead>
                        <tr className={thRowCls}>
                            {SUBURB_COLS.map((c) => (
                                <th key={c.key} className={`font-semibold py-3 px-3 cursor-pointer select-none hover:text-brand-700 ${c.num ? 'text-right' : ''} ${c.key === 'name' ? 'pl-5' : ''}`}
                                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : (c.key === 'priority' || c.key === 'name' || c.key === 'signal' ? 1 : -1) }))}>
                                    {c.label}{sort.key === c.key && <span className="text-[9px] ml-1">{sort.dir === 1 ? '▲' : '▼'}</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {subs.length === 0 && <tr><td colSpan={SUBURB_COLS.length} className="py-10 text-center text-ink-400">No suburbs mapped for {farm.region.name} yet.</td></tr>}
                        {subs.map((s) => (
                            <tr key={s.id} className="border-b border-ink-100 hover:bg-brand-50/50 cursor-pointer transition" onClick={() => router.visit(href({ suburb: s.id }))}>
                                <td className="py-3 pl-5 px-3">
                                    <span className="font-semibold">{s.name}</span>
                                    {s.custom && <span className="ml-1.5 text-[10px] font-semibold text-ink-400">added</span>}
                                    {s.angle && <span className="block text-[11.5px] text-ink-500 max-w-[240px] truncate">{s.angle}</span>}
                                </td>
                                <td className="py-3 px-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${signalCls(s.signal)}`}>{s.signal ?? '—'}</span></td>
                                {SUBURB_COLS.slice(2).map((c) => {
                                    const v = c.get(s);
                                    return (
                                        <td key={c.key} className={`py-3 px-3 text-right tabular-nums ${v == null ? 'text-ink-300' : ''}`}>
                                            {c.key === 'priority' && v != null
                                                ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">{v}</span>
                                                : v == null ? '—' : c.fmt ? c.fmt(v as number) : (v || <span className="text-ink-300">0</span>)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            </section>
            {adding && <AddSuburbModal regionId={farm.region.id} regionName={farm.region.name} onClose={() => setAdding(false)} />}
        </>
    );
}

// ── Level 3: schemes in a suburb ────────────────────────────────────────────

function SuburbLevel({ farm, href, editable }: { farm: Extract<Farm, { level: 'suburb' }>; href: Href; editable: boolean }) {
    const [adding, setAdding] = useState(false);
    const s = farm.suburb;
    const owners = farm.schemes.reduce((a, x) => a + (x.owners ?? 0), 0);
    const contacted = farm.schemes.reduce((a, x) => a + (x.contacted ?? 0), 0);
    const warm = farm.schemes.reduce((a, x) => a + (x.warm ?? 0), 0);

    return (
        <>
            <PageHeader
                title={s.name}
                subtitle="Sectional titles in this suburb. Open one to work its owner prospect list."
                actions={editable && <button type="button" onClick={() => setAdding(true)} className={btnPrimary}>+ Add sectional title</button>}
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <aside className="lg:col-span-4"><SuburbPanel suburb={s} /></aside>
                <div className="lg:col-span-8">
                    {farm.schemes.length > 0 && (
                        <SummaryStrip
                            title="Suburb farming summary"
                            cells={[
                                { label: 'Owners', value: owners.toLocaleString('en-ZA'), sub: `${farm.schemes.length} scheme${farm.schemes.length === 1 ? '' : 's'}` },
                                { label: 'Contacted', value: contacted.toLocaleString('en-ZA'), sub: owners ? `${Math.round((contacted / owners) * 100)}% worked` : '—' },
                                { label: 'Warm / booked', value: warm, sub: 'Interested, appraisal, listed' },
                            ]}
                        />
                    )}
                    {farm.schemes.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-10 text-center">
                            <h3 className="text-lg font-semibold">No sectional titles yet</h3>
                            <p className="text-[13px] text-ink-500 mt-1.5">{editable ? 'Add a sectional title, then import its owner register.' : 'No agent is farming a scheme in this suburb yet.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {farm.schemes.map((sc) => (
                                <Link key={sc.id} href={href({ scheme: sc.id })} className="block bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 hover:shadow-lift hover:-translate-y-0.5 transition pb-rise">
                                    <h3 className="text-[16px] font-semibold tracking-tight">{sc.name}</h3>
                                    <p className="text-[12px] text-ink-500 truncate">
                                        {[sc.address, sc.scheme_number && `Scheme ${sc.scheme_number}`, sc.erf && `Erf ${sc.erf}`].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                    {!editable && sc.agent && <p className="text-[11.5px] text-brand-700 font-semibold mt-0.5">{sc.agent}</p>}
                                    <Progress label="Contacted" value={sc.contacted ?? 0} total={sc.owners ?? 0} />
                                    <CardStats items={[[sc.units_count ?? sc.owners ?? 0, 'Units'], [sc.owners ?? 0, 'Owners'], [sc.warm ?? 0, 'Warm']]} />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {adding && <AddSchemeModal suburbId={s.id} suburbName={s.name} onClose={() => setAdding(false)} />}
        </>
    );
}

function SuburbPanel({ suburb }: { suburb: Suburb }) {
    const st = suburb.stats;
    const lines: [string, ReactNode][] = st?.totalStock ? [
        ['Signal', <span key="s" className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${signalCls(suburb.signal)}`}>{suburb.signal ?? '—'}</span>],
        ['Municipality', suburb.municipality ?? '—'],
        ['Total stock', numf(st.totalStock)],
        ['Sectional / Freehold', `${pct(st.sectionalPct)} / ${pct(st.freeholdPct)}`],
        ...(st.inEstatePct != null ? [['In estate', pct(st.inEstatePct)] as [string, ReactNode]] : []),
        ['LSM', st.lsm ?? '—'],
        ['Income band', st.income ?? '—'],
        ['Adults', numf(st.adults)],
        ['Owners 11yr+', pct(st.owners11)],
        ['Owners 50+', pct(st.owners50)],
        ['Sellers 11yr+', pct(st.sellers11)],
        ['Transfers 12mo', numf(st.transfers12)],
        ['Avg price 12mo', moneyFull(st.avgPrice12)],
        ['Turnover', pct(st.turnover)],
    ] : [];

    return (
        <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise">
            <h2 className="text-[16px] font-semibold tracking-tight mb-3">Suburb master</h2>
            {!lines.length ? (
                <p className="text-[12.5px] text-ink-500">No Lightstone stats stored for <b>{suburb.name}</b> yet. You can still add sectional titles and import owner lists.</p>
            ) : (
                <>
                    <dl className="space-y-2">
                        {lines.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3 text-[13px]">
                                <dt className="text-ink-500">{k}</dt><dd className="font-semibold text-right tabular-nums">{v}</dd>
                            </div>
                        ))}
                    </dl>
                    {suburb.angle && (
                        <div className="mt-4 pt-3 border-t border-ink-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1">Primary angle</p>
                            <p className="text-[13px] text-ink-700">{suburb.angle}</p>
                        </div>
                    )}
                    {st?.ownerAge && <Bars title="Owner age" rows={['18-35', '36-49', '50-64', '65+'].map((l, i) => [l, st.ownerAge![i]])} colors={['#3B82F6', '#14B8A6', '#F59E0B', '#EF4444']} />}
                    {st?.tenureSellers && <Bars title="Recent sellers · by tenure" rows={['<5 yr', '5-7', '8-10', '11yr+'].map((l, i) => [l, st.tenureSellers![i]])} />}
                </>
            )}
        </section>
    );
}

function Bars({ title, rows, colors }: { title: string; rows: [string, number | undefined][]; colors?: string[] }) {
    return (
        <div className="mt-4 pt-3 border-t border-ink-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2.5">{title}</p>
            {rows.map(([l, v], i) => (
                <div key={l} className="flex items-center gap-2 mb-1.5 text-[11.5px]">
                    <span className="w-12 text-ink-500 font-semibold">{l}</span>
                    <span className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${(v ?? 0) * 100}%`, background: colors?.[i] ?? 'var(--color-brand-500)' }} />
                    </span>
                    <span className="w-10 text-right font-semibold tabular-nums">{pct(v)}</span>
                </div>
            ))}
        </div>
    );
}

// ── Level 4: owner tracker for one scheme ───────────────────────────────────

function SchemeLevel({ farm, base, editable, profile }: { farm: Extract<Farm, { level: 'scheme' }>; base: string; editable: boolean; profile?: Profile }) {
    const { scheme, suburb, prospects } = farm;
    const [status, setStatus] = useState<'all' | StatusKey>('all');
    const [type, setType] = useState<'all' | 'indiv' | 'comp'>('all');
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState<number | 'new' | null>(null);
    const [importing, setImporting] = useState(false);
    const [editing, setEditing] = useState(false);

    const counts = useMemo(() => {
        const c: Record<string, number> = {};
        prospects.forEach((p) => { c[p.status] = (c[p.status] ?? 0) + 1; });
        return c;
    }, [prospects]);
    const total = prospects.length;
    const contacted = total - (counts.not_contacted ?? 0);
    const warm = (counts.interested ?? 0) + (counts.appraisal_booked ?? 0) + (counts.listed ?? 0);
    const pipeline = prospects.filter((p) => p.inquiry_id).length;

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return prospects.filter((p) =>
            (status === 'all' || p.status === status)
            && (type === 'all' || (type === 'comp' ? isCompany(p.owner_type) : !isCompany(p.owner_type)))
            && (!q || [p.owner_name, p.unit, p.phone1, p.phone2, p.priority_note, p.email].some((v) => (v ?? '').toLowerCase().includes(q))));
    }, [prospects, status, type, search]);

    const open: Prospect | null = typeof openId === 'number' ? prospects.find((p) => p.id === openId) ?? null : null;

    function quickStatus(p: Prospect, s: StatusKey) {
        router.patch(`/agent/crm/prospects/${p.id}/status`, { status: s }, { preserveScroll: true, preserveState: true });
    }

    const exportUrl = editable ? `/agent/crm/schemes/${scheme.id}/export` : `${base}/schemes/${scheme.id}/export`;

    return (
        <>
            <PageHeader
                title={scheme.name}
                subtitle={[scheme.address, scheme.scheme_number && `Scheme ${scheme.scheme_number}`, scheme.erf && `Erf ${scheme.erf}`, `${scheme.units_count ?? total} units`, !editable && scheme.agent].filter(Boolean).join(' · ')}
                actions={<>
                    {editable && <button type="button" onClick={() => setEditing(true)} className={btnOutline}>Edit scheme</button>}
                    {editable && <button type="button" onClick={() => setImporting(true)} className={btnOutline}>⬆ Import owners</button>}
                    {editable && total > 0 && <Link href={`/agent/crm/whatsapp/campaigns/new?scheme=${scheme.id}`} className={btnOutline}>WhatsApp campaign</Link>}
                    <a href={exportUrl} className={btnOutline}>⬇ Export CSV</a>
                    {editable && <button type="button" onClick={() => setOpenId('new')} className={btnPrimary}>+ Add prospect</button>}
                </>}
            />
            <SummaryStrip
                title="Scheme summary"
                cells={[
                    { label: 'Owner prospects', value: total.toLocaleString('en-ZA'), sub: `${scheme.units_count ?? total} units in the scheme` },
                    { label: 'Contacted', value: contacted.toLocaleString('en-ZA'), sub: `${total ? Math.round((contacted / total) * 100) : 0}% of the list worked` },
                    { label: 'Warm / booked', value: warm, sub: 'Interested, appraisal, listed', tone: warm ? 'success' : 'muted' },
                    { label: 'On the pipeline', value: pipeline, sub: 'Seller leads sent' },
                ]}
            />

            {/* status chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                <Chip on={status === 'all'} onClick={() => setStatus('all')}>All <b>{total}</b></Chip>
                {STATUSES.filter((s) => counts[s.key]).map((s) => (
                    <Chip key={s.key} on={status === s.key} onClick={() => setStatus(s.key)}>
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label} <b>{counts[s.key]}</b>
                    </Chip>
                ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search owner, unit, phone…" className={`${selectCls} flex-1 min-w-[220px]`} />
                <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectCls}>
                    <option value="all">All owner types</option>
                    <option value="indiv">Individuals</option>
                    <option value="comp">Companies / trusts</option>
                </select>
            </div>

            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-[13px]">
                    <thead>
                        <tr className={thRowCls}>
                            <th className="font-semibold py-3 pl-5 pr-3 text-right">Unit</th>
                            <th className="font-semibold py-3 px-3">Owner</th>
                            <th className="font-semibold py-3 px-3">Type</th>
                            <th className="font-semibold py-3 px-3">Phone</th>
                            <th className="font-semibold py-3 px-3">Status</th>
                            <th className="font-semibold py-3 px-3">Contacted</th>
                            <th className="font-semibold py-3 px-3">Next action</th>
                            {!editable && <th className="font-semibold py-3 px-3">Agent</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={8} className="py-12 text-center text-ink-400">
                                {total === 0 ? (editable ? 'No owners yet. Use Import owners to load the scheme’s owner register.' : 'No owners loaded yet.') : 'No matching prospects.'}
                            </td></tr>
                        )}
                        {rows.map((p) => {
                            const phones = [p.phone1, p.phone2].map(normPhone).filter(Boolean);
                            return (
                                <tr key={p.id} className="border-b border-ink-100 hover:bg-brand-50/50 cursor-pointer transition" onClick={() => setOpenId(p.id)}>
                                    <td className="py-3 pl-5 pr-3 text-right font-semibold tabular-nums">{p.unit || '—'}</td>
                                    <td className="py-3 px-3 max-w-[260px]">
                                        <span className="block font-semibold leading-tight">{p.owner_name}</span>
                                        {p.multi_unit && !/^no$/i.test(p.multi_unit) && <span className="block text-[11.5px] text-ink-500">{p.multi_unit}</span>}
                                        {p.priority_note && !/standard/i.test(p.priority_note) && <span className="block text-[11px] font-semibold text-brand-700 truncate">{p.priority_note}</span>}
                                        {p.inquiry_id && <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">PIPELINE</span>}
                                        {p.wa_opt_in_at && !p.wa_opted_out_at && <span className="inline-block mt-0.5 ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success">WA OPT-IN</span>}
                                        {p.wa_opted_out_at && <span className="inline-block mt-0.5 ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger/10 text-danger">WA STOP</span>}
                                    </td>
                                    <td className="py-3 px-3">
                                        {p.owner_type && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${isCompany(p.owner_type) ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>{p.owner_type}</span>}
                                    </td>
                                    <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        {phones.length ? phones.map((ph) => (
                                            <span key={ph!.tel} className="block">
                                                <a href={`tel:${ph!.tel}`} className="text-[12px] font-semibold text-brand-700 hover:underline">{ph!.disp}</a>
                                                <a href={`https://wa.me/${ph!.wa}`} target="_blank" rel="noreferrer" title="WhatsApp" className="ml-2 text-[11px] font-bold text-[#1e8a4f]">WA</a>
                                            </span>
                                        )) : <span className="text-ink-300">—</span>}
                                    </td>
                                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                                        {editable ? (
                                            <select value={p.status} onChange={(e) => quickStatus(p, e.target.value as StatusKey)}
                                                className="border border-ink-200 rounded-lg px-2 py-1 text-[12px] font-bold bg-white cursor-pointer" style={{ color: STATUS[p.status].color }}>
                                                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                            </select>
                                        ) : (
                                            <span className="text-[12px] font-bold" style={{ color: STATUS[p.status].color }}>{STATUS[p.status].label}</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-3 whitespace-nowrap text-ink-600">{p.contacted_on ?? <span className="text-ink-300">—</span>}</td>
                                    <td className="py-3 px-3 max-w-[200px] text-ink-600"><span className="line-clamp-2">{p.next_action || <span className="text-ink-300">—</span>}</span></td>
                                    {!editable && <td className="py-3 px-3 text-ink-600 whitespace-nowrap">{p.agent}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table></div>
            </section>

            {openId !== null && (
                <ProspectDrawer
                    // Re-mount when the saved record changes (e.g. after logging a
                    // contact) so the edit form never holds stale values.
                    key={`${openId}:${open ? JSON.stringify(open) : ''}`}
                    prospect={open}
                    scheme={scheme}
                    suburb={suburb}
                    history={open ? farm.activities[String(open.id)] ?? [] : []}
                    editable={editable}
                    profile={profile}
                    onClose={() => setOpenId(null)}
                />
            )}
            {importing && <ImportModal schemeId={scheme.id} schemeName={scheme.name} onClose={() => setImporting(false)} />}
            {editing && <AddSchemeModal suburbId={suburb.id} suburbName={suburb.name} scheme={scheme} onClose={() => setEditing(false)} />}
        </>
    );
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
    const p = total ? Math.round((value / total) * 100) : 0;
    return (
        <div className="mt-4">
            <div className="flex justify-between text-[11.5px] font-semibold text-ink-500 mb-1.5"><span>{label}</span><span>{value.toLocaleString('en-ZA')}/{total.toLocaleString('en-ZA')}</span></div>
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden"><span className="block h-full bg-brand-600 rounded-full" style={{ width: `${p}%` }} /></div>
        </div>
    );
}

function CardStats({ items }: { items: [ReactNode, string][] }) {
    return (
        <div className="mt-4 pt-3.5 border-t border-ink-100 grid grid-cols-3 text-center">
            {items.map(([v, k]) => (
                <div key={k}>
                    <p className="text-[17px] font-semibold tabular-nums">{v}</p>
                    <p className="text-[10.5px] uppercase tracking-wider text-ink-500">{k}</p>
                </div>
            ))}
        </div>
    );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" onClick={onClick} className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-semibold transition ' +
            (on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50')}>
            {children}
        </button>
    );
}

const mInput = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
const mLabel = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

function Modal({ title, sub, onClose, onSubmit, busy, submit, children }: {
    title: string; sub: string; onClose: () => void; onSubmit: (e: FormEvent) => void; busy: boolean; submit: string; children: ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-lift w-full max-w-md p-6 space-y-4">
                <div><h2 className="text-lg font-semibold">{title}</h2><p className="text-[12.5px] text-ink-500 mt-0.5">{sub}</p></div>
                {children}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className={btnOutline}>Cancel</button>
                    <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Spinner size={13} />}{submit}</button>
                </div>
            </form>
        </div>
    );
}

function AddRegionModal({ onClose }: { onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({ name: '' });
    return (
        <Modal title="Add region" sub="a farming area of your own" onClose={onClose} busy={processing} submit="Add region"
            onSubmit={(e) => { e.preventDefault(); post('/agent/crm/regions', { onSuccess: onClose }); }}>
            <div>
                <label className={mLabel}>Region name *</label>
                <input autoFocus required maxLength={120} value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Centurion" className={mInput} />
                {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
            </div>
            <p className="text-[11.5px] text-ink-500">Added regions are shared with everyone in your agency. Next, add its suburbs with + Add suburb.</p>
        </Modal>
    );
}

function AddSuburbModal({ regionId, regionName, onClose }: { regionId: number; regionName: string; onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({ region_id: regionId, name: '', signal: 'Watch', angle: '' });
    return (
        <Modal title="Add suburb" sub={`to ${regionName}`} onClose={onClose} busy={processing} submit="Add suburb"
            onSubmit={(e) => { e.preventDefault(); post('/agent/crm/suburbs', { preserveScroll: true, onSuccess: onClose }); }}>
            <div>
                <label className={mLabel}>Suburb name *</label>
                <input autoFocus required value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Colbyn" className={mInput} />
                {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={mLabel}>Signal</label>
                    <select value={data.signal} onChange={(e) => setData('signal', e.target.value)} className={mInput}>
                        <option>High</option><option>Moderate</option><option>Watch</option>
                    </select>
                </div>
                <div>
                    <label className={mLabel}>Primary angle</label>
                    <input value={data.angle} onChange={(e) => setData('angle', e.target.value)} placeholder="e.g. Long-tenure downsizing" className={mInput} />
                </div>
            </div>
            <p className="text-[11.5px] text-ink-500">Added suburbs are shared with everyone in your agency.</p>
        </Modal>
    );
}

function AddSchemeModal({ suburbId, suburbName, scheme, onClose }: {
    suburbId: number; suburbName: string; scheme?: { id: number; name: string; scheme_number: string | null; erf: string | null; address: string | null; units_count: number | null }; onClose: () => void;
}) {
    const { data, setData, post, patch, processing, errors, transform } = useForm({
        suburb_id: suburbId,
        name: scheme?.name ?? '',
        scheme_number: scheme?.scheme_number ?? '',
        erf: scheme?.erf ?? '',
        address: scheme?.address ?? '',
        units_count: scheme?.units_count ? String(scheme.units_count) : '',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        transform((d) => ({ ...d, name: !scheme && !/^ss\b/i.test(d.name.trim()) ? `SS ${d.name.trim()}` : d.name, units_count: d.units_count || null }));
        if (scheme) patch(`/agent/crm/schemes/${scheme.id}`, { preserveScroll: true, onSuccess: onClose });
        else post('/agent/crm/schemes', { onSuccess: onClose });
    }
    function destroy() {
        if (scheme && confirm(`Delete ${scheme.name} and all its owner prospects? This can't be undone.`)) {
            router.delete(`/agent/crm/schemes/${scheme.id}`);
        }
    }
    return (
        <Modal title={scheme ? 'Edit sectional title' : 'Add sectional title'} sub={`in ${suburbName}`} onClose={onClose} busy={processing}
            submit={scheme ? 'Save' : 'Add scheme'} onSubmit={submit}>
            <div>
                <label className={mLabel}>Scheme name *</label>
                <input autoFocus required value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. SS Riverside" className={mInput} />
                {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div><label className={mLabel}>Scheme number</label><input value={data.scheme_number} onChange={(e) => setData('scheme_number', e.target.value)} placeholder="e.g. 123/1990" className={mInput} /></div>
                <div><label className={mLabel}>Erf</label><input value={data.erf} onChange={(e) => setData('erf', e.target.value)} placeholder="e.g. 1420" className={mInput} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div><label className={mLabel}>Address</label><input value={data.address} onChange={(e) => setData('address', e.target.value)} placeholder="e.g. 10 Main St" className={mInput} /></div>
                <div><label className={mLabel}>Units</label><input type="number" min={1} value={data.units_count} onChange={(e) => setData('units_count', e.target.value)} placeholder="e.g. 48" className={mInput} /></div>
            </div>
            {scheme
                ? <button type="button" onClick={destroy} className="text-[12.5px] font-semibold text-danger hover:underline">Delete this scheme</button>
                : <p className="text-[11.5px] text-ink-500">After adding, use <b>Import owners</b> to load the scheme’s owner register.</p>}
        </Modal>
    );
}
