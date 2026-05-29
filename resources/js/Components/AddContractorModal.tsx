/**
 * AddContractorModal — opened from /agency/contractors "Add Contractor".
 * Creates a private Contractor row tied to the agency.
 */
import { FormEvent, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

type Props = { onClose: () => void };

const SPECIALITY_OPTIONS = [
    'Plumbing', 'Electrical', 'Painting', 'Roofing', 'Carpentry',
    'HVAC / Aircon', 'Locksmith', 'Garden / Landscaping', 'Pool care',
    'Pest control', 'Cleaning', 'Handyman', 'Tiling', 'Glazing',
];

const AREA_OPTIONS = [
    'Sandton', 'Rosebank', 'Bryanston', 'Fourways', 'Randburg',
    'Cape Town CBD', 'Sea Point', 'Camps Bay', 'Stellenbosch', 'Paarl',
    'Durban', 'uMhlanga', 'Pretoria', 'Centurion', 'Andeon',
];

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

export default function AddContractorModal({ onClose }: Props) {
    const [data, setData] = useState({
        business_name: '',
        contact_name:  '',
        email:         '',
        phone:         '',
        specialities:  [] as string[],
        service_areas: [] as string[],
    });
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors]         = useState<Record<string, string>>({});

    function set<K extends keyof typeof data>(key: K, value: (typeof data)[K]) {
        setData((d) => ({ ...d, [key]: value }));
    }
    function toggle(field: 'specialities' | 'service_areas', value: string) {
        setData((d) => ({
            ...d,
            [field]: d[field].includes(value) ? d[field].filter((v) => v !== value) : [...d[field], value],
        }));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        setProcessing(true);
        router.post('/agency/contractors', data, {
            onSuccess: () => onClose(),
            onError:   (errs) => setErrors(errs as Record<string, string>),
            onFinish:  () => setProcessing(false),
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white rounded-xl shadow-lift max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold">Add a contractor</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            Adds them to your private contractor list — only your agency will see them.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Business name *</label>
                            <input
                                value={data.business_name}
                                onChange={(e) => set('business_name', e.target.value)}
                                required
                                placeholder="e.g. Sandton Plumbing Co."
                                className={inputCls}
                            />
                            {errors.business_name && <p className="text-[11px] text-danger mt-1">{errors.business_name}</p>}
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Contact name *</label>
                            <input
                                value={data.contact_name}
                                onChange={(e) => set('contact_name', e.target.value)}
                                required
                                placeholder="e.g. Thabo Mokoena"
                                className={inputCls}
                            />
                            {errors.contact_name && <p className="text-[11px] text-danger mt-1">{errors.contact_name}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Email *</label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) => set('email', e.target.value)}
                                required
                                placeholder="thabo@sandtonplumbing.co.za"
                                className={inputCls}
                            />
                            {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Phone</label>
                            <input
                                value={data.phone}
                                onChange={(e) => set('phone', e.target.value)}
                                placeholder="+27 82 555 1234"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Specialities</label>
                        <div className="flex flex-wrap gap-1.5">
                            {SPECIALITY_OPTIONS.map((s) => {
                                const on = data.specialities.includes(s);
                                return (
                                    <button
                                        type="button"
                                        key={s}
                                        onClick={() => toggle('specialities', s)}
                                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium border transition ${
                                            on ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Service areas</label>
                        <div className="flex flex-wrap gap-1.5">
                            {AREA_OPTIONS.map((s) => {
                                const on = data.service_areas.includes(s);
                                return (
                                    <button
                                        type="button"
                                        key={s}
                                        onClick={() => toggle('service_areas', s)}
                                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium border transition ${
                                            on ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || ! data.business_name || ! data.contact_name || ! data.email}
                            className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Adding…' : 'Add to my list'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
