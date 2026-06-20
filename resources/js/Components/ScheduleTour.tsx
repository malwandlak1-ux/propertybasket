import { FormEvent, useState } from 'react';
import { useForm } from '@inertiajs/react';

/**
 * "Schedule a tour" form on the public listing page. Submits to
 * /tour-requests, which routes the request to the listing agent's
 * dashboard + registered email via the inquiry pipeline.
 */

type Props = { listingId: number };

const TIME_SLOTS = [
    '9:00 am', '10:00 am', '11:00 am', '12:00 pm',
    '1:00 pm', '2:00 pm', '3:00 pm', '4:00 pm', '5:00 pm',
];

export default function ScheduleTour({ listingId }: Props) {
    const [done, setDone] = useState(false);

    const form = useForm({
        listing_id: listingId,
        tour_type: '',
        date: '',
        time: '10:00 am',
        name: '',
        phone: '',
        email: '',
        message: '',
        terms: false,
    });

    const today = new Date().toISOString().split('T')[0];

    function submit(e: FormEvent) {
        e.preventDefault();
        form.post('/tour-requests', {
            preserveScroll: true,
            onSuccess: () => {
                setDone(true);
                form.reset('name', 'phone', 'email', 'message', 'date', 'tour_type');
                form.setData('terms', false);
            },
        });
    }

    return (
        <div className="mt-10">
            <h2 className="text-[18px] font-bold">Schedule a tour</h2>
            <p className="mt-1 text-[13px] text-ink-500">
                Pick a slot and the agent will confirm your viewing.
            </p>

            <div className="mt-5 bg-white border border-ink-200 rounded-2xl shadow-soft p-6">
                {done && (
                    <div className="mb-5 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        Your tour request has been sent — the agent will confirm your slot shortly.
                    </div>
                )}

                <form onSubmit={submit} className="space-y-6">
                    {/* Tour type / date / time */}
                    <div className="grid sm:grid-cols-3 gap-x-6 gap-y-5">
                        <Select
                            label="Tour Type"
                            value={form.data.tour_type}
                            onChange={(v) => form.setData('tour_type', v)}
                            error={form.errors.tour_type}
                        >
                            <option value="">Select</option>
                            <option value="in_person">In-person tour</option>
                            <option value="video_chat">Video chat tour</option>
                        </Select>

                        <div>
                            <Label>Date</Label>
                            <input
                                type="date"
                                min={today}
                                value={form.data.date}
                                onChange={(e) => form.setData('date', e.target.value)}
                                className={inputCls(form.errors.date)}
                            />
                            {form.errors.date && <Err>{form.errors.date}</Err>}
                        </div>

                        <Select
                            label="Time"
                            value={form.data.time}
                            onChange={(v) => form.setData('time', v)}
                            error={form.errors.time}
                        >
                            {TIME_SLOTS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </Select>
                    </div>

                    {/* Your information */}
                    <div>
                        <p className="text-[14px] font-bold text-ink-800 pb-3 border-b border-ink-100">
                            Your information
                        </p>
                        <div className="mt-5 grid sm:grid-cols-3 gap-x-6 gap-y-5">
                            <div>
                                <Label>Name</Label>
                                <input
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="Enter your name"
                                    className={inputCls(form.errors.name)}
                                />
                                {form.errors.name && <Err>{form.errors.name}</Err>}
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <input
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    placeholder="Enter your phone"
                                    className={inputCls(form.errors.phone)}
                                />
                                {form.errors.phone && <Err>{form.errors.phone}</Err>}
                            </div>
                            <div>
                                <Label>Email</Label>
                                <input
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    placeholder="Enter your email"
                                    className={inputCls(form.errors.email)}
                                />
                                {form.errors.email && <Err>{form.errors.email}</Err>}
                            </div>
                        </div>
                    </div>

                    {/* Message */}
                    <div>
                        <Label>Message</Label>
                        <textarea
                            rows={4}
                            value={form.data.message}
                            onChange={(e) => form.setData('message', e.target.value)}
                            placeholder="Enter your message"
                            className={inputCls(form.errors.message)}
                        />
                        {form.errors.message && <Err>{form.errors.message}</Err>}
                    </div>

                    {/* Terms */}
                    <label className="flex items-center gap-2 text-[13px] text-ink-600">
                        <input
                            type="checkbox"
                            checked={form.data.terms}
                            onChange={(e) => form.setData('terms', e.target.checked)}
                            className="w-4 h-4 rounded border-ink-300 text-brand focus:ring-brand/30"
                        />
                        <span>
                            By submitting this form I agree to the{' '}
                            <a href="/terms" className="text-brand-700 hover:underline">Terms of Use</a>
                        </span>
                    </label>
                    {form.errors.terms && <Err>{form.errors.terms}</Err>}

                    <button
                        type="submit"
                        disabled={form.processing}
                        className="px-5 py-2.5 bg-ink-900 hover:bg-brand-500 disabled:opacity-60 text-white rounded-lg text-[14px] font-semibold transition"
                    >
                        {form.processing ? 'Sending…' : 'Submit a tour request'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function inputCls(error?: string): string {
    return (
        'w-full bg-white border rounded-lg px-3.5 py-2.5 text-[14px] outline-none transition ' +
        'focus:ring-2 focus:ring-brand/20 focus:border-brand ' +
        (error ? 'border-danger' : 'border-ink-200')
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">{children}</label>;
}

function Err({ children }: { children: React.ReactNode }) {
    return <p className="text-[11px] text-danger mt-1.5">{children}</p>;
}

function Select({
    label,
    value,
    onChange,
    error,
    children,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <Label>{label}</Label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={inputCls(error) + ' appearance-none bg-white'}
            >
                {children}
            </select>
            {error && <Err>{error}</Err>}
        </div>
    );
}
