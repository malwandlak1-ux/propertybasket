import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';
import InviteContractorModal from '@/Components/InviteContractorModal';

type Contractor = {
    id: number;
    business_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    specialities: string[];
    average_rating: number;
    total_reviews: number;
    active_jobs: number;
    done_jobs: number;
    has_banking: boolean;
    account_state: 'active' | 'invited';
};

type Props = {
    landlord: { id: number; name: string };
    contractors: Contractor[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

export default function LandlordContractors({ contractors }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [inviting, setInviting] = useState(false);
    const [removing, setRemoving] = useState<number | null>(null);

    const active = contractors.filter((c) => c.account_state === 'active').length;
    const busy = contractors.reduce((s, c) => s + c.active_jobs, 0);

    function remove(c: Contractor) {
        if (! confirm(`Remove ${c.business_name ?? c.contact_name} from your contractor list? Their account is not deleted.`)) return;
        setRemoving(c.id);
        router.delete(`/landlord/contractors/${c.id}`, { preserveScroll: true, onFinish: () => setRemoving(null) });
    }

    return (
        <LandlordLayout crumb="Contractors" section="People">
            <Head title="Contractors" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Contractors"
                    subtitle="The people you call for repairs. Invite them once, then request quotes from the Maintenance board."
                    actions={
                        <button type="button" onClick={() => setInviting(true)} className={btnPrimary}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                            Invite contractor
                        </button>
                    }
                />

                {flash?.success && <div className="mb-4 rounded-2xl bg-success/10 border border-success/30 text-success px-5 py-3 text-[13px] font-medium">{flash.success}</div>}
                {flash?.error && <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px] font-medium">{flash.error}</div>}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                        <p className="text-[13px] font-medium">On your list</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{contractors.length}</p>
                        <p className="text-[12px] text-white/80 mt-2">{active} with an active account</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Jobs in progress</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{busy}</p>
                        <p className="text-[12px] text-ink-500 mt-2">Across your properties</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">How it works</p>
                        <ol className="text-[12px] text-ink-600 mt-2 space-y-1 list-decimal list-inside">
                            <li>Request a quote on a tenant's request</li>
                            <li>Accept the quote you're happy with</li>
                            <li>Pay the invoice once the work is done</li>
                        </ol>
                    </div>
                </div>

                {contractors.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-ink-200 p-10 text-center">
                        <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 inline-flex items-center justify-center mb-3"><Icon name="wrench" className="w-6 h-6" /></span>
                        <p className="text-[14px] font-semibold">No contractors yet</p>
                        <p className="text-[12.5px] text-ink-500 mt-1 max-w-sm mx-auto">Invite your plumber, electrician or handyman. They get their own login to receive jobs, send quotes and invoice you.</p>
                        <button type="button" onClick={() => setInviting(true)} className={`${btnPrimary} mt-4`}>Invite contractor</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {contractors.map((c) => {
                            const name = c.business_name ?? c.contact_name ?? 'Contractor';
                            return (
                                <div key={c.id} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise flex flex-col">
                                    <div className="flex items-start gap-3">
                                        <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name="wrench" className="w-5 h-5" /></span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[15px] font-semibold tracking-tight truncate">{name}</p>
                                            <p className="text-[12px] text-ink-500 truncate">{c.contact_name}</p>
                                        </div>
                                        <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${c.account_state === 'active' ? 'bg-success/15 text-success' : 'bg-warning/15 text-amber-700'}`}>
                                            {c.account_state === 'active' ? 'Active' : 'Invite sent'}
                                        </span>
                                    </div>

                                    <div className="mt-3 space-y-1 text-[12px] text-ink-600">
                                        {c.email && <p className="flex items-center gap-1.5 truncate"><Icon name="mail" />{c.email}</p>}
                                        {c.phone && <p className="flex items-center gap-1.5"><Icon name="phone" />{c.phone}</p>}
                                    </div>

                                    {c.specialities.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {c.specialities.map((s) => <span key={s} className="text-[10.5px] bg-ink-100 text-ink-700 px-2 py-0.5 rounded-full font-medium">{s}</span>)}
                                        </div>
                                    )}

                                    <div className="mt-auto pt-3 mt-4 border-t border-ink-100 flex items-center justify-between text-[12px]">
                                        <span className="text-ink-600">
                                            <span className="font-semibold text-ink-900">{c.active_jobs}</span> open · <span className="font-semibold text-ink-900">{c.done_jobs}</span> done
                                            {c.total_reviews > 0 && <> · <span className="text-warning">★</span> {c.average_rating.toFixed(1)}</>}
                                        </span>
                                        <button type="button" onClick={() => remove(c)} disabled={removing === c.id} className="text-ink-400 hover:text-danger font-semibold disabled:opacity-40">
                                            {removing === c.id ? 'Removing…' : 'Remove'}
                                        </button>
                                    </div>
                                    {! c.has_banking && c.account_state === 'active' && (
                                        <p className="text-[11px] text-amber-700 mt-2">No banking details yet. Ask them to add a payout account so you can pay invoices.</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {inviting && <InviteContractorModal onClose={() => setInviting(false)} />}
        </LandlordLayout>
    );
}
