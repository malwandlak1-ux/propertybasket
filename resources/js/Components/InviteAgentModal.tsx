/**
 * InviteAgentModal — used on Agency Overview + Agency Agents pages.
 *
 * Submits to POST /agency/agents/invite. On success: invitation email is sent
 * via UserInvited notification, success flash banner shows on the next render.
 */
import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

type Props = {
    onClose: () => void;
};

export default function InviteAgentModal({ onClose }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        commission_split_percent: 70,
        area_speciality: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agency/agents/invite', {
            onSuccess: () => {
                reset();
                onClose();
            },
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
                className="bg-white rounded-xl shadow-lift max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold">Invite an agent</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            They&apos;ll get an email with a 14-day token to set up their account.
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

                <form onSubmit={submit} className="mt-5 space-y-4">
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                            Email
                        </label>
                        <input
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                            placeholder="agent@example.com"
                            required
                            autoFocus
                        />
                        {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                                Commission split %
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={data.commission_split_percent}
                                    onChange={(e) => setData('commission_split_percent', Number(e.target.value))}
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg pl-3.5 pr-7 py-2.5 text-[14px] font-mono outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-500">%</span>
                            </div>
                            {errors.commission_split_percent && (
                                <p className="text-[11px] text-danger mt-1">{errors.commission_split_percent}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                                Areas (optional)
                            </label>
                            <input
                                value={data.area_speciality}
                                onChange={(e) => setData('area_speciality', e.target.value)}
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                placeholder="Sandton, Rosebank"
                            />
                            {errors.area_speciality && (
                                <p className="text-[11px] text-danger mt-1">{errors.area_speciality}</p>
                            )}
                        </div>
                    </div>

                    <div className="text-[11px] text-ink-500 bg-ink-50 border border-ink-100 rounded-lg p-2.5">
                        💡 The agent receives a signup link valid for 14 days. They'll need to upload
                        their FFC certificate before any commission can be paid out.
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
                            disabled={processing || ! data.email}
                            className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed transition inline-flex items-center gap-2 font-semibold"
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Sending…' : 'Send invitation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
