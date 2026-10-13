import { ReactNode, useId, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';

/**
 * Fernly-style dashboard kit — cards, KPI tiles and dependency-free SVG charts.
 *
 * Every colour reads the brand-* ramp (or currentColor), so charts follow the
 * user's Appearance accent automatically. Use inside a dashboard <Shell>.
 *
 *   <KpiCard hero label="Active listings" value="24" spark={[…]} href="/agent/listings" />
 *   <AreaChart labels={days} series={thisPeriod} previous={lastPeriod} />
 *   <Donut segments={[{ label, value }]} centerValue="1,188" centerLabel="leads" />
 *   <PillBars data={[{ label: 'M', value: 12 }]} />
 *   <Gauge segments={[…]} centerValue="42%" centerLabel="Closed" />
 *   <Heatmap weeks={number[][]} />  ·  <RankBars rows={[…]} />
 */

// ── Buttons & primitives ────────────────────────────────────────────────────

export const btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 text-white px-4 py-2.5 text-[13px] font-semibold shadow-soft hover:bg-brand-800 transition disabled:opacity-60';
export const btnOutline =
    'inline-flex items-center justify-center gap-2 rounded-full border border-ink-900/70 text-ink-900 bg-white/60 px-4 py-2.5 text-[13px] font-semibold hover:bg-white transition disabled:opacity-60';

/** Accent ramp for categorical series — dark → light, then warm + neutral. */
export const SERIES_COLORS = [
    'var(--color-brand-800)',
    'var(--color-brand-600)',
    'var(--color-brand-400)',
    '#E3A008',
    '#9CA3AF',
    'var(--color-brand-200)',
];

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5 pb-rise">
            <div>
                <h1 className="text-[28px] sm:text-[32px] leading-tight tracking-tight">{title}</h1>
                {subtitle && <p className="text-[13.5px] text-ink-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export function Card({
    title, subtitle, action, className = '', bodyClassName = '', children,
}: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; bodyClassName?: string; children: ReactNode }) {
    return (
        <section className={`bg-white rounded-2xl shadow-soft p-5 pb-rise ${className}`}>
            {(title || action) && (
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        {title && <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>}
                        {subtitle && <p className="text-[12px] text-ink-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {action}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

export function Segmented<T extends string>({
    options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-soft" role="tablist">
            {options.map((o) => (
                <button
                    key={o.value}
                    role="tab"
                    aria-selected={o.value === value}
                    onClick={() => onChange(o.value)}
                    className={
                        'px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition ' +
                        (o.value === value ? 'bg-brand-700 text-white shadow-soft' : 'text-ink-500 hover:text-ink-900')
                    }
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function ArrowCircle({ light }: { light?: boolean }) {
    return (
        <span className={
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ' +
            (light ? 'bg-white text-brand-800' : 'border border-ink-900/70 text-ink-900 group-hover:bg-ink-900 group-hover:text-white')
        }>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M7 17 17 7M8 7h9v9" /></svg>
        </span>
    );
}

export type Delta = { value: string; up: boolean; label?: string };

export function DeltaChip({ delta, light }: { delta: Delta; light?: boolean }) {
    const tone = light ? 'text-white/85' : delta.up ? 'text-success' : 'text-danger';
    return (
        <span className={`inline-flex items-center gap-1 text-[11.5px] ${tone}`}>
            <svg className={`w-3 h-3 ${delta.up ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M6 15l6-6 6 6" /></svg>
            <span className="font-semibold">{delta.value}</span>
            {delta.label && <span className={light ? 'text-white/70' : 'text-ink-500'}>{delta.label}</span>}
        </span>
    );
}

/**
 * KPI tile. `hero` renders the accent-filled lead card (use on the first tile
 * of a row). `spark` adds a footer sparkline like Fernly's analytics tiles.
 */
export function KpiCard({
    label, value, sub, delta, spark, hero, href, icon,
}: {
    label: string; value: ReactNode; sub?: ReactNode; delta?: Delta; spark?: number[];
    hero?: boolean; href?: string; icon?: ReactNode;
}) {
    const body = (
        <div className={
            'group relative h-full rounded-2xl p-5 pb-rise overflow-hidden transition ' +
            (hero ? 'pb-swirl text-white shadow-lift' : 'bg-white shadow-soft hover:shadow-lift')
        }>
            <div className="flex items-start justify-between gap-2">
                <span className={`text-[13.5px] font-medium ${hero ? 'text-white' : 'text-ink-700'}`}>{label}</span>
                {href ? <ArrowCircle light={hero} /> : icon}
            </div>
            <p className="text-[34px] leading-none font-semibold tracking-tight mt-4 tabular-nums">{value}</p>
            <div className="mt-2.5 min-h-[18px] flex flex-wrap items-center gap-2">
                {delta && <DeltaChip delta={delta} light={hero} />}
                {sub && <span className={`text-[11.5px] ${hero ? 'text-white/80' : 'text-ink-500'}`}>{sub}</span>}
            </div>
            {spark && spark.length > 1 && (
                <div className={`-mx-5 -mb-5 mt-3 ${hero ? 'text-white' : 'text-brand-600'}`}>
                    <Sparkline data={spark} height={44} />
                </div>
            )}
        </div>
    );
    return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

// ── Sparkline ───────────────────────────────────────────────────────────────

function pathFor(data: number[], w: number, h: number, pad = 4, max?: number, min?: number) {
    const hi = max ?? Math.max(...data);
    const lo = min ?? Math.min(...data);
    const span = hi - lo || 1;
    const step = data.length > 1 ? w / (data.length - 1) : w;
    return data.map((v, i) => [i * step, pad + (h - pad * 2) * (1 - (v - lo) / span)] as const);
}

function smooth(pts: readonly (readonly [number, number])[]) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const cx = (x0 + x1) / 2;
        d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return d;
}

export function Sparkline({ data, height = 40 }: { data: number[]; height?: number }) {
    const id = useId().replace(/:/g, '');
    const w = 200;
    const pts = pathFor(data, w, height, 6);
    const line = smooth(pts);
    const area = `${line} L${w},${height} L0,${height} Z`;
    return (
        <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full block" style={{ height }} aria-hidden>
            <defs>
                <linearGradient id={`sp${id}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#sp${id})`} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

// ── Area chart (this period vs previous) ────────────────────────────────────

function niceMax(v: number) {
    if (v <= 0) return 4;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10;
    return step * pow;
}

export function AreaChart({
    labels, series, previous, height = 240, format = (n: number) => n.toLocaleString('en-ZA'),
    seriesLabel = 'This period', previousLabel = 'Previous',
}: {
    labels: string[]; series: number[]; previous?: number[]; height?: number;
    format?: (n: number) => string; seriesLabel?: string; previousLabel?: string;
}) {
    const id = useId().replace(/:/g, '');
    const [hover, setHover] = useState<number | null>(null);
    const w = 600;
    const peak = Math.max(0, ...series, ...(previous ?? []));
    // Tiny or empty ranges would round to duplicate labels (R1, R1, R0…), so
    // keep at least 4 units of headroom and label only the zero line when empty.
    const max = niceMax(Math.max(4, peak));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
    const tickLabel = (t: number) => (peak <= 0 && t > 0 ? '' : format(Math.round(t)));
    const pts = pathFor(series, w, height, 0, max, 0);
    const prev = previous ? pathFor(previous, w, height, 0, max, 0) : null;
    const line = smooth(pts);
    const area = `${line} L${w},${height} L0,${height} Z`;
    const n = series.length;
    const labelEvery = Math.max(1, Math.ceil(n / 6));

    return (
        <div>
            <div className="flex items-center justify-end gap-4 text-[11.5px] text-ink-500 mb-2">
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-brand-600" />{seriesLabel}</span>
                {previous && <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-ink-500" />{previousLabel}</span>}
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col justify-between text-[10.5px] text-ink-400 tabular-nums text-right w-9 shrink-0" style={{ height }}>
                    {[...ticks].reverse().map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{tickLabel(t)}</span>)}
                </div>
                <div
                    className="relative flex-1 min-w-0 text-brand-600"
                    style={{ height }}
                    onMouseLeave={() => setHover(null)}
                    onMouseMove={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
                        setHover(Math.max(0, Math.min(n - 1, i)));
                    }}
                >
                    {ticks.map((t) => (
                        <div key={t} className="absolute inset-x-0 border-t border-ink-100" style={{ bottom: `${(t / max) * 100}%` }} />
                    ))}
                    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
                        <defs>
                            <linearGradient id={`ar${id}`} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
                                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                            </linearGradient>
                        </defs>
                        <path d={area} fill={`url(#ar${id})`} />
                        {prev && <path d={smooth(prev)} fill="none" stroke="#6B7280" strokeWidth={1.25} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />}
                        <path d={line} fill="none" stroke="currentColor" strokeWidth={2.25} vectorEffect="non-scaling-stroke" />
                    </svg>
                    {hover !== null && n > 0 && (
                        <>
                            <div className="absolute top-0 bottom-0 border-l border-ink-300 pointer-events-none" style={{ left: `${(hover / Math.max(1, n - 1)) * 100}%` }} />
                            <div
                                className="absolute w-2.5 h-2.5 -ml-[5px] -mb-[5px] rounded-full bg-brand-600 ring-2 ring-white pointer-events-none"
                                style={{ left: `${(hover / Math.max(1, n - 1)) * 100}%`, bottom: `${(series[hover] / max) * 100}%` }}
                            />
                            <div
                                className="absolute top-1 z-10 -translate-x-1/2 bg-ink-900 text-white rounded-xl px-3 py-2 text-[11.5px] shadow-lift pointer-events-none whitespace-nowrap"
                                style={{ left: `clamp(60px, ${(hover / Math.max(1, n - 1)) * 100}%, calc(100% - 60px))` }}
                            >
                                <p className="text-white/60 text-[10.5px]">{labels[hover]}</p>
                                <p className="font-semibold">{format(series[hover])} <span className="font-normal text-white/60">{seriesLabel.toLowerCase()}</span></p>
                                {previous && <p className="text-white/70">{format(previous[hover] ?? 0)} previous</p>}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="flex justify-between pl-11 mt-2 text-[10.5px] text-ink-400">
                {labels.map((l, i) => (i % labelEvery === 0 || i === n - 1) ? <span key={i}>{l}</span> : null)}
            </div>
        </div>
    );
}

// ── Donut ───────────────────────────────────────────────────────────────────

export type Segment = { label: string; value: number; color?: string; display?: string };

export function Donut({
    segments, centerValue, centerLabel, size = 168, legend = true,
}: { segments: Segment[]; centerValue?: ReactNode; centerLabel?: ReactNode; size?: number; legend?: boolean }) {
    const total = segments.reduce((a, s) => a + s.value, 0);
    const r = 40, c = 2 * Math.PI * r, gap = segments.filter((s) => s.value > 0).length > 1 ? 2.2 : 0;
    let offset = 0;
    return (
        <div>
            <div className="relative mx-auto" style={{ width: size, height: size }}>
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth="14" />
                    {total > 0 && segments.map((s, i) => {
                        if (s.value <= 0) return null;
                        const len = (s.value / total) * c;
                        const el = (
                            <circle
                                key={s.label}
                                cx="50" cy="50" r={r} fill="none"
                                stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
                                strokeWidth="14"
                                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                                strokeDashoffset={-offset}
                            >
                                <title>{`${s.label}: ${s.display ?? s.value}`}</title>
                            </circle>
                        );
                        offset += len;
                        return el;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[24px] font-semibold tracking-tight leading-none tabular-nums">{centerValue ?? total.toLocaleString('en-ZA')}</span>
                    {centerLabel && <span className="text-[11px] text-ink-500 mt-1">{centerLabel}</span>}
                </div>
            </div>
            {legend && (
                <ul className="mt-5 space-y-2.5">
                    {segments.map((s, i) => (
                        <li key={s.label} className="flex items-center gap-2.5 text-[12.5px]">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }} />
                            <span className="flex-1 truncate text-ink-700">{s.label}</span>
                            <span className="font-semibold tabular-nums">{s.display ?? s.value.toLocaleString('en-ZA')}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ── Pill bars (Fernly "Project Analytics") ──────────────────────────────────

/**
 * Tall rounded pills. Bars below the series average render hatched (quiet
 * days), the peak gets the darkest accent + a value bubble, the rest alternate
 * mid/light accent shades.
 */
export function PillBars({
    data, height = 170, format = (n: number) => String(n), peakLabel,
}: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string; peakLabel?: (n: number) => string }) {
    const max = Math.max(1, ...data.map((d) => d.value));
    const avg = data.reduce((a, d) => a + d.value, 0) / Math.max(1, data.length);
    const peak = data.findIndex((d) => d.value === max && max > 0);
    let filled = 0;
    return (
        <div className="flex items-end justify-between gap-2 sm:gap-3" style={{ height: height + 22 }}>
            {data.map((d, i) => {
                const h = Math.max(0.22, d.value / max) * height;
                const quiet = d.value < avg || d.value === 0;
                const isPeak = i === peak;
                const shade = isPeak ? 'bg-brand-800' : (filled++ % 2 === 0 ? 'bg-brand-600' : 'bg-brand-300');
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0" title={`${d.label}: ${format(d.value)}`}>
                        <div className="relative w-full max-w-[54px] flex items-end" style={{ height }}>
                            {isPeak && (
                                <span className="absolute left-1/2 -translate-x-1/2 text-[10.5px] font-semibold bg-white border border-ink-200 rounded-full px-1.5 py-0.5 shadow-soft whitespace-nowrap z-10"
                                    style={{ bottom: h + 6 }}>
                                    {peakLabel ? peakLabel(d.value) : format(d.value)}
                                </span>
                            )}
                            <div
                                className={`pb-grow w-full rounded-full ${quiet && !isPeak ? 'pb-hatch' : shade}`}
                                style={{ height: h, animationDelay: `${i * 50}ms` }}
                            />
                        </div>
                        <span className="text-[11px] text-ink-500 truncate max-w-full">{d.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ── Gauge (semicircle, Fernly "Project Progress") ───────────────────────────

export function Gauge({
    segments, centerValue, centerLabel,
}: { segments: { label: string; value: number; tone: 'dark' | 'mid' | 'hatch' }[]; centerValue: ReactNode; centerLabel?: ReactNode }) {
    const id = useId().replace(/:/g, '');
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    const r = 80, half = Math.PI * r, gap = 3;
    let offset = 0;
    const stroke = (t: string) => t === 'dark' ? 'var(--color-brand-800)' : t === 'mid' ? 'var(--color-brand-600)' : `url(#gh${id})`;
    return (
        <div>
            <div className="relative mx-auto w-full max-w-[260px]">
                <svg viewBox="0 0 200 112" className="w-full">
                    <defs>
                        <pattern id={`gh${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <rect width="6" height="6" fill="var(--color-white)" />
                            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--pb-hatch)" strokeWidth="2" />
                        </pattern>
                    </defs>
                    <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="var(--color-ink-100)" strokeWidth="26" />
                    {segments.map((s) => {
                        if (s.value <= 0) return null;
                        const len = (s.value / total) * half;
                        const el = (
                            <path
                                key={s.label}
                                d="M20,100 A80,80 0 0 1 180,100"
                                fill="none"
                                stroke={stroke(s.tone)}
                                strokeWidth="26"
                                strokeDasharray={`${Math.max(0, len - gap)} ${half * 2}`}
                                strokeDashoffset={-offset}
                            >
                                <title>{`${s.label}: ${s.value}`}</title>
                            </path>
                        );
                        offset += len;
                        return el;
                    })}
                </svg>
                <div className="absolute inset-x-0 bottom-0 text-center">
                    <p className="text-[34px] font-semibold tracking-tight leading-none tabular-nums">{centerValue}</p>
                    {centerLabel && <p className="text-[11.5px] text-ink-500 mt-1">{centerLabel}</p>}
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-[11.5px] text-ink-600">
                {segments.map((s) => (
                    <span key={s.label} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${s.tone === 'dark' ? 'bg-brand-800' : s.tone === 'mid' ? 'bg-brand-600' : 'pb-hatch'}`} />
                        {s.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ── Heatmap (Fernly "Activity") ─────────────────────────────────────────────

const HEAT = ['bg-ink-100', 'bg-brand-100', 'bg-brand-300', 'bg-brand-600', 'bg-brand-800'];

/** `weeks` = columns of 7 day-values (Mon→Sun), oldest first. */
export function Heatmap({ weeks, unit = 'events' }: { weeks: number[][]; unit?: string }) {
    const max = useMemo(() => Math.max(1, ...weeks.flat()), [weeks]);
    const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
    return (
        <div>
            <div className="overflow-x-auto">
                <div className="grid grid-flow-col gap-1 min-w-max" style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}>
                    {weeks.flatMap((w, wi) => w.map((v, di) => (
                        <div key={`${wi}-${di}`} className={`w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] rounded-[5px] ${HEAT[level(v)]}`} title={`${v} ${unit}`} />
                    )))}
                </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 mt-3 text-[10.5px] text-ink-500">
                Less {HEAT.map((c) => <span key={c} className={`w-3 h-3 rounded-[3px] ${c}`} />)} More
            </div>
        </div>
    );
}

// ── Rank bars (Fernly "Top contributors") ───────────────────────────────────

const AVATAR_TINTS = ['bg-brand-100 text-brand-800', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800'];

export function RankBars({
    rows, format = (n: number) => n.toLocaleString('en-ZA'), empty = 'Nothing to rank yet',
}: { rows: { label: string; value: number; sub?: string }[]; format?: (n: number) => string; empty?: string }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (rows.length === 0) return <p className="py-8 text-center text-[13px] text-ink-400">{empty}</p>;
    return (
        <ul className="space-y-3.5">
            {rows.map((r, i) => {
                const initials = r.label.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
                return (
                    <li key={r.label + i} className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}>{initials}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-semibold truncate">{r.label}</span>
                                <span className="text-[12px] text-ink-500 tabular-nums shrink-0">{format(r.value)}</span>
                            </div>
                            {r.sub && <p className="text-[11px] text-ink-400 truncate">{r.sub}</p>}
                            <div className="h-1.5 rounded-full bg-ink-100 mt-1.5 overflow-hidden">
                                <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${(r.value / max) * 100}%` }} />
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

/** Status pill used in lists (Completed / In progress / Pending style). */
export function StatusPill({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'brand' | 'muted'; children: ReactNode }) {
    const cls = {
        success: 'border-success/40 text-success bg-success/5',
        warning: 'border-warning/50 text-amber-700 bg-warning/5',
        danger: 'border-danger/40 text-danger bg-danger/5',
        brand: 'border-brand-300 text-brand-700 bg-brand-50',
        muted: 'border-ink-200 text-ink-500 bg-ink-50',
    }[tone];
    return <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${cls}`}>{children}</span>;
}
