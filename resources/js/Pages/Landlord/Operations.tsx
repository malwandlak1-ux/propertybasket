import { FormEvent, useMemo, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { AreaChart, FlashBanners, PageHeader, Segmented, SummaryStrip, btnOutline, btnPrimary, thRowCls } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';

type Type = 'income' | 'expense';
type Entry = {
    id: number; date: string; type: Type; category: string; category_label: string; description: string;
    property_id: number | null; property: string; counterparty: string | null; reference: string | null;
    notes: string | null; amount: number; has_attachment: boolean; attachment_name: string | null;
};
type CatRow = { category: string; label: string; amount: number; count: number; share: number };
type Props = {
    summary: {
        totals: { other_income: number; operating_expenses: number; net: number; coverage_pct: number | null };
        expenses_by_category: CatRow[];
        income_by_category: CatRow[];
        months: { month: string; label: string; income: number; expenses: number; net: number }[];
    };
    entries: Entry[];
    filters: { range: string; range_label: string; property: number | 'facility' | null; type: Type | null; from: string; to: string };
    ranges: { key: string; label: string }[];
    properties: { id: number; name: string }[];
    categories: Record<Type, Record<string, string>>;
};

const R = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const R0 = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;

export default function LandlordOperations({ summary, entries, filters, ranges, properties, categories }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const loading = useInertiaLoading();
    const [editing, setEditing] = useState<{ type: Type; entry?: Entry } | null>(null);
    const t = summary.totals;

    function apply(next: Partial<{ range: string; property: string; type: string }>) {
        const f = { range: filters.range, property: filters.property ? String(filters.property) : '', type: filters.type ?? '', ...next };
        const q: Record<string, string> = { range: f.range };
        if (f.property) q.property = f.property;
        if (f.type) q.type = f.type;
        router.get('/landlord/operations', q, { preserveScroll: true, preserveState: true });
    }
    const csvQuery = new URLSearchParams({ range: filters.range, ...(filters.property ? { property: String(filters.property) } : {}), ...(filters.type ? { type: filters.type } : {}) }).toString();

    return (
        <LandlordLayout crumb="Operations" section="Finance">
            <Head title="Facility operations" />
            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Facility Operations"
                    subtitle="Running costs and other income of the facility, kept separate from rent and maintenance"
                    actions={<>
                        <button type="button" onClick={() => setEditing({ type: 'income' })} className={btnOutline}>+ Add income</button>
                        <button type="button" onClick={() => setEditing({ type: 'expense' })} className={btnPrimary}>+ Add expense</button>
                    </>}
                />
                <FlashBanners flash={flash} />

                <div className="mb-4 rounded-2xl bg-sky-50 border border-sky-200 px-5 py-3 text-[12.5px] text-sky-900">
                    Tenants’ rent already includes water and electricity, so these entries <b>don’t change rent, maintenance or the Finance statements</b>.
                    Other income captured here is what balances these operating costs.
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-4 mb-4 flex flex-col xl:flex-row xl:items-center gap-3">
                    <select
                        value={filters.property ?? ''}
                        onChange={(e) => apply({ property: e.target.value })}
                        className="w-full sm:w-[280px] bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                    >
                        <option value="">Everything</option>
                        <option value="facility">Whole facility only</option>
                        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="overflow-x-auto -mx-1 px-1">
                        <Segmented options={ranges.map((r) => ({ value: r.key, label: r.label }))} value={filters.range} onChange={(range) => apply({ range })} />
                    </div>
                    <div className="flex items-center gap-3 xl:ml-auto">
                        <span className="text-[12px] text-ink-500 whitespace-nowrap">{filters.from} – {filters.to}</span>
                        <a href={`/landlord/operations/export.csv?${csvQuery}`} className={btnPrimary + ' whitespace-nowrap'}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                            Download CSV
                        </a>
                    </div>
                </div>

                <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                    <SummaryStrip
                        title="Operations summary"
                        cells={[
                            { label: 'Net position', value: (t.net < 0 ? '- ' : '') + R0(Math.abs(t.net)), sub: t.net >= 0 ? 'Other income covers running costs' : 'Running costs exceed other income' },
                            { label: 'Other income', value: R0(t.other_income), sub: filters.range_label, tone: 'success' },
                            { label: 'Operating expenses', value: R0(t.operating_expenses), sub: filters.range_label, tone: 'muted' },
                            { label: 'Cost coverage', value: t.coverage_pct === null ? '—' : `${Math.round(t.coverage_pct)}%`, sub: 'Other income ÷ expenses', tone: t.coverage_pct !== null && t.coverage_pct < 100 ? 'danger' : 'success' },
                        ]}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <section className="lg:col-span-2 bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise">
                            <h2 className="text-[16px] font-semibold tracking-tight">Income vs running costs</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5 mb-4">Per month · {filters.range_label.toLowerCase()}</p>
                            <ErrorBoundary variant="section" label="operations chart">
                                <AreaChart
                                    labels={summary.months.map((m) => m.label)}
                                    series={summary.months.map((m) => m.income)}
                                    previous={summary.months.map((m) => m.expenses)}
                                    seriesLabel="Other income"
                                    previousLabel="Operating expenses"
                                    format={R0}
                                    height={230}
                                />
                            </ErrorBoundary>
                        </section>
                        <CategoryCard title="Expenses by category" rows={summary.expenses_by_category} total={t.operating_expenses} tone="bg-brand-600" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <CategoryCard title="Other income by source" rows={summary.income_by_category} total={t.other_income} tone="bg-success" />
                        <section className="lg:col-span-2 bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                            <div className="p-5 border-b border-ink-200 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-[16px] font-semibold tracking-tight">Ledger</h2>
                                    <p className="text-[12px] text-ink-500 mt-0.5">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</p>
                                </div>
                                <Segmented
                                    options={[{ value: '', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]}
                                    value={filters.type ?? ''}
                                    onChange={(type) => apply({ type })}
                                />
                            </div>
                            {entries.length === 0 ? (
                                <p className="py-12 text-center text-[13px] text-ink-400">Nothing captured for this period yet. Use <b>+ Add expense</b> or <b>+ Add income</b>.</p>
                            ) : (
                                <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-[13px]">
                                    <thead><tr className={thRowCls}>
                                        <th className="font-semibold py-3 pl-5 pr-3">Date</th>
                                        <th className="font-semibold py-3 px-3">Category</th>
                                        <th className="font-semibold py-3 px-3">Description</th>
                                        <th className="font-semibold py-3 px-3">Property</th>
                                        <th className="font-semibold py-3 px-3 pr-5 text-right">Amount</th>
                                    </tr></thead>
                                    <tbody>
                                        {entries.map((e) => (
                                            <tr key={e.id} className="border-b border-ink-100 hover:bg-brand-50/50 cursor-pointer" onClick={() => setEditing({ type: e.type, entry: e })}>
                                                <td className="py-3 pl-5 pr-3 whitespace-nowrap text-ink-600">{e.date}</td>
                                                <td className="py-3 px-3">
                                                    <span className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${e.type === 'income' ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-600'}`}>{e.type}</span>
                                                    <span className="block text-[12px] text-ink-600 mt-1">{e.category_label}</span>
                                                </td>
                                                <td className="py-3 px-3 max-w-[260px]">
                                                    <span className="block font-semibold truncate">{e.description}</span>
                                                    <span className="block text-[11.5px] text-ink-500 truncate">
                                                        {[e.counterparty, e.reference && `Ref ${e.reference}`].filter(Boolean).join(' · ')}
                                                        {e.has_attachment && <> · <a href={`/landlord/operations/${e.id}/attachment`} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="text-brand-700 font-semibold hover:underline">receipt</a></>}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-ink-600">{e.property}</td>
                                                <td className={`py-3 px-3 pr-5 text-right tabular-nums font-semibold whitespace-nowrap ${e.type === 'income' ? 'text-success' : ''}`}>
                                                    {e.type === 'income' ? '+ ' : '- '}{R(e.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table></div>
                            )}
                        </section>
                    </div>
                </div>
            </section>

            {editing && (
                <EntryModal
                    key={editing.entry?.id ?? editing.type}
                    type={editing.type}
                    entry={editing.entry}
                    categories={categories}
                    properties={properties}
                    onClose={() => setEditing(null)}
                />
            )}
        </LandlordLayout>
    );
}

function CategoryCard({ title, rows, total, tone }: { title: string; rows: CatRow[]; total: number; tone: string }) {
    return (
        <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise">
            <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
            <p className="text-[12px] text-ink-500 mt-0.5 mb-4">Total {R0(total)}</p>
            <ul className="space-y-3">
                {rows.map((r) => (
                    <li key={r.category}>
                        <div className="flex justify-between gap-3 text-[12.5px]">
                            <span className="text-ink-700 font-medium truncate">{r.label}</span>
                            <span className="font-semibold tabular-nums whitespace-nowrap">{R0(r.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden mt-1.5">
                            <span className={`block h-full rounded-full ${tone}`} style={{ width: `${r.share}%` }} />
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

const input = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
const label = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

function EntryModal({ type: initialType, entry, categories, properties, onClose }: {
    type: Type; entry?: Entry; categories: Props['categories']; properties: Props['properties']; onClose: () => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const form = useForm({
        type: entry?.type ?? initialType,
        category: entry?.category ?? Object.keys(categories[initialType])[0],
        description: entry?.description ?? '',
        amount: entry ? String(entry.amount) : '',
        entry_date: entry?.date ?? today,
        listing_id: entry?.property_id ? String(entry.property_id) : '',
        counterparty: entry?.counterparty ?? '',
        reference: entry?.reference ?? '',
        notes: entry?.notes ?? '',
        attachment: null as File | null,
        remove_attachment: false,
    });
    const cats = useMemo(() => Object.entries(categories[form.data.type]), [categories, form.data.type]);
    const isIncome = form.data.type === 'income';

    function setType(t: Type) {
        form.setData((d) => ({ ...d, type: t, category: Object.keys(categories[t])[0] }));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        form.transform((d) => ({ ...d, listing_id: d.listing_id || null }));
        form.post(entry ? `/landlord/operations/${entry.id}` : '/landlord/operations', { preserveScroll: true, forceFormData: true, onSuccess: onClose });
    }

    function destroy() {
        if (entry && confirm(`Delete this ${entry.type} of ${R(entry.amount)}?`)) {
            router.delete(`/landlord/operations/${entry.id}`, { preserveScroll: true, onSuccess: onClose });
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-lift w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                <div>
                    <h2 className="text-lg font-semibold">{entry ? 'Edit entry' : isIncome ? 'Add other income' : 'Add operating expense'}</h2>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">Kept separate from rent and maintenance.</p>
                </div>
                <Segmented<Type> options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} value={form.data.type} onChange={setType} />
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <label className={label}>{isIncome ? 'Income source' : 'Expense category'} *</label>
                        <select value={form.data.category} onChange={(e) => form.setData('category', e.target.value)} className={input}>
                            {cats.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        {form.errors.category && <p className="text-[11px] text-danger mt-1">{form.errors.category}</p>}
                    </div>
                    <div className="col-span-2">
                        <label className={label}>Description *</label>
                        <input value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} maxLength={255}
                            placeholder={isIncome ? 'e.g. Canteen sales, September' : 'e.g. City of Tshwane account, September'} className={input} />
                        {form.errors.description && <p className="text-[11px] text-danger mt-1">{form.errors.description}</p>}
                    </div>
                    <div>
                        <label className={label}>Amount (R) *</label>
                        <input value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0.00" className={input} />
                        {form.errors.amount && <p className="text-[11px] text-danger mt-1">{form.errors.amount}</p>}
                    </div>
                    <div>
                        <label className={label}>Date *</label>
                        <input type="date" value={form.data.entry_date} onChange={(e) => form.setData('entry_date', e.target.value)} className={input} />
                        {form.errors.entry_date && <p className="text-[11px] text-danger mt-1">{form.errors.entry_date}</p>}
                    </div>
                    <div className="col-span-2">
                        <label className={label}>Property</label>
                        <select value={form.data.listing_id} onChange={(e) => form.setData('listing_id', e.target.value)} className={input}>
                            <option value="">Whole facility</option>
                            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={label}>{isIncome ? 'Received from' : 'Paid to'}</label>
                        <input value={form.data.counterparty} onChange={(e) => form.setData('counterparty', e.target.value)} maxLength={160} placeholder={isIncome ? 'e.g. Canteen operator' : 'e.g. City of Tshwane'} className={input} />
                    </div>
                    <div>
                        <label className={label}>Reference</label>
                        <input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} maxLength={80} placeholder="Invoice / account no." className={input} />
                    </div>
                    <div className="col-span-2">
                        <label className={label}>Notes</label>
                        <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={2} maxLength={2000} className={input + ' resize-y'} />
                    </div>
                    <div className="col-span-2">
                        <label className={label}>{isIncome ? 'Proof (optional)' : 'Invoice / receipt (optional)'}</label>
                        {entry?.has_attachment && !form.data.remove_attachment && (
                            <p className="text-[12px] mb-1.5">
                                <a href={`/landlord/operations/${entry.id}/attachment`} target="_blank" rel="noreferrer" className="text-brand-700 font-semibold hover:underline">{entry.attachment_name ?? 'Current file'}</a>
                                <button type="button" onClick={() => form.setData('remove_attachment', true)} className="ml-2 text-danger font-semibold hover:underline">Remove</button>
                            </p>
                        )}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => form.setData('attachment', e.target.files?.[0] ?? null)}
                            className="block w-full text-[12.5px] file:mr-3 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-[12px] file:font-semibold file:bg-brand-50 file:text-brand-700" />
                        <p className="text-[11px] text-ink-400 mt-1">PDF or image, up to 10 MB.</p>
                        {form.errors.attachment && <p className="text-[11px] text-danger mt-1">{form.errors.attachment}</p>}
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                    {entry ? <button type="button" onClick={destroy} className="px-4 py-2.5 rounded-full text-[13px] font-semibold text-danger hover:bg-danger/10">Delete</button> : <span />}
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className={btnOutline}>Cancel</button>
                        <button type="submit" disabled={form.processing} className={btnPrimary}>{form.processing && <Spinner size={13} />}{entry ? 'Save' : isIncome ? 'Add income' : 'Add expense'}</button>
                    </div>
                </div>
            </form>
        </div>
    );
}
