import { FormEvent, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import { Spinner } from '@/Components/Skeleton';

type Lease = {
    id: number;
    label: string;
    tenant_id: number;
    tenant_name: string | null;
    listing_title: string | null;
    start_date: string | null;
    end_date: string | null;
};

type Props = {
    agent: { id: number; name: string; agency_name: string };
    type: 'move_in' | 'move_out';
    leases: Lease[];
};

type Room = {
    name: string;
    condition: 'excellent' | 'good' | 'fair' | 'poor';
    notes: string;
};

const DEFAULT_ROOMS: Room[] = [
    { name: 'Entrance', condition: 'good', notes: '' },
    { name: 'Living Room', condition: 'good', notes: '' },
    { name: 'Kitchen', condition: 'good', notes: '' },
    { name: 'Master Bedroom', condition: 'good', notes: '' },
    { name: 'Bathroom', condition: 'good', notes: '' },
];

const CONDITION_OPTIONS: Room['condition'][] = ['excellent', 'good', 'fair', 'poor'];

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

export default function AgentCreateInspection({ agent, type: initialType, leases }: Props) {
    const [type, setType]         = useState<'move_in' | 'move_out'>(initialType);
    const [leaseId, setLeaseId]   = useState('');
    const [rooms, setRooms]       = useState<Room[]>(DEFAULT_ROOMS);
    const [generalNotes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors]     = useState<Record<string, string>>({});

    function updateRoom(i: number, patch: Partial<Room>) {
        setRooms((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    }
    function addRoom() {
        setRooms((rs) => [...rs, { name: '', condition: 'good', notes: '' }]);
    }
    function removeRoom(i: number) {
        setRooms((rs) => rs.filter((_, idx) => idx !== i));
    }

    function changeType(nextType: 'move_in' | 'move_out') {
        // Type changes the lease list, so reload with ?type=…
        router.get('/agent/inspections/create', { type: nextType }, { preserveScroll: true });
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        if (! leaseId) return;
        setProcessing(true);
        router.post('/agent/inspections', {
            lease_id:      leaseId,
            type,
            rooms,
            general_notes: generalNotes,
        }, {
            onError:    (errs) => setErrors(errs as Record<string, string>),
            onFinish:   () => setProcessing(false),
        });
    }

    const selectedLease = leases.find((l) => String(l.id) === leaseId);
    const canSubmit = !! leaseId && rooms.length > 0 && rooms.every((r) => r.name.trim() !== '');

    return (
        <AgentLayout crumb="New Inspection" agencyName={agent.agency_name}>
            <Head title="New Inspection" />

            <div className="px-8 py-7 max-w-3xl">
                <div className="mb-6">
                    <Link href="/agent/inspections" className="text-[12px] text-ink-500 hover:text-ink-900">← Back to inspections</Link>
                    <h1 className="text-2xl font-bold tracking-tight mt-2">New Inspection</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Inspections are final once saved — you'll only be able to view them afterwards.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    {/* Type toggle */}
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                        <label className="text-[12px] font-semibold text-ink-700 mb-2 block">Inspection type</label>
                        <div className="grid grid-cols-2 gap-3">
                            {(['move_in', 'move_out'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => changeType(t)}
                                    className={`p-4 rounded-lg border-2 text-left transition ${
                                        type === t ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white hover:border-ink-300'
                                    }`}
                                >
                                    <p className="text-[13px] font-bold">{t === 'move_in' ? 'Move-In' : 'Move-Out'}</p>
                                    <p className="text-[11px] text-ink-500 mt-0.5">
                                        {t === 'move_in'
                                            ? 'Document the condition before the tenant takes occupation.'
                                            : 'Document the condition at the end of the lease for deposit return.'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lease select */}
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 space-y-4">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Lease *</label>
                            <select
                                value={leaseId}
                                onChange={(e) => setLeaseId(e.target.value)}
                                required
                                className={inputCls}
                            >
                                <option value="">Select a lease…</option>
                                {leases.map((l) => (
                                    <option key={l.id} value={l.id}>{l.label}</option>
                                ))}
                            </select>
                            {leases.length === 0 && (
                                <p className="text-[11px] text-ink-500 mt-1">
                                    No leases available for a {type === 'move_in' ? 'move-in' : 'move-out'} inspection.
                                </p>
                            )}
                            {errors.lease_id && <p className="text-[11px] text-danger mt-1">{errors.lease_id}</p>}
                        </div>

                        {selectedLease && (
                            <div className="bg-ink-50 rounded-lg p-3 text-[12px] text-ink-600">
                                <p><strong>{selectedLease.listing_title}</strong></p>
                                <p>Tenant: {selectedLease.tenant_name}</p>
                                <p>Lease: {selectedLease.start_date} → {selectedLease.end_date}</p>
                            </div>
                        )}
                    </div>

                    {/* Rooms */}
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-[12px] font-semibold text-ink-700">Rooms ({rooms.length})</label>
                            <button type="button" onClick={addRoom} className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold">
                                + Add room
                            </button>
                        </div>
                        <div className="space-y-3">
                            {rooms.map((room, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-ink-50/40 rounded-lg p-3 border border-ink-100">
                                    <div className="col-span-4">
                                        <label className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">Room</label>
                                        <input
                                            value={room.name}
                                            onChange={(e) => updateRoom(i, { name: e.target.value })}
                                            placeholder="e.g. Kitchen"
                                            required
                                            className={inputCls}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <label className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">Condition</label>
                                        <select
                                            value={room.condition}
                                            onChange={(e) => updateRoom(i, { condition: e.target.value as Room['condition'] })}
                                            className={inputCls}
                                        >
                                            {CONDITION_OPTIONS.map((c) => (
                                                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-4">
                                        <label className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">Notes</label>
                                        <input
                                            value={room.notes}
                                            onChange={(e) => updateRoom(i, { notes: e.target.value })}
                                            placeholder="Visible damage, marks, etc."
                                            className={inputCls}
                                        />
                                    </div>
                                    <div className="col-span-1 pt-5 flex justify-end">
                                        {rooms.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRoom(i)}
                                                className="text-ink-400 hover:text-danger p-1"
                                                aria-label="Remove room"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* General notes */}
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">General notes</label>
                        <textarea
                            value={generalNotes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Overall observations about the property condition…"
                            className={inputCls + ' resize-none'}
                        />
                    </div>

                    {/* Submit */}
                    <div className="flex items-center justify-between bg-white rounded-xl border border-ink-200 p-5 shadow-soft sticky bottom-4">
                        <p className="text-[12px] text-ink-500">
                            ⚠ Inspections become read-only once saved.
                        </p>
                        <div className="flex gap-2">
                            <Link href="/agent/inspections" className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={processing || ! canSubmit}
                                className="px-5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                            >
                                {processing && <Spinner size={13} />}
                                {processing ? 'Saving…' : 'Save inspection'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </AgentLayout>
    );
}
