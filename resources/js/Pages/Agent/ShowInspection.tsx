import { Head, Link } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';

type Room = { name: string; condition: string; notes: string | null; photos?: string[] };

type Props = {
    agent: { id: number; name: string; agency_name: string };
    inspection: {
        id: number;
        type: 'move_in' | 'move_out';
        status: string;
        rooms: Room[];
        agent_signed_at: string | null;
        agent_signature: string | null;
        tenant_signed_at: string | null;
        tenant_signature: string | null;
        created_at: string | null;
        pdf_url: string;
    };
    lease: {
        id: number | null;
        tenant_name: string | null;
        tenant_email: string | null;
        start_date: string | null;
        end_date: string | null;
    };
    listing: {
        id: number | null;
        title: string | null;
        address: string;
        primary_image: string | null;
    };
};

const CONDITION_COLOR: Record<string, string> = {
    excellent: 'bg-success/10 text-success',
    good:      'bg-sky-50 text-sky-700',
    fair:      'bg-warning/10 text-warning',
    poor:      'bg-danger/10 text-danger',
};

export default function AgentShowInspection({ agent, inspection, lease, listing }: Props) {
    const isMoveIn = inspection.type === 'move_in';

    return (
        <AgentLayout crumb={isMoveIn ? 'Move-In Inspection' : 'Move-Out Inspection'} agencyName={agent.agency_name}>
            <Head title={`${isMoveIn ? 'Move-in' : 'Move-out'} inspection · ${listing.title ?? ''}`} />

            <div className="px-4 sm:px-8 py-6 sm:py-7 max-w-4xl">
                <div className="mb-6">
                    <Link href="/agent/inspections" className="text-[12px] text-ink-500 hover:text-ink-900">← Back to inspections</Link>
                    <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                {isMoveIn ? 'Move-In' : 'Move-Out'} Inspection
                            </h1>
                            <p className="text-[14px] text-ink-500 mt-1">
                                Conducted {inspection.created_at} · Read-only
                            </p>
                        </div>
                        <a
                            href={`${inspection.pdf_url}?download=1`}
                            target="_blank"
                            rel="noopener"
                            className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition inline-flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Download PDF
                        </a>
                    </div>
                </div>

                {/* Property + lease */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden mb-5">
                    <div className="flex">
                        <div className="w-48 shrink-0 aspect-[4/3] bg-ink-100 relative">
                            {listing.primary_image ? (
                                <img src={listing.primary_image} alt={listing.title ?? ''} className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-ink-400">
                                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                        <path d="M3 21V10l9-7 9 7v11H3z M9 21v-7h6v7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 p-5">
                            <h2 className="text-lg font-bold">{listing.title ?? '—'}</h2>
                            <p className="text-[13px] text-ink-500">{listing.address || '—'}</p>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Tenant</p>
                                    <p className="font-semibold mt-0.5">{lease.tenant_name ?? '—'}</p>
                                    <p className="text-ink-500 text-[12px]">{lease.tenant_email ?? ''}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Lease period</p>
                                    <p className="font-semibold mt-0.5">{lease.start_date} → {lease.end_date}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Rooms */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 mb-5">
                    <h3 className="text-base font-bold mb-3">Room condition</h3>
                    <div className="space-y-2">
                        {inspection.rooms.length === 0 && (
                            <p className="text-[13px] text-ink-500">No rooms recorded.</p>
                        )}
                        {inspection.rooms.map((room, i) => (
                            <div key={i} className="bg-ink-50/40 rounded-lg p-3 border border-ink-100">
                                <div className="grid grid-cols-12 gap-3 items-start">
                                    <div className="col-span-3">
                                        <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Room</p>
                                        <p className="text-[13px] font-semibold mt-0.5">{room.name}</p>
                                    </div>
                                    <div className="col-span-3">
                                        <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Condition</p>
                                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded-md font-bold mt-0.5 capitalize ${CONDITION_COLOR[room.condition] ?? 'bg-ink-100 text-ink-700'}`}>
                                            {room.condition}
                                        </span>
                                    </div>
                                    <div className="col-span-6">
                                        <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Notes</p>
                                        <p className="text-[13px] mt-0.5 text-ink-700">{room.notes || <span className="text-ink-400 italic">No notes</span>}</p>
                                    </div>
                                </div>
                                {(room.photos?.length ?? 0) > 0 && (
                                    <div className="mt-3 pt-3 border-t border-ink-100">
                                        <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5">
                                            Photos ({room.photos!.length})
                                        </p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {room.photos!.map((src, p) => (
                                                <a
                                                    key={p}
                                                    href={src}
                                                    target="_blank"
                                                    rel="noopener"
                                                    className="block w-20 h-20 rounded-lg overflow-hidden border border-ink-200 bg-white hover:ring-2 hover:ring-brand/40 transition"
                                                >
                                                    <img src={src} alt={`${room.name} photo ${p + 1}`} className="w-full h-full object-cover" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Signatures */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                    <h3 className="text-base font-bold mb-3">Sign-off</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-ink-50/40 rounded-lg p-4 border border-ink-100">
                            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Agent</p>
                            <p className="text-[14px] font-semibold mt-1">{inspection.agent_signature ?? '—'}</p>
                            <p className="text-[11px] text-ink-500 mt-0.5">{inspection.agent_signed_at ? `Signed ${inspection.agent_signed_at}` : 'Not signed'}</p>
                        </div>
                        <div className="bg-ink-50/40 rounded-lg p-4 border border-ink-100">
                            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Tenant</p>
                            <p className="text-[14px] font-semibold mt-1">{inspection.tenant_signature ?? '—'}</p>
                            <p className="text-[11px] text-ink-500 mt-0.5">{inspection.tenant_signed_at ? `Signed ${inspection.tenant_signed_at}` : 'Awaiting signature'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </AgentLayout>
    );
}
