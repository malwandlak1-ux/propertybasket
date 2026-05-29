import { InputHTMLAttributes, ReactNode } from 'react';

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
    hint?: ReactNode;
    rightLabel?: ReactNode;
};

export default function FormField({ label, error, hint, rightLabel, className, ...rest }: FormFieldProps) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-semibold text-ink-700">{label}</label>
                {rightLabel}
            </div>
            <input
                {...rest}
                className={
                    'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] ' +
                    'focus:ring-2 focus:ring-brand/20 focus:border-brand transition outline-none ' +
                    (error ? 'border-danger focus:ring-danger/20 focus:border-danger ' : '') +
                    (className ?? '')
                }
            />
            {hint && !error && <p className="text-[11px] text-ink-500 mt-1.5">{hint}</p>}
            {error && <p className="text-[11px] text-danger mt-1.5">{error}</p>}
        </div>
    );
}
