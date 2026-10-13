/**
 * InviteContractorModal: landlord adds a contractor to their own roster
 * (POST /landlord/contractors). Used on the Contractors page and from the
 * Maintenance board's "Request a quote" picker.
 */
import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';

const SPECIALITIES = [
    'Plumbing', 'Electrical', 'Appliances', 'Structural', 'Painting', 'Roofing', 'Carpentry',
    'Garden', 'Locksmith', 'Pest control', 'Cleaning', 'Handyman', 'Tiling', 'Glazing',
];

const inputCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export default function InviteContractorModal({ onClose }: { onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({
        business_name: '',
        contact_name: '',
        email: '',
        phone: '',
        specialities: [] as string[],
    });

    function toggle(s: string) {
        setData('specialities', data.specialities.includes(s) ? data.specialities.filter((x) => x !== s) : [...data.specialities, s]);
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/landlord/contractors', { preserveScroll: true, onSuccess: () => onClose() });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-[18px] font-semibold tracking-tight">Invite a contractor</h2>
                        <p className="text-[12.5px] text-ink-500 mt-1">They'll get an email to set up a login, then see the jobs you send them.</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Business name *</label>
                        <input value={data.business_name} onChange={(e) => setData('business_name', e.target.value)} required className={inputCls} placeholder="PlumbPro Kimberley" />
                        {errors.business_name && <p className="text-[11px] text-danger mt-1">{errors.business_name}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Contact person *</label>
                        <input value={data.contact_name} onChange={(e) => setData('contact_name', e.target.value)} required className={inputCls} />
                        {errors.contact_name && <p className="text-[11px] text-danger mt-1">{errors.contact_name}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Email *</label>
                        <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} required className={inputCls} />
                        {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Phone</label>
                        <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} className={inputCls} placeholder="+27 82 555 1234" />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>What do they do?</label>
                    <div className="flex flex-wrap gap-1.5">
                        {SPECIALITIES.map((s) => {
                            const on = data.specialities.includes(s);
                            return (
                                <button key={s} type="button" onClick={() => toggle(s)} className={`text-[12px] px-3 py-1.5 rounded-full border font-medium transition ${on ? 'bg-brand-700 border-brand-700 text-white' : 'border-ink-200 text-ink-700 hover:bg-ink-50'}`}>
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
                    <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] rounded-full border border-ink-200 font-semibold hover:bg-ink-50">Cancel</button>
                    <button type="submit" disabled={processing} className={btnPrimary}>
                        {processing && <Spinner size={13} />}
                        {processing ? 'Sending…' : 'Send invite'}
                    </button>
                </div>
            </form>
        </div>
    );
}
