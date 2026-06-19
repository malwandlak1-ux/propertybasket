import { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

type Audience = {
    key: string;
    label: string;
    estimated_reach: number;
};

type RecentItem = {
    id: number;
    title: string;
    audience: string;
    audience_label: string;
    sent_at_ago: string;
    reached: number;
    highlighted: boolean;
};

type Props = {
    recent: RecentItem[];
    audiences: Audience[];
};

export default function AdminAnnouncements({ recent, audiences }: Props) {
    const [audience, setAudience] = useState('all');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [inApp, setInApp] = useState(true);
    const [byEmail, setByEmail] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const reach = useMemo(
        () => audiences.find((a) => a.key === audience)?.estimated_reach ?? 0,
        [audience, audiences]
    );

    function publish() {
        setSubmitting(true);
        router.post(
            '/admin/announcements',
            { title, message, audience, in_app: inApp, by_email: byEmail },
            {
                preserveScroll: true,
                onFinish: () => setSubmitting(false),
                onSuccess: () => {
                    setTitle('');
                    setMessage('');
                },
            }
        );
    }

    return (
        <AdminLayout crumb="Announcements" section="System">
            <Head title="Announcements" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Broadcast messages to any group across the platform
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* ── New announcement form ───────────────────────── */}
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                        <div className="bg-gradient-to-r from-brand-50 to-violet-50 border-b border-brand-100 px-5 py-4">
                            <h2 className="text-[14px] font-bold">New Announcement</h2>
                            <p className="text-[11px] text-ink-500 mt-0.5">Appears in-app and (optionally) by email</p>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-[12px] font-semibold mb-1.5">Title</label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Scheduled maintenance this Sunday"
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                            </div>

                            {/* Audience */}
                            <div>
                                <label className="block text-[12px] font-semibold mb-1.5">Audience</label>
                                <div className="flex flex-wrap gap-2">
                                    {audiences.map((a) => (
                                        <button
                                            key={a.key}
                                            type="button"
                                            onClick={() => setAudience(a.key)}
                                            className={
                                                'text-[12px] px-3 py-1.5 rounded-full font-medium transition ' +
                                                (audience === a.key
                                                    ? 'bg-ink-900 text-white'
                                                    : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-100')
                                            }
                                        >
                                            {a.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-[12px] font-semibold mb-1.5">Message</label>
                                <textarea
                                    rows={5}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Write your announcement..."
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
                                />
                            </div>

                            {/* Delivery toggles */}
                            <div className="flex items-center gap-6">
                                <ToggleRow on={inApp} onClick={() => setInApp(!inApp)} label="Show in-app banner" />
                                <ToggleRow on={byEmail} onClick={() => setByEmail(!byEmail)} label="Also send by email" />
                            </div>
                        </div>

                        <div className="px-5 py-4 bg-ink-50/50 border-t border-ink-200 flex items-center justify-between">
                            <p className="text-[12px] text-ink-500">
                                Will reach approximately <strong className="text-ink-900">{reach.toLocaleString('en-ZA')} users</strong>
                            </p>
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1.5 text-[12px] border border-ink-200 rounded-lg bg-white hover:bg-ink-50 transition font-semibold">
                                    Save draft
                                </button>
                                <button
                                    onClick={publish}
                                    disabled={!title.trim() || !message.trim() || submitting}
                                    className="px-3.5 py-1.5 text-[12px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 font-semibold"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                                    </svg>
                                    Publish
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Recent panel ────────────────────────────────── */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft self-start">
                        <h2 className="text-[14px] font-bold mb-4">Recent</h2>
                        <div className="space-y-3">
                            {recent.map((r) => (
                                <div
                                    key={r.id}
                                    className={
                                        'border-l-2 pl-3 ' +
                                        (r.highlighted ? 'border-brand-500' : 'border-ink-200')
                                    }
                                >
                                    <p className="text-[13px] font-semibold leading-tight">{r.title}</p>
                                    <p className="text-[11px] text-ink-500 mt-1">
                                        {r.audience_label} · {r.sent_at_ago}
                                        {r.reached > 0 && ` · ${r.reached.toLocaleString('en-ZA')} reached`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function ToggleRow({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
    return (
        <button type="button" onClick={onClick} className="flex items-center gap-2.5 group">
            <span
                className={
                    'relative rounded-full transition-colors ' +
                    (on ? 'bg-brand-500' : 'bg-ink-300')
                }
                style={{ width: 40, height: 22 }}
            >
                <span
                    className="absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
                    style={{ transform: on ? 'translateX(18px)' : 'translateX(0)' }}
                />
            </span>
            <span className="text-[12px] text-ink-700 group-hover:text-ink-900">{label}</span>
        </button>
    );
}
