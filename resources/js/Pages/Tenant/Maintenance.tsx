import { useState, FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import RateContractorModal, { StarRow } from '@/Components/RateContractorModal';
import { PageHeader, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';

type Item = {
    id: number;
    title: string;
    description: string;
    category: string;
    urgency: string;
    status: string;
    logged_at: string;
    completed_at: string | null;
    photo_count: number;
    contractor: { name: string; initials: string } | null;
    preferred_date: string | null;
    preferred_slot: string | null;
    can_rate: boolean;
    my_rating: number | null;
};

type Props = {
    tenant: { id: number; name: string };
    lease: { id: number; address: string; managed_by: string | null; is_agency: boolean };
    active: Item[];
    past: Item[];
};

const CATEGORIES = ['plumbing', 'electrical', 'appliances', 'structural', 'garden', 'other'] as const;
const URGENCIES = ['low', 'medium', 'high', 'emergency'] as const;
const SLOTS = ['Morning (08:00 – 12:00)', 'Afternoon (12:00 – 17:00)', 'After hours (17:00 – 20:00)'] as const;

const urgencyTone = (u: string) => {
    if (u === 'emergency') return 'bg-danger/15 text-danger';
    if (u === 'high') return 'bg-warning/20 text-amber-700';
    if (u === 'medium') return 'bg-warning/10 text-amber-700';
    return 'bg-ink-100 text-ink-700';
};

const statusTone = (s: string) => {
    if (s === 'in_progress') return 'bg-brand-50 text-brand-700';
    if (s === 'completed' || s === 'paid') return 'bg-success/15 text-success';
    if (s === 'awaiting_quotes') return 'bg-warning/15 text-amber-700';
    return 'bg-ink-100 text-ink-700';
};

const categoryIcon = (c: string) => {
    const colors: Record<string, string> = {
        plumbing:   'bg-sky-50 text-sky-600',
        electrical: 'bg-amber-50 text-amber-600',
        appliances: 'bg-rose-50 text-rose-600',
        structural: 'bg-stone-50 text-stone-700',
        garden:     'bg-emerald-50 text-emerald-600',
        other:      'bg-ink-100 text-ink-700',
    };
    return colors[c] ?? colors.other;
};

const fieldCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';
const chipCls = (on: boolean, danger = false) =>
    'text-[12px] px-3 py-1.5 rounded-full border font-semibold capitalize transition ' +
    (on
        ? (danger ? 'border-danger/40 bg-danger/10 text-danger' : 'border-brand-600 bg-brand-50 text-brand-800')
        : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300');

export default function TenantMaintenance({ lease, active, past }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [ratingItem, setRatingItem] = useState<Item | null>(null);
    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        description: '',
        category: 'plumbing' as typeof CATEGORIES[number],
        urgency: 'medium' as typeof URGENCIES[number],
        preferred_date: '',
        preferred_time_slot: SLOTS[0] as string,
        photos: [] as File[],
    });

    const MAX_PHOTOS = 8;
    const receiver = lease.is_agency ? 'your agency' : (lease.managed_by ?? 'your landlord');

    function addPhotos(files: FileList | null) {
        if (! files || files.length === 0) return;
        const picked = Array.from(files);
        setData('photos', [...data.photos, ...picked].slice(0, MAX_PHOTOS));
    }
    function removePhoto(i: number) {
        setData('photos', data.photos.filter((_, idx) => idx !== i));
    }

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/tenant/maintenance', {
            preserveScroll: true,
            forceFormData: true, // photos are File objects
            onSuccess: () => {
                reset();
                setShowForm(false);
            },
        });
    };

    const inProgress = active.filter((r) => r.status === 'in_progress').length;
    const awaiting = active.length - inProgress;

    return (
        <TenantLayout crumb="Maintenance" leaseAddress={lease.address}>
            <Head title="Maintenance" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Maintenance"
                    subtitle={<>Report an issue and {receiver} will assign a contractor to fix it.</>}
                    actions={
                        <button onClick={() => setShowForm((s) => !s)} className={showForm ? btnOutline : btnPrimary}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d={showForm ? 'M18 6 6 18M6 6l12 12' : 'M12 5v14M5 12h14'} /></svg>
                            {showForm ? 'Close form' : 'New request'}
                        </button>
                    }
                />

                {/* Summary tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                        <p className="text-[13px] font-medium">Open requests</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{active.length}</p>
                        <p className="text-[12px] text-white/80 mt-2">{active.length === 0 ? 'Nothing outstanding' : `${awaiting} awaiting a contractor`}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">In progress</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{inProgress}</p>
                        <p className="text-[12px] text-ink-500 mt-2">Contractor working on it</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Resolved</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{past.length}</p>
                        <p className="text-[12px] text-ink-500 mt-2">Completed jobs on this lease</p>
                    </div>
                </div>

                {showForm && (
                    <form onSubmit={submit} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-4 pb-rise">
                        <div className="p-5 border-b border-ink-200">
                            <h2 className="text-[16px] font-semibold tracking-tight">Report a new issue</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Fill in the details — {receiver} will assign a contractor and keep you updated.</p>
                        </div>
                        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Issue title</label>
                                    <input value={data.title} onChange={(e) => setData('title', e.target.value)} className={fieldCls} placeholder="e.g. Leaking kitchen tap" />
                                    {errors.title && <p className="text-[11px] text-danger mt-1">{errors.title}</p>}
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-2 block">Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        {CATEGORIES.map((c) => (
                                            <button type="button" key={c} onClick={() => setData('category', c)} className={chipCls(data.category === c)}>{c}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-2 block">Urgency</label>
                                    <div className="flex flex-wrap gap-2">
                                        {URGENCIES.map((u) => (
                                            <button type="button" key={u} onClick={() => setData('urgency', u)} className={chipCls(data.urgency === u, u === 'emergency')}>{u}</button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-ink-500 mt-2">Emergency = water or gas leak, electrical fault, security breach. 4-hour response.</p>
                                </div>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Description</label>
                                    <textarea value={data.description} onChange={(e) => setData('description', e.target.value)} className={fieldCls} rows={4} placeholder="Describe the issue in detail…" />
                                    {errors.description && <p className="text-[11px] text-danger mt-1">{errors.description}</p>}
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Preferred visit</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input type="date" value={data.preferred_date} onChange={(e) => setData('preferred_date', e.target.value)} className={fieldCls} />
                                        <select value={data.preferred_time_slot} onChange={(e) => setData('preferred_time_slot', e.target.value)} className={fieldCls}>
                                            {SLOTS.map((s) => <option key={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-ink-500 mt-1.5">The contractor will confirm or propose another time.</p>
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                                        Photos <span className="text-ink-400 font-normal">— help the contractor see the problem</span>
                                    </label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {data.photos.map((photo, i) => (
                                            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-ink-200 bg-white group">
                                                <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo"
                                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-ink-900/70 text-white text-[10px] leading-none grid place-items-center opacity-0 group-hover:opacity-100 transition">×</button>
                                            </div>
                                        ))}
                                        {data.photos.length < MAX_PHOTOS && (
                                            <>
                                                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-ink-300 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer grid place-items-center text-ink-400 hover:text-brand-600 transition" title="Upload photos">
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                                                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                                                </label>
                                                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-ink-300 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer grid place-items-center text-ink-400 hover:text-brand-600 transition" title="Take a photo">
                                                    <Icon name="camera" className="w-5 h-5" />
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-ink-500 mt-1.5">{data.photos.length}/{MAX_PHOTOS} photos · upload or take one with your phone</p>
                                    {errors.photos && <p className="text-[11px] text-danger mt-1">{errors.photos}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-4 bg-ink-50 border-t border-ink-200 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[12px] text-ink-500">Your request goes straight to {receiver}.</p>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setShowForm(false)} className={btnOutline}>Cancel</button>
                                <button type="submit" disabled={processing} className={btnPrimary}>{processing ? 'Submitting…' : 'Submit request'}</button>
                            </div>
                        </div>
                    </form>
                )}

                {active.length === 0 && past.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-10 text-center">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
                            <Icon name="wrench" className="w-6 h-6" />
                        </div>
                        <p className="text-[14px] font-semibold">No maintenance requests yet</p>
                        <p className="text-[12.5px] text-ink-500 mt-1">If something needs fixing, log it here with a few photos.</p>
                        <button onClick={() => setShowForm(true)} className={btnPrimary + ' mt-4'}>Log your first request</button>
                    </div>
                ) : (
                    <>
                        {active.length > 0 && (
                            <div className="mb-4">
                                <h2 className="text-[16px] font-semibold tracking-tight mb-3">Open requests</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {active.map((r) => <Card key={r.id} item={r} active onRate={setRatingItem} />)}
                                </div>
                            </div>
                        )}
                        {past.length > 0 && (
                            <div>
                                <h2 className="text-[16px] font-semibold tracking-tight mb-3">History</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {past.map((r) => <Card key={r.id} item={r} active={false} onRate={setRatingItem} />)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            {ratingItem && (
                <RateContractorModal
                    rateUrl={`/tenant/maintenance/${ratingItem.id}/rate`}
                    contractorName={ratingItem.contractor?.name ?? null}
                    jobTitle={ratingItem.title}
                    onClose={() => setRatingItem(null)}
                />
            )}
        </TenantLayout>
    );
}

function Card({ item, active, onRate }: { item: Item; active: boolean; onRate: (i: Item) => void }) {
    return (
        <div className={`bg-white rounded-2xl shadow-soft overflow-hidden border pb-rise ${active ? 'border-brand-300' : 'border-ink-200/60'}`}>
            <div className="p-5">
                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${categoryIcon(item.category)}`}>
                        <Icon name="wrench" className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-semibold">{item.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${urgencyTone(item.urgency)}`}>{item.urgency === 'emergency' ? 'Emergency' : item.urgency}</span>
                        </div>
                        <p className="text-[11.5px] text-ink-500 mt-0.5 capitalize">
                            {item.category} · logged {item.logged_at}{item.completed_at ? ` · resolved ${item.completed_at}` : ''}
                        </p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase whitespace-nowrap ${statusTone(item.status)}`}>
                        {item.status.replace('_', ' ')}
                    </span>
                </div>
                {item.description && <p className="text-[12.5px] text-ink-700 mt-3 line-clamp-2">{item.description}</p>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11.5px] text-ink-500">
                    {item.photo_count > 0 && <span className="inline-flex items-center gap-1.5"><Icon name="camera" />{item.photo_count} photo{item.photo_count === 1 ? '' : 's'}</span>}
                    {active && item.preferred_date && <span className="inline-flex items-center gap-1.5"><Icon name="calendar" />{item.preferred_date} · {item.preferred_slot}</span>}
                </div>
            </div>
            <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/50 flex flex-wrap items-center justify-between gap-2">
                {item.contractor ? (
                    <div className="flex items-center gap-2 text-[12px]">
                        <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-[10px] font-bold">{item.contractor.initials}</span>
                        <span><span className="font-semibold">{item.contractor.name}</span><span className="text-ink-500"> · contractor</span></span>
                    </div>
                ) : (
                    <span className="text-[12px] text-ink-500">{active ? 'Waiting for a contractor to be assigned' : 'No contractor recorded'}</span>
                )}
                {!active && item.can_rate && (
                    item.my_rating ? (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-600">You rated <StarRow rating={item.my_rating} /></span>
                    ) : (
                        <button onClick={() => onRate(item)} className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-amber-700 px-3 py-1 text-[11.5px] font-semibold hover:bg-warning/25 transition">
                            <span>★</span> Rate contractor
                        </button>
                    )
                )}
            </div>
        </div>
    );
}
