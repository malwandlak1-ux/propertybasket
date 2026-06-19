import { Head, Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';

type Defaults = {
    interest_rate: number;
    loan_term: number;
    affordability_ratio: number;
};

type Props = { defaults: Defaults };

const TERM_OPTIONS = [5, 10, 15, 20, 25, 30];

/**
 * PMT formula — fixed monthly payment for an amortising loan.
 *
 *   M = P · r(1+r)ⁿ / ((1+r)ⁿ − 1)
 *
 * Where:
 *   P  = principal (loan amount)
 *   r  = monthly interest rate (annual % / 12 / 100)
 *   n  = total payments (years × 12)
 */
function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
    if (principal <= 0 || years <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    const n = years * 12;
    if (r === 0) return principal / n;
    const pow = Math.pow(1 + r, n);
    return (principal * r * pow) / (pow - 1);
}

/**
 * Inverse of PMT — max principal an instalment can service.
 *   P = M · ((1+r)ⁿ − 1) / (r · (1+r)ⁿ)
 */
function maxPrincipal(monthlyInstalment: number, annualRatePct: number, years: number): number {
    if (monthlyInstalment <= 0 || years <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    const n = years * 12;
    if (r === 0) return monthlyInstalment * n;
    const pow = Math.pow(1 + r, n);
    return (monthlyInstalment * (pow - 1)) / (r * pow);
}

function fmtZar(n: number): string {
    if (!Number.isFinite(n) || n < 0) return 'R 0';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

export default function Calculator({ defaults }: Props) {
    return (
        <PublicLayout>
            <Head title="Bond & Affordability Calculator" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <header className="mb-10 sm:mb-12 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Bond & Affordability Calculators</h1>
                    <p className="text-[14px] sm:text-[15px] text-ink-600 mt-3 max-w-2xl mx-auto">
                        Get an instant estimate of your monthly bond repayments and how much you can afford to borrow. Estimates only — your bank will confirm the actual figures.
                    </p>
                </header>

                <div className="space-y-10">
                    <BondCalculator defaults={defaults} />
                    <AffordabilityCalculator defaults={defaults} />
                </div>

                <div className="mt-10 px-4 py-3 rounded-lg bg-ink-100 text-[12.5px] text-ink-600 text-center max-w-3xl mx-auto">
                    These calculators use the standard amortising-loan formula and South African lender guidelines (≈30% gross income cap). Real-world rates depend on credit profile, deposit size and bank policy.
                </div>
            </div>
        </PublicLayout>
    );
}

/* ─────────────────────────── Bond Calculator ─────────────────────────── */

function BondCalculator({ defaults }: { defaults: Defaults }) {
    const [purchasePrice, setPurchasePrice] = useState<number>(1_200_000);
    const [deposit, setDeposit] = useState<number>(0);
    const [interestRate, setInterestRate] = useState<number>(defaults.interest_rate);
    const [years, setYears] = useState<number>(defaults.loan_term);

    const principal = Math.max(0, purchasePrice - deposit);
    const monthly = useMemo(() => monthlyPayment(principal, interestRate, years), [principal, interestRate, years]);
    const totalRepayment = monthly * years * 12;
    const totalInterest = Math.max(0, totalRepayment - principal);

    return (
        <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Bond calculator</h2>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 bg-white rounded-2xl border border-ink-200 shadow-soft overflow-hidden">
                {/* Inputs */}
                <div className="p-5 sm:p-6 space-y-5">
                    <ZarInput
                        label="Purchase Price"
                        value={purchasePrice}
                        onChange={setPurchasePrice}
                    />
                    <ZarInput
                        label="Deposit (optional)"
                        value={deposit}
                        onChange={(v) => setDeposit(Math.min(v, purchasePrice))}
                    />
                    <PercentInput
                        label="Interest Rate"
                        value={interestRate}
                        onChange={setInterestRate}
                    />
                    <TermSelect
                        label="Loan term"
                        value={years}
                        onChange={setYears}
                    />
                </div>

                {/* Results */}
                <div className="bg-ink-50 p-5 sm:p-6 border-t md:border-t-0 md:border-l border-ink-200">
                    <div className="bg-white rounded-xl p-4 mb-5 border border-ink-200">
                        <p className="text-[13px] font-semibold text-ink-600">Monthly repayments</p>
                        <p className="text-3xl sm:text-4xl font-bold mt-1">{fmtZar(monthly)}</p>
                    </div>
                    <ResultRow label="Loan Value (Capital):" value={fmtZar(principal)} />
                    <ResultRow label="Total interest:" value={fmtZar(totalInterest)} />
                    <ResultRow label="Total repayment:" value={fmtZar(totalRepayment)} last />
                    <Link
                        href="/calculator#affordability"
                        className="block mt-4 text-[14px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                        Can I afford this?
                    </Link>
                </div>
            </div>
        </section>
    );
}

/* ────────────────────── Affordability Calculator ────────────────────── */

function AffordabilityCalculator({ defaults }: { defaults: Defaults }) {
    const [gross, setGross] = useState<number>(0);
    const [net, setNet] = useState<number>(0);
    const [expenses, setExpenses] = useState<number>(0);
    const [interestRate, setInterestRate] = useState<number>(defaults.interest_rate);
    const [years, setYears] = useState<number>(defaults.loan_term);

    // SA banks generally cap the bond instalment at 30% of gross income, but
    // your disposable income (net − expenses) also has to cover it.
    const grossCap = gross * defaults.affordability_ratio;
    const disposableCap = Math.max(0, net - expenses);
    const maxInstalment = Math.max(0, Math.min(grossCap, disposableCap));
    const maxLoan = useMemo(
        () => maxPrincipal(maxInstalment, interestRate, years),
        [maxInstalment, interestRate, years]
    );

    return (
        <section id="affordability">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Affordability calculator</h2>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 bg-white rounded-2xl border border-ink-200 shadow-soft overflow-hidden">
                {/* Inputs */}
                <div className="p-5 sm:p-6 space-y-5">
                    <ZarInput label="Gross Income" value={gross} onChange={setGross} />
                    <ZarInput label="Net Income" value={net} onChange={setNet} />
                    <ZarInput label="Total Expenses" value={expenses} onChange={setExpenses} />
                    <PercentInput label="Interest Rate" value={interestRate} onChange={setInterestRate} />
                    <TermSelect label="Term in Years" value={years} onChange={setYears} />
                </div>

                {/* Results */}
                <div className="bg-ink-50 p-5 sm:p-6 border-t md:border-t-0 md:border-l border-ink-200">
                    <div className="bg-white rounded-xl p-4 mb-5 border border-ink-200">
                        <p className="text-[13px] font-semibold text-ink-600">Monthly Repayments</p>
                        <p className="text-3xl sm:text-4xl font-bold mt-1">{fmtZar(maxInstalment)}</p>
                    </div>
                    <ResultRow label="Maximum Loan Available:" value={fmtZar(maxLoan)} />

                    <p className="text-[13px] text-ink-600 mt-4">
                        Interest: <strong>{interestRate}%</strong> for <strong>{years} years</strong>
                    </p>
                    <p className="text-[12.5px] text-ink-500 mt-3">
                        <strong className="text-ink-700">Note:</strong> This calculation is based on general lender affordability guidelines of {Math.round(defaults.affordability_ratio * 100)}% instalment to gross income and on your disposable income.
                    </p>
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────── Reusable inputs ─────────────────────────── */

function ZarInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-[13px] font-bold mb-1.5 text-ink-900">{label}</label>
            <div className="flex items-stretch rounded-lg overflow-hidden border border-ink-200 bg-white focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand">
                <span
                    className="px-3 py-2.5 bg-ink-50 border-r border-ink-200 text-amber-700 text-[14px] font-semibold select-none"
                    aria-hidden="true"
                >
                    R
                </span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={value === 0 ? '0' : value.toLocaleString('en-ZA')}
                    onChange={(e) => {
                        // Strip non-digits, then parse
                        const raw = e.target.value.replace(/[^\d]/g, '');
                        onChange(Number(raw) || 0);
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 bg-white px-3 py-2.5 text-[15px] focus:outline-none"
                />
            </div>
        </div>
    );
}

function PercentInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-[13px] font-bold mb-1.5 text-ink-900">{label}</label>
            <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-ink-200 focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand">
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value) || 0)}
                    className="flex-1 bg-white px-3 py-2.5 text-[15px] focus:outline-none"
                />
                <span className="px-3 py-2.5 bg-ink-50 border-l border-ink-200 text-ink-500 text-[14px] font-semibold">%</span>
            </div>
        </div>
    );
}

function TermSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-[13px] font-bold mb-1.5 text-ink-900">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            >
                {TERM_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y} years</option>
                ))}
            </select>
        </div>
    );
}

function ResultRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
    return (
        <div className={`py-3 ${last ? '' : 'border-b border-ink-200'}`}>
            <p className="text-[12.5px] text-ink-600">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
        </div>
    );
}
