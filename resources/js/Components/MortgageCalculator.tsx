import { useMemo, useState } from 'react';

/**
 * Bond / mortgage repayment calculator shown on for-sale listing pages.
 * Pure client-side — no network. Pre-fills the purchase price from the listing.
 *
 * Monthly total (donut centre) = monthly bond repayment + monthly home
 * insurance + monthly HOA/levy. Down payment and loan amount are shown as
 * context rows.
 */

type Props = {
    /** Listing sale price, used as the default "Total Amount". */
    defaultTotal?: number | string | null;
};

function toNum(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function fmt(n: number): string {
    if (!Number.isFinite(n)) return 'R 0.00';
    return (
        'R ' +
        n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
}

const SEGMENT_COLORS = {
    mortgage: '#F26A1B', // brand purple
    insurance: '#F59E0B', // warning amber
    hoa: '#10B981', // success green
};

export default function MortgageCalculator({ defaultTotal }: Props) {
    const initialTotal =
        defaultTotal !== null && defaultTotal !== undefined && defaultTotal !== ''
            ? String(Math.round(Number(defaultTotal)))
            : '750000';

    const [total, setTotal] = useState(initialTotal);
    const [downPct, setDownPct] = useState('10');
    const [rate, setRate] = useState('11.75');
    const [years, setYears] = useState('20');
    const [insurance, setInsurance] = useState('0'); // per year
    const [hoa, setHoa] = useState('0'); // per month

    const calc = useMemo(() => {
        const totalAmount = toNum(total);
        const downPayment = totalAmount * (toNum(downPct) / 100);
        const loanAmount = Math.max(totalAmount - downPayment, 0);

        const monthlyRate = toNum(rate) / 100 / 12;
        const n = Math.max(Math.round(toNum(years) * 12), 1);

        const monthlyMortgage =
            monthlyRate === 0
                ? loanAmount / n
                : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) /
                  (Math.pow(1 + monthlyRate, n) - 1);

        const monthlyInsurance = toNum(insurance) / 12;
        const monthlyHoa = toNum(hoa);
        const monthlyTotal =
            (Number.isFinite(monthlyMortgage) ? monthlyMortgage : 0) +
            monthlyInsurance +
            monthlyHoa;

        return {
            downPayment,
            loanAmount,
            monthlyMortgage: Number.isFinite(monthlyMortgage) ? monthlyMortgage : 0,
            monthlyInsurance,
            monthlyHoa,
            monthlyTotal,
        };
    }, [total, downPct, rate, years, insurance, hoa]);

    // Donut: three monthly components that sum to the centre figure.
    const segments = [
        { key: 'mortgage', value: calc.monthlyMortgage, color: SEGMENT_COLORS.mortgage },
        { key: 'insurance', value: calc.monthlyInsurance, color: SEGMENT_COLORS.insurance },
        { key: 'hoa', value: calc.monthlyHoa, color: SEGMENT_COLORS.hoa },
    ];
    const segSum = segments.reduce((s, x) => s + x.value, 0) || 1;

    const R = 70;
    const C = 2 * Math.PI * R;
    let offset = 0;
    const arcs = segments.map((seg) => {
        const frac = seg.value / segSum;
        const dash = frac * C;
        const arc = { ...seg, dash, gap: C - dash, dashoffset: -offset };
        offset += dash;
        return arc;
    });

    return (
        <div className="mt-10">
            <h2 className="text-[18px] font-bold">Mortgage calculator</h2>
            <p className="mt-1 text-[13px] text-ink-500">
                Estimate your monthly bond repayment. Figures are indicative — confirm with your bank.
            </p>

            <div className="mt-5 bg-white border border-ink-200 rounded-2xl shadow-soft p-6">
                {/* Donut + breakdown */}
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="flex justify-center">
                        <div className="relative">
                            <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
                                <circle
                                    cx="100"
                                    cy="100"
                                    r={R}
                                    fill="none"
                                    stroke="#F1F0FB"
                                    strokeWidth="18"
                                />
                                {arcs.map((a) => (
                                    <circle
                                        key={a.key}
                                        cx="100"
                                        cy="100"
                                        r={R}
                                        fill="none"
                                        stroke={a.color}
                                        strokeWidth="18"
                                        strokeDasharray={`${a.dash} ${a.gap}`}
                                        strokeDashoffset={a.dashoffset}
                                        strokeLinecap="butt"
                                    />
                                ))}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[24px] font-bold tracking-tight">
                                    {fmt(calc.monthlyTotal)}
                                </span>
                                <span className="text-[12px] text-ink-500">Monthly</span>
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-ink-100">
                        <Row label="Down Payment" value={fmt(calc.downPayment)} dot="outline" color="#EF4444" />
                        <Row label="Loan Amount" value={fmt(calc.loanAmount)} dot="outline" color="#18181B" />
                        <Row
                            label="Monthly Mortgage Payment"
                            value={fmt(calc.monthlyMortgage)}
                            dot="fill"
                            color={SEGMENT_COLORS.mortgage}
                        />
                        <Row
                            label="Home Insurance"
                            value={fmt(calc.monthlyInsurance)}
                            dot="fill"
                            color={SEGMENT_COLORS.insurance}
                        />
                        <Row
                            label="Monthly HOA Fees"
                            value={fmt(calc.monthlyHoa)}
                            dot="fill"
                            color={SEGMENT_COLORS.hoa}
                        />
                    </div>
                </div>

                {/* Inputs */}
                <div className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-5">
                    <Field label="Total Amount" prefix="R" value={total} onChange={setTotal} />
                    <Field label="Down Payment" prefix="%" value={downPct} onChange={setDownPct} />
                    <Field label="Interest Rate" prefix="%" value={rate} onChange={setRate} />
                    <Field label="Loan Terms (Years)" prefix="📅" value={years} onChange={setYears} />
                    <Field label="Home Insurance (per year)" prefix="R" value={insurance} onChange={setInsurance} />
                    <Field label="Monthly HOA Fees" prefix="R" value={hoa} onChange={setHoa} />
                </div>
            </div>
        </div>
    );
}

function Row({
    label,
    value,
    dot,
    color,
}: {
    label: string;
    value: string;
    dot: 'fill' | 'outline';
    color: string;
}) {
    return (
        <div className="flex items-center gap-3 py-2.5">
            <span
                className="w-3 h-3 rounded-full shrink-0"
                style={
                    dot === 'fill'
                        ? { backgroundColor: color }
                        : { border: `2px solid ${color}` }
                }
            />
            <span className="text-[14px] font-semibold text-ink-800 flex-1">{label}</span>
            <span className="text-[14px] text-ink-600 tabular-nums">{value}</span>
        </div>
    );
}

function Field({
    label,
    prefix,
    value,
    onChange,
}: {
    label: string;
    prefix: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">{label}</label>
            <div className="flex items-stretch rounded-lg border border-ink-200 overflow-hidden focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand transition">
                <span className="grid place-items-center w-10 bg-ink-50 text-ink-500 text-[13px] border-r border-ink-200 shrink-0">
                    {prefix}
                </span>
                <input
                    type="number"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-[14px] outline-none bg-white min-w-0"
                />
            </div>
        </div>
    );
}
