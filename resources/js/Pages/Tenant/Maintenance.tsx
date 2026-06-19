import { useState, FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import RateContractorModal, { StarRow } from '@/Components/RateContractorModal';

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
    lease: { id: number; address: string };
    active: Item[];
    past: Item[];
};

const CATEGORIES = ['plumbing', 'electrical', 'appliances', 'structural', 'garden', 'other'] as const;
const URGENCIES = ['low', 'medium', 'high', 'emergency'] as const;
const SLOTS = ['Morning (08:00 – 12:00)', 'Afternoon (12:00 – 17:00)', 'After hours (17:00 – 20:00)'] as const;

const urgencyTone = (u: string) => {
    if (u === 'emergency') return 'bg-danger/15 text-danger';
    if (u === 'high') return 'bg-warning/20 text-warning';
    if (u === 'medium') return 'bg-warning/15 text-warning';
    return 'bg-ink-100 text-ink-700';
};

const statusTone = (s: string) => {
    if (s === 'in_progress') return 'bg-brand-50 text-brand-700';
    if (s === 'completed' || s === 'paid') return 'bg-success/15 text-success';
    if (s === 'awaiting_quotes') return 'bg-warning/15 text-warning';
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

    return (
        <TenantLayout crumb="Maintenance" leaseAddress={lease.address}>
            <Head title="Maintenance" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Report issues. Your agency receives the request and assigns a verified contractor.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm((s) => !s)}
                        className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                        {showForm ? 'Hide form' : 'New Request'}
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden mb-6">
                        <div className="p-5 border-b border-ink-200 bg-gradient-to-r from-brand-50 to-violet-50">
                            <p className="text-[13px] font-bold">Report a new issue</p>
                            <p className="text-[11px] text-ink-500 mt-0.5">Fill in the details — your agency will assign a contractor and notify you.</p>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Issue title</label>
                                    <input
                                        value={data.title}
                                        onChange={(e) => setData('title', e.target.value)}
                                        className="w-full bg-ink-50 border border-ink-200 rounded-md px-3 py-2 text-[13px]"
                                        placeholder="e.g. Leaking kitchen tap"
                                    />
                                    {errors.title && <p className="text-[11px] text-danger mt-1">{errors.title}</p>}
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Category</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {CATEGORIES.map((c) => (
                                            <button
                                                type="button"
                                                key={c}
                                                onClick={() => setData('category', c)}
                                                className={`text-[11px] px-2 py-2 rounded-md border font-semibold capitalize transition ${
                                                    data.category === c
                                                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                        : 'border-ink-200 hover:border-brand-500 hover:bg-brand-50'
                                                }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Urgency</label>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                        {URGENCIES.map((u) => (
                                            <button
                                                type="button"
                                                key={u}
                                                onClick={() => setData('urgency', u)}
                                                className={`text-[11px] px-2 py-2 rounded-md border font-semibold capitalize ${
                                                    data.urgency === u
                                                        ? (u === 'emergency'
                                                            ? 'border-danger/30 bg-danger/5 text-danger'
                                                            : 'border-brand-500 bg-brand-50 text-brand-700')
                                                        : 'border-ink-200 hover:bg-ink-100'
                                                }`}
                                            >
                                                {u === 'emergency' ? '🚨 Emergency' : u}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-ink-500 mt-1.5 italic">
                                        Emergency = water/gas leak, electrical fault, security breach. 4-hour response SLA.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Description</label>
                                    <textarea
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        className="w-full bg-ink-50 border border-ink-200 rounded-md px-3 py-2 text-[13px]"
                                        rows={4}
                                        placeholder="Describe the issue in detail..."
                                    />
                                    {errors.description && <p className="text-[11px] text-danger mt-1">{errors.description}</p>}
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Preferred visit slot</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            value={data.preferred_date}
                                            onChange={(e) => setData('preferred_date', e.target.value)}
                                            className="bg-ink-50 border border-ink-200 rounded-md px-3 py-2 text-[12px]"
                                        />
                                        <select
                                            value={data.preferred_time_slot}
                                            onChange={(e) => setData('preferred_time_slot', e.target.value)}
                                            className="bg-ink-50 border border-ink-200 rounded-md px-3 py-2 text-[12px]"
                                        >
                                            {SLOTS.map((s) => <option key={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <p className="text-[10px] text-ink-500 mt-1.5">Contractor will confirm or propose alternative.</p>
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                                        Photos <span className="text-ink-400 font-normal">— help the contractor see the problem</span>
                                    </label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {data.photos.map((photo, i) => (
                                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-ink-200 bg-white group">
                                                <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removePhoto(i)}
                                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-ink-900/70 text-white text-[10px] leading-none grid place-items-center opacity-0 group-hover:opacity-100 transition"
                                                    aria-label="Remove photo"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        {data.photos.length < MAX_PHOTOS && (
                                            <>
                                                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-ink-300 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer grid place-items-center text-ink-400 hover:text-brand-600 transition" title="Upload photos">
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                                                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                                                </label>
                                                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-ink-300 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer grid place-items-center text-ink-400 hover:text-brand-600 transition" title="Take a photo">
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-ink-500 mt-1.5">{data.photos.length}/{MAX_PHOTOS} photos · upload or capture from your phone</p>
                                    {errors.photos && <p className="text-[11px] text-danger mt-1">{errors.photos}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="p-5 bg-ink-50 border-t border-ink-200 flex items-center justify-between">
                            <p className="text-[11px] text-ink-500">Submitted requests go to your agency for contractor assignment.</p>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-[12px] border border-ink-200 rounded-md hover:bg-white">Cancel</button>
                                <button type="submit" disabled={processing} className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-md font-semibold disabled:opacity-50">
                                    {processing ? 'Submitting…' : 'Submit request →'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                <h2 className="text-base font-semibold mb-3">My Requests</h2>

                {active.length === 0 && past.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center">
                        <p className="text-[13px] text-ink-500">You haven't logged any maintenance requests yet.</p>
                        <button onClick={() => setShowForm(true)} className="mt-3 text-[12px] font-semibold text-brand-600">Log your first request →</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {active.map((r) => (
                            <Card key={r.id} item={r} active onRate={setRatingItem} />
                        ))}
                        {past.map((r) => (
                            <Card key={r.id} item={r} active={false} onRate={setRatingItem} />
                        ))}
                    </div>
                )}
            </div>

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
        <div className={`bg-white rounded-xl shadow-soft overflow-hidden ${active ? 'border-2 border-brand-500 shadow-card' : 'border border-ink-200'}`}>
            <div className="p-5 border-b border-ink-200">
                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${categoryIcon(item.category)}`}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12h18M3 6h18M3 18h12"/></svg>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-[14px] font-bold">{item.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${urgencyTone(item.urgency)}`}>{item.urgency}</span>
                        </div>
                        <p className="text-[11px] text-ink-500 mt-0.5 capitalize">
                            {item.category} · Logged {item.logged_at}{item.completed_at ? ` · Resolved ${item.completed_at}` : ''}
                        </p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusTone(item.status)}`}>
                        {item.status.replace('_', ' ')}
                    </span>
                </div>
            </div>
            <div className="p-5">
                {item.description && (
                    <p className="text-[12px] text-ink-700 mb-3 line-clamp-2">{item.description}</p>
                )}
                {item.contractor && (
                    <div className="bg-ink-50 rounded-md p-2.5 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[9px] font-bold">
                            {item.contractor.initials}
                        </div>
                        <div className="text-[11px]">
                            <span className="font-semibold">{item.contractor.name}</span>
                            <span className="text-ink-500"> · Assigned contractor</span>
                        </div>
                    </div>
                )}
                {active && item.preferred_date && (
                    <p className="text-[11px] text-ink-500">Visit: {item.preferred_date} · {item.preferred_slot}</p>
                )}
                {!active && (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[11px] text-success">⭐ Job completed</p>
                        {item.can_rate && (
                            item.my_rating ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-600">
                                    You rated <StarRow rating={item.my_rating} />
                                </span>
                            ) : (
                                <button
                                    onClick={() => onRate(item)}
                                    className="text-[11px] px-2.5 py-1.5 bg-warning/15 text-warning rounded-md font-bold hover:bg-warning/25 transition"
                                >
                                    ★ Rate contractor
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
