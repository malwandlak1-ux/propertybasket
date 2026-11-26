import { DragEvent, useMemo, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { FlashBanners, PageHeader, SectionCard, btnOutline, btnPrimary, selectCls, thRowCls } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import {
    FIELD_HINTS, FIELD_LABELS, FIELDS, Field, MappedRow, ZipPhoto,
    buildRows, guessMapping, photosFor, postJson, readPhotoZip, readTable, shrinkPhoto, templateCsv, uploadPhoto,
} from '@/lib/listingImport';

type Agent = { id: number; name: string; email: string };
type Draft = {
    id: number; title: string; ref: string | null; type: string; price: number; place: string;
    agent: string | null; photos: number; photos_pending: number; image: string | null;
};
type Result = { row: number; id: number | null; action: 'created' | 'updated' | 'skipped' | 'failed'; error: string | null; title?: string; needs_photos?: boolean; external_ref?: string | null };

const SOURCES = ['Entegral', 'Prop Data', 'PropCtrl', 'PropCon', 'Property Engine', 'Other CRM / spreadsheet'];
const BATCH = 50;

const fmtMoney = (n: number) => (n >= 1_000_000 ? `R ${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0)}m` : `R ${Math.round(n).toLocaleString('en-ZA').replace(/,/g, ' ')}`);

export default function ListingImport({ agents, drafts }: { agents: Agent[]; drafts: Draft[] }) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;

    // Step 1: files
    const [table, setTable] = useState<string[][] | null>(null);
    const [fileName, setFileName] = useState('');
    const [zipPhotos, setZipPhotos] = useState<ZipPhoto[] | null>(null);
    const [zipName, setZipName] = useState('');
    const [reading, setReading] = useState<'' | 'sheet' | 'zip'>('');
    const [error, setError] = useState('');
    const [drag, setDrag] = useState(false);
    const sheetInput = useRef<HTMLInputElement>(null);
    const zipInput = useRef<HTMLInputElement>(null);

    // Step 2: mapping + options
    const [headerRow, setHeaderRow] = useState(0);
    const [mapping, setMapping] = useState<Record<Field, number> | null>(null);
    const [defaultType, setDefaultType] = useState<'for_sale' | 'long_term_rent'>('for_sale');
    const [defaultAgent, setDefaultAgent] = useState<number | ''>(agents.length === 1 ? agents[0].id : '');
    const [publish, setPublish] = useState(false);
    const [source, setSource] = useState(SOURCES[0]);

    // Step 3: run
    const [phase, setPhase] = useState<'' | 'rows' | 'photos' | 'done'>('');
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [results, setResults] = useState<Result[]>([]);
    const [photoStats, setPhotoStats] = useState({ ok: 0, failed: 0 });

    async function readSheet(f?: File | null) {
        if (!f) return;
        setError(''); setReading('sheet'); setFileName(f.name); setPhase(''); setResults([]);
        try {
            const t = await readTable(f);
            const g = guessMapping(t);
            if (t.length <= g.headerRow + 1) throw new Error('empty');
            setTable(t); setHeaderRow(g.headerRow); setMapping(g.mapping);
        } catch {
            setTable(null); setMapping(null);
            setError('Could not read that file. Use an Excel (.xlsx / .xls) or .csv export with one listing per row.');
        } finally {
            setReading('');
        }
    }

    async function readZip(f?: File | null) {
        if (!f) return;
        setError(''); setReading('zip'); setZipName(f.name);
        try {
            const photos = await readPhotoZip(f);
            if (!photos.length) throw new Error('none');
            setZipPhotos(photos);
        } catch {
            setZipPhotos(null); setZipName('');
            setError('No photos found in that ZIP. Put each listing’s photos in a folder named after its listing reference, or name the files “REF_1.jpg”, “REF_2.jpg”.');
        } finally {
            setReading('');
        }
    }

    const headers = table?.[headerRow] ?? [];
    const rows: MappedRow[] = useMemo(() => (table && mapping ? buildRows(table, headerRow, mapping) : []), [table, mapping, headerRow]);
    const sample = (j: number) => (j >= 0 ? rows.find((r) => Object.values(r).length > 1 && table?.[r._row - 1]?.[j])?._row : undefined);
    const noPrice = rows.filter((r) => !r.price).length;
    const zipMatched = useMemo(
        () => (zipPhotos ? rows.filter((r) => photosFor(zipPhotos, r.external_ref).length > 0).length : 0),
        [zipPhotos, rows],
    );

    async function run() {
        if (!rows.length) return;
        setError(''); setPhase('rows'); setResults([]); setPhotoStats({ ok: 0, failed: 0 });
        const all: Result[] = [];
        try {
            setProgress({ done: 0, total: rows.length });
            for (let i = 0; i < rows.length; i += BATCH) {
                const res = await postJson<{ results: Result[] }>('/agency/listings/import', {
                    rows: rows.slice(i, i + BATCH), default_listing_type: defaultType,
                    default_agent_id: defaultAgent || null, publish, source: source.toLowerCase(),
                });
                all.push(...res.results);
                setResults([...all]);
                setProgress({ done: Math.min(rows.length, i + BATCH), total: rows.length });
            }

            // Photos from the ZIP, one per request, only for listings that have none yet.
            if (zipPhotos) {
                const jobs = all.filter((r) => r.id && r.needs_photos)
                    .flatMap((r) => photosFor(zipPhotos, r.external_ref).slice(0, 50).map((p) => ({ id: r.id as number, p })));
                if (jobs.length) {
                    setPhase('photos');
                    setProgress({ done: 0, total: jobs.length });
                    let ok = 0, failed = 0;
                    for (let k = 0; k < jobs.length; k++) {
                        try {
                            (await uploadPhoto(jobs[k].id, await shrinkPhoto(jobs[k].p), jobs[k].p.name)) ? ok++ : failed++;
                        } catch {
                            failed++;
                        }
                        setPhotoStats({ ok, failed });
                        setProgress({ done: k + 1, total: jobs.length });
                    }
                }
            }
            setPhase('done');
            router.reload({ only: ['drafts'] });
        } catch (e) {
            setPhase('done');
            setError((e as Error).message || 'The import stopped. Rows already saved are kept; run it again to continue (nothing is duplicated).');
        }
    }

    function downloadTemplate() {
        const url = URL.createObjectURL(new Blob([templateCsv()], { type: 'text/csv' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: 'property-basket-listings-template.csv' });
        a.click();
        URL.revokeObjectURL(url);
    }

    const counts = results.reduce((c, r) => ({ ...c, [r.action]: (c[r.action] ?? 0) + 1 }), {} as Record<string, number>);
    const busy = phase === 'rows' || phase === 'photos';

    return (
        <AgencyLayout crumb="Import listings">
            <Head title="Import listings" />
            <section className="px-4 sm:px-8 py-6 sm:py-7 max-w-[1200px]">
                <PageHeader
                    title="Import listings"
                    subtitle="Bring your stock over from Entegral, Prop Data, PropCtrl or any spreadsheet. Listings arrive as drafts for you to check."
                    actions={<>
                        <button type="button" onClick={downloadTemplate} className={btnOutline}>Download template</button>
                        <Link href="/agency/listings" className={btnOutline}>Back to listings</Link>
                    </>}
                />
                <FlashBanners flash={flash} />
                {error && <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px] font-medium">{error}</div>}

                {/* 1. Files */}
                <SectionCard title="1. Choose your export" subtitle="Export your listings from your current CRM (usually Listings → Export → Excel), then drop the file here.">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                            onDragLeave={() => setDrag(false)}
                            onDrop={(e: DragEvent) => { e.preventDefault(); setDrag(false); readSheet(e.dataTransfer.files[0]); }}
                            onClick={() => sheetInput.current?.click()}
                            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-ink-50'}`}
                        >
                            <input ref={sheetInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => readSheet(e.target.files?.[0])} />
                            <div className="text-[14px] font-semibold">{reading === 'sheet' ? <span className="inline-flex items-center gap-2"><Spinner size={14} />Reading…</span> : fileName || 'Listings spreadsheet'}</div>
                            <p className="text-[12.5px] text-ink-500 mt-1">
                                {table ? `${rows.length} listing row${rows.length === 1 ? '' : 's'} found` : '.xlsx, .xls or .csv, one listing per row'}
                            </p>
                        </div>
                        <div onClick={() => zipInput.current?.click()}
                            className="cursor-pointer rounded-2xl border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-ink-50 p-6 text-center transition">
                            <input ref={zipInput} type="file" accept=".zip" className="hidden" onChange={(e) => readZip(e.target.files?.[0])} />
                            <div className="text-[14px] font-semibold">{reading === 'zip' ? <span className="inline-flex items-center gap-2"><Spinner size={14} />Opening ZIP…</span> : zipName || 'Photos ZIP (optional)'}</div>
                            <p className="text-[12.5px] text-ink-500 mt-1">
                                {zipPhotos
                                    ? `${zipPhotos.length} photos · matched to ${zipMatched} of ${rows.length} listings by reference`
                                    : 'A folder per listing named after its reference (ENT-101/1.jpg), or files named ENT-101_1.jpg'}
                            </p>
                        </div>
                    </div>
                    <p className="text-[12px] text-ink-500 mt-3">
                        No ZIP? If your export has a column of photo links, map it below and the photos are downloaded in the background.
                        Seller contact details are not imported; capture them on each listing so they stay protected under POPIA.
                    </p>
                </SectionCard>

                {/* 2. Mapping */}
                {table && mapping && (
                    <SectionCard title="2. Match the columns" subtitle="We guessed from your column names. Change any that are wrong, or set unused ones to “Not in my file”." flush>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead><tr className={thRowCls}><th className="px-5 py-2.5">Property Basket field</th><th className="px-3 py-2.5">Column in your file</th><th className="px-5 py-2.5">First value</th></tr></thead>
                                <tbody>
                                    {FIELDS.map((f) => {
                                        const j = mapping[f];
                                        const first = sample(j);
                                        return (
                                            <tr key={f} className="border-b border-ink-100 align-top">
                                                <td className="px-5 py-2.5">
                                                    <div className="font-semibold">{FIELD_LABELS[f]}{(f === 'price') && <span className="text-danger"> *</span>}</div>
                                                    {FIELD_HINTS[f] && <div className="text-[11.5px] text-ink-500 max-w-[340px]">{FIELD_HINTS[f]}</div>}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <select className={selectCls + ' max-w-[240px]'} value={j}
                                                        onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}>
                                                        <option value={-1}>Not in my file</option>
                                                        {headers.map((h, k) => <option key={k} value={k}>{h || `Column ${k + 1}`}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-5 py-2.5 text-ink-600 max-w-[320px] truncate">
                                                    {first !== undefined ? String(table[first - 1][j]).slice(0, 80) : <span className="text-ink-300">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-ink-200 bg-ink-50/50">
                            <label className="text-[12.5px] font-semibold">Exported from
                                <select className={selectCls + ' w-full mt-1'} value={source} onChange={(e) => setSource(e.target.value)}>
                                    {SOURCES.map((s) => <option key={s}>{s}</option>)}
                                </select>
                            </label>
                            <label className="text-[12.5px] font-semibold">If sale or rent is blank
                                <select className={selectCls + ' w-full mt-1'} value={defaultType} onChange={(e) => setDefaultType(e.target.value as 'for_sale' | 'long_term_rent')}>
                                    <option value="for_sale">For sale</option>
                                    <option value="long_term_rent">To rent</option>
                                </select>
                            </label>
                            <label className="text-[12.5px] font-semibold">Default agent
                                <select className={selectCls + ' w-full mt-1'} value={defaultAgent} onChange={(e) => setDefaultAgent(e.target.value ? Number(e.target.value) : '')}>
                                    <option value="">Unassigned</option>
                                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </label>
                            <label className="text-[12.5px] font-semibold flex items-start gap-2 pt-5">
                                <input type="checkbox" className="mt-0.5" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                                <span>Publish straight away<span className="block font-normal text-ink-500">Otherwise new listings wait as drafts below.</span></span>
                            </label>
                        </div>
                        <div className="p-5 flex flex-wrap items-center gap-3 border-t border-ink-200">
                            <button type="button" className={btnPrimary + ' min-w-[180px]'} disabled={busy || !rows.length || mapping.price < 0} onClick={run}>
                                {busy ? <><Spinner size={14} />Importing…</> : `Import ${rows.length} listing${rows.length === 1 ? '' : 's'}`}
                            </button>
                            <span className="text-[12.5px] text-ink-500">
                                {mapping.price < 0 ? 'Choose the price column to continue.'
                                    : noPrice ? `${noPrice} row${noPrice === 1 ? ' has' : 's have'} no price and will be skipped.`
                                        : mapping.external_ref < 0 ? 'Tip: map the listing reference so re-importing updates instead of duplicating.' : 'Re-importing the same file later updates these listings.'}
                            </span>
                        </div>
                    </SectionCard>
                )}

                {/* 3. Progress + results */}
                {phase && (
                    <SectionCard title={phase === 'done' ? 'Import finished' : phase === 'photos' ? 'Uploading photos…' : 'Importing listings…'}>
                        {busy && (
                            <div className="mb-4">
                                <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                                    <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                                </div>
                                <p className="text-[12px] text-ink-500 mt-1.5">{progress.done} of {progress.total}. Keep this tab open.</p>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-[12.5px]">
                            <span className="px-3 py-1 rounded-full bg-success/10 text-success font-semibold">{counts.created ?? 0} new</span>
                            <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 font-semibold">{counts.updated ?? 0} updated</span>
                            {(counts.skipped ?? 0) > 0 && <span className="px-3 py-1 rounded-full bg-warning/10 text-warning font-semibold">{counts.skipped} skipped</span>}
                            {(counts.failed ?? 0) > 0 && <span className="px-3 py-1 rounded-full bg-danger/10 text-danger font-semibold">{counts.failed} failed</span>}
                            {zipPhotos && <span className="px-3 py-1 rounded-full bg-ink-100 text-ink-700 font-semibold">{photoStats.ok} photos added{photoStats.failed ? ` · ${photoStats.failed} failed` : ''}</span>}
                        </div>
                        {results.some((r) => r.error) && (
                            <ul className="mt-3 text-[12.5px] text-ink-600 space-y-1 max-h-48 overflow-y-auto">
                                {results.filter((r) => r.error).slice(0, 100).map((r) => (
                                    <li key={r.row}>Row {r.row}{r.title ? ` (${r.title})` : ''}: {r.error}</li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                )}

                <DraftsTable drafts={drafts} />
            </section>
        </AgencyLayout>
    );
}

function DraftsTable({ drafts }: { drafts: Draft[] }) {
    const [sel, setSel] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const all = drafts.length > 0 && sel.length === drafts.length;
    const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

    function act(what: 'publish' | 'discard') {
        if (!sel.length) return;
        if (what === 'discard' && !window.confirm(`Delete ${sel.length} imported draft${sel.length === 1 ? '' : 's'}?`)) return;
        setBusy(true);
        router.post(`/agency/listings/import/${what}`, { ids: sel }, { preserveScroll: true, onSuccess: () => setSel([]), onFinish: () => setBusy(false) });
    }

    if (!drafts.length) return null;

    return (
        <SectionCard
            title={`Imported drafts (${drafts.length})`}
            subtitle="Not visible to the public yet. Check them, then publish. Listings without a title or price can’t be published."
            flush
            action={
                <div className="flex gap-2">
                    <button type="button" className={btnOutline} disabled={busy || !sel.length} onClick={() => act('discard')}>Delete</button>
                    <button type="button" className={btnPrimary} disabled={busy || !sel.length} onClick={() => act('publish')}>
                        {busy ? <Spinner size={14} /> : null}Publish {sel.length || ''}
                    </button>
                </div>
            }
        >
            <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className={thRowCls}>
                            <th className="px-5 py-2.5 w-10"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? [] : drafts.map((d) => d.id))} /></th>
                            <th className="px-3 py-2.5">Listing</th>
                            <th className="px-3 py-2.5">Reference</th>
                            <th className="px-3 py-2.5 text-right">Price</th>
                            <th className="px-3 py-2.5">Agent</th>
                            <th className="px-5 py-2.5">Photos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {drafts.map((d) => (
                            <tr key={d.id} className="border-b border-ink-100 hover:bg-ink-50/60">
                                <td className="px-5 py-2.5"><input type="checkbox" aria-label={`Select ${d.title}`} checked={sel.includes(d.id)} onChange={() => toggle(d.id)} /></td>
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-3 min-w-[240px]">
                                        {d.image ? <img src={d.image} alt="" className="w-12 h-9 rounded-md object-cover shrink-0" /> : <div className="w-12 h-9 rounded-md bg-ink-100 shrink-0" />}
                                        <div className="min-w-0">
                                            <div className="font-semibold truncate">{d.title}</div>
                                            <div className="text-[11.5px] text-ink-500 truncate">{d.type === 'long_term_rent' ? 'To rent' : 'For sale'}{d.place ? ` · ${d.place}` : ''}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-2.5 text-ink-600">{d.ref ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{d.price ? fmtMoney(d.price) + (d.type === 'long_term_rent' ? ' pm' : '') : <span className="text-danger">No price</span>}</td>
                                <td className="px-3 py-2.5 text-ink-600">{d.agent ?? <span className="text-ink-400">Unassigned</span>}</td>
                                <td className="px-5 py-2.5 text-ink-600 whitespace-nowrap">
                                    {d.photos}{d.photos_pending ? <span className="text-ink-400"> · {d.photos_pending} downloading</span> : ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}
