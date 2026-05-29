import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import DebitOrderModal from '@/Components/DebitOrderModal';

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function greet(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function today(): string {
    return new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

type Tenant = { id: number; name: string; initials: string };
type Lease = {
    id: number;
    address: string;
    suburb?: string;
    city?: string;
    monthly_rent: number;
    start_date: string;
    end_date: string;
    status: string;
    progress_pct: number;
    months_elapsed: number;
    months_remaining: number;
};
type NextDue = { amount: number; due_date: string; days_remaining: number; period_month: string };
type DepositInfo = { amount_deposited: number; accrued_interest: number; interest_rate: number; total_held: number };
type OpenMaint = {
    id: number;
    title: string;
    category: string;
    urgency: string;
    status: string;
    logged_at: string;
    logged_human: string;
    photo_count: number;
    contractor: { name: string; initials: string } | null;
    preferred_date: string | null;
    preferred_slot: string | null;
} | null;
type RecentPayment = { id: number; label: string; paid_at: string; method: string | null; reference: string | null; amount: number };
type Agent = { id: number; name: string; initials: string; email: string; phone: string; agency: string } | null;
type DebitOrder = {
    id: number;
    bank_name: string;
    account_holder: string;
    account_number_masked: string;
    branch_code: string;
    account_type: 'cheque' | 'current' | 'savings';
    debit_day: number;
    signed_at: string | null;
} | null;

type Props = {
    tenant: Tenant;
    lease: Lease;
    next_due: NextDue;
    streak: number;
    deposit: DepositInfo;
    open_maintenance: OpenMaint;
    recent_payments: RecentPayment[];
    agent: Agent;
    debit_order: DebitOrder;
};

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

export default function TenantOverview({ tenant, lease, next_due, streak, deposit, open_maintenance, recent_payments, agent, debit_order }: Props) {
    const [debitOpen, setDebitOpen] = useState(false);
    const dueTone = next_due.days_remaining < 0
        ? 'text-danger'
        : next_due.days_remaining <= 7 ? 'text-warning' : 'text-success';
    const dueLabel = next_due.days_remaining < 0
        ? `${Math.abs(next_due.days_remaining)} days overdue`
        : next_due.days_remaining === 0 ? 'Due today' : `${next_due.days_remaining} days remaining`;
    const depositPct = deposit.amount_deposited > 0 ? Math.min(100, (deposit.accrued_interest / deposit.amount_deposited) * 100) : 0;

    return (
        <TenantLayout crumb="Dashboard" leaseAddress={lease.address}>
            <Head title="Tenant Dashboard" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-7">
                    <div>
                        <p className="text-[13px] text-ink-500">{today()}</p>
                        <h1 className="text-3xl font-bold tracking-tight mt-1">
                            {greet()}, {tenant.name.split(' ')[0]} 👋
                        </h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Welcome home. Your next rent is due in{' '}
                            <span className={`font-semibold ${dueTone}`}>
                                {next_due.days_remaining < 0 ? `${Math.abs(next_due.days_remaining)} days overdue` : `${next_due.days_remaining} days`}
                            </span>.
                        </p>
                    </div>
                    <Link href="/tenant/payments" className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                        Pay Rent
                    </Link>
                </div>

                {/* Hero row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="col-span-2 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl p-6 text-white shadow-card relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
                        <div className="absolute bottom-0 right-12 w-32 h-32 bg-white/5 rounded-full translate-y-16" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">Next Rent Due</p>
                                <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold">REMINDER ACTIVE</span>
                            </div>
                            <p className="text-5xl font-bold mb-2">{fmtMoney(next_due.amount)}</p>
                            <div className="flex items-center gap-3 mb-5">
                                <span className="text-[13px] opacity-90">Due {next_due.due_date}</span>
                                <span className="w-1 h-1 rounded-full bg-white/50" />
                                <span className="text-[13px] opacity-90">{dueLabel}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Link href="/tenant/payments" className="px-4 py-2 bg-white text-brand-700 text-[13px] rounded-lg font-semibold hover:bg-white/90 flex items-center gap-2">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="5" width="20" height="14" rx="2"/></svg>
                                    Pay with Paystack
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setDebitOpen(true)}
                                    className="px-4 py-2 bg-white/10 border border-white/30 text-white text-[13px] rounded-lg font-semibold hover:bg-white/20 backdrop-blur inline-flex items-center gap-2"
                                >
                                    {debit_order ? 'Manage debit order' : 'Set up debit order'}
                                    {debit_order && (
                                        <span className="text-[10px] bg-success/30 px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>
                                    )}
                                </button>
                            </div>
                            <div className="mt-5 pt-5 border-t border-white/20 flex items-center gap-6 text-[12px] opacity-90">
                                <span className="flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
                                    {streak} consecutive on-time payment{streak === 1 ? '' : 's'}
                                </span>
                                {streak >= 3 && (
                                    <span className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                                        Tenant rating: <span className="font-bold">Excellent</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">Deposit Held</p>
                                <Link href="/tenant/documents" className="text-[11px] text-brand-600 font-medium">View →</Link>
                            </div>
                            <p className="text-2xl font-bold">{fmtMoney(deposit.amount_deposited)}</p>
                            <p className="text-[11px] text-success mt-1">+ {fmtMoney(deposit.accrued_interest)} interest earned</p>
                            <div className="mt-3 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                                <div className="h-full bg-success" style={{ width: `${depositPct}%` }} />
                            </div>
                            <p className="text-[10px] text-ink-500 mt-1.5">{deposit.interest_rate}% p.a. · Section 32 Trust</p>
                        </div>

                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">Lease Term</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold uppercase">{lease.status}</span>
                            </div>
                            <p className="text-[13px] font-semibold">{lease.start_date} — {lease.end_date}</p>
                            <div className="mt-3 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500" style={{ width: `${lease.progress_pct}%` }} />
                            </div>
                            <p className="text-[10px] text-ink-500 mt-1.5">
                                {lease.months_elapsed} month{lease.months_elapsed === 1 ? '' : 's'} elapsed · {lease.months_remaining} remaining
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-4">
                        {/* Maintenance */}
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-base font-semibold">Open Maintenance Request</h2>
                                    <p className="text-xs text-ink-500 mt-0.5">
                                        {open_maintenance ? 'Real-time status' : 'No open requests'}
                                    </p>
                                </div>
                                <Link href="/tenant/maintenance" className="text-[12px] font-medium text-brand-600 hover:underline">All requests →</Link>
                            </div>

                            {open_maintenance ? (
                                <div className="border border-ink-200 rounded-lg overflow-hidden">
                                    <div className="p-4 bg-ink-50/40 flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12h18M3 6h18M3 18h12"/></svg>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-[14px] font-semibold">{open_maintenance.title}</p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${urgencyTone(open_maintenance.urgency)}`}>
                                                    {open_maintenance.urgency}
                                                </span>
                                            </div>
                                            <p className="text-[12px] text-ink-500 mt-0.5">
                                                {open_maintenance.category} · Logged {open_maintenance.logged_at} · {open_maintenance.photo_count} photo{open_maintenance.photo_count === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusTone(open_maintenance.status)}`}>
                                            {open_maintenance.status.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        <div className="flex items-start">
                                            <div className="flex flex-col items-center mr-3">
                                                <div className="w-7 h-7 rounded-full bg-success flex items-center justify-center text-white">
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
                                                </div>
                                                <div className="w-0.5 h-12 bg-success" />
                                            </div>
                                            <div className="flex-1 pb-3">
                                                <p className="text-[13px] font-semibold">Submitted</p>
                                                <p className="text-[11px] text-ink-500">{open_maintenance.logged_at} · {open_maintenance.logged_human}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start">
                                            <div className="flex flex-col items-center mr-3">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${open_maintenance.contractor ? 'bg-success' : 'bg-ink-100 text-ink-400'}`}>
                                                    {open_maintenance.contractor ? (
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
                                                    ) : (
                                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="4"/></svg>
                                                    )}
                                                </div>
                                                <div className={`w-0.5 h-12 ${open_maintenance.contractor ? 'bg-success' : 'bg-ink-200'}`} />
                                            </div>
                                            <div className="flex-1 pb-3">
                                                <p className={`text-[13px] font-semibold ${open_maintenance.contractor ? '' : 'text-ink-400'}`}>Contractor assigned</p>
                                                {open_maintenance.contractor && (
                                                    <div className="flex items-center gap-2 mt-2 bg-ink-50 rounded-md p-2 w-fit">
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[9px] font-bold">
                                                            {open_maintenance.contractor.initials}
                                                        </div>
                                                        <span className="text-[11px] font-semibold">{open_maintenance.contractor.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-start">
                                            <div className="flex flex-col items-center mr-3">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${open_maintenance.status === 'in_progress' ? 'bg-brand-500 text-white pulse-dot' : 'bg-ink-100 text-ink-400'}`}>
                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 12h14M12 5v14"/></svg>
                                                </div>
                                                <div className="w-0.5 h-12 bg-ink-200" />
                                            </div>
                                            <div className="flex-1 pb-3">
                                                <p className={`text-[13px] font-semibold ${open_maintenance.status === 'in_progress' ? '' : 'text-ink-400'}`}>In progress</p>
                                                {open_maintenance.preferred_date && (
                                                    <p className="text-[11px] text-ink-500">Visit: {open_maintenance.preferred_date} · {open_maintenance.preferred_slot}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-start">
                                            <div className="flex flex-col items-center mr-3">
                                                <div className="w-7 h-7 rounded-full bg-ink-100 flex items-center justify-center text-ink-400">
                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="4"/></svg>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[13px] font-semibold text-ink-400">Completed</p>
                                                <p className="text-[11px] text-ink-400">Awaiting completion · You'll be notified</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-dashed border-ink-200 rounded-lg p-8 text-center">
                                    <p className="text-[13px] text-ink-500 mb-3">No active maintenance requests.</p>
                                    <Link href="/tenant/maintenance" className="text-[12px] font-semibold text-brand-600">Log a new issue →</Link>
                                </div>
                            )}
                        </div>

                        {/* Recent payments */}
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-semibold">Recent Payments</h2>
                                <Link href="/tenant/payments" className="text-[12px] font-medium text-brand-600 hover:underline">Full history →</Link>
                            </div>
                            {recent_payments.length === 0 ? (
                                <p className="py-6 text-center text-[13px] text-ink-400">No payments yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {recent_payments.map((p) => (
                                        <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-ink-50">
                                            <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center">
                                                <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[13px] font-semibold">{p.label}</p>
                                                <p className="text-[11px] text-ink-500">
                                                    Paid {p.paid_at}{p.reference ? ` · ${p.method ?? 'Paystack'} ref: ${p.reference}` : ''}
                                                </p>
                                            </div>
                                            <span className="text-[13px] font-mono font-semibold text-success">{fmtMoney(p.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
                            <div className="space-y-2">
                                <Link href="/tenant/maintenance" className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-ink-50 border border-ink-200">
                                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z"/></svg>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-[12px] font-semibold">Report an issue</p>
                                        <p className="text-[10px] text-ink-500">Log maintenance request</p>
                                    </div>
                                    <svg className="w-3.5 h-3.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
                                </Link>
                                <Link href="/tenant/lease" className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-ink-50 border border-ink-200">
                                    <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-[12px] font-semibold">View lease</p>
                                        <p className="text-[10px] text-ink-500">Agreement · Key dates</p>
                                    </div>
                                    <svg className="w-3.5 h-3.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
                                </Link>
                                <Link href="/tenant/documents" className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-ink-50 border border-ink-200">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4"/><path d="M21 12c0 1-1 11-9 11s-9-10-9-11V5l9-3 9 3z"/></svg>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-[12px] font-semibold">Documents</p>
                                        <p className="text-[10px] text-ink-500">Inspections · Receipts</p>
                                    </div>
                                    <svg className="w-3.5 h-3.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
                                </Link>
                            </div>
                        </div>

                        {agent && (
                            <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                                <h2 className="text-base font-semibold mb-3">Your Agent</h2>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">{agent.initials}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-semibold">{agent.name}</p>
                                        <p className="text-[11px] text-ink-500">{agent.agency} · FFC valid</p>
                                    </div>
                                </div>
                                <div className="space-y-1.5 text-[12px] text-ink-700 mb-3">
                                    {agent.phone && (
                                        <div className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                            <span className="font-mono">{agent.phone}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
                                        <span className="truncate">{agent.email}</span>
                                    </div>
                                </div>
                                <Link href="/tenant/messages" className="w-full block text-center py-2 text-[12px] bg-ink-900 text-white rounded-md font-medium">Send message</Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {debitOpen && (
                <DebitOrderModal
                    existing={debit_order}
                    tenantName={tenant.name}
                    onClose={() => setDebitOpen(false)}
                />
            )}
        </TenantLayout>
    );
}
