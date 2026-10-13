import { useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import { Spinner } from '@/Components/Skeleton';
import { Accent, useAppearance } from '@/Components/Dashboard/Shell';
import { btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';

/**
 * Settings → Appearance. Drop into any role's Settings page.
 *
 * Accent re-tints the whole dashboard instantly (optimistic data-accent swap
 * on the shell) and is saved to the user. The logo replaces the Property
 * Basket mark in the sidebar; agents inherit their agency owner's logo.
 */
const ACCENTS: { key: Accent; label: string; swatch: string }[] = [
    { key: 'orange', label: 'Orange', swatch: 'linear-gradient(135deg,#F98A45,#B8470A)' },
    { key: 'black',  label: 'Black',  swatch: 'linear-gradient(135deg,#52525B,#09090B)' },
    { key: 'blue',   label: 'Blue',   swatch: 'linear-gradient(135deg,#5B8DEB,#173F86)' },
    { key: 'green',  label: 'Green',  swatch: 'linear-gradient(135deg,#46A970,#155A37)' },
    { key: 'purple', label: 'Purple', swatch: 'linear-gradient(135deg,#9A75DA,#4C2580)' },
];

export default function AppearanceSettings({ className = '' }: { className?: string }) {
    const appearance = useAppearance();
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [accent, setAccent] = useState<Accent>(appearance.accent);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    function pickAccent(key: Accent) {
        const previous = accent;
        setAccent(key);
        document.querySelectorAll<HTMLElement>('.pb-dash').forEach((el) => (el.dataset.accent = key));
        router.post('/settings/appearance', { accent: key }, {
            preserveScroll: true,
            preserveState: true,
            onError: () => {
                setAccent(previous);
                document.querySelectorAll<HTMLElement>('.pb-dash').forEach((el) => (el.dataset.accent = previous));
            },
        });
    }

    function upload(file: File) {
        setPreview(URL.createObjectURL(file));
        setUploading(true);
        router.post('/settings/logo', { logo: file }, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setUploading(false);
                setPreview(null);
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    }

    function removeLogo() {
        if (!confirm('Remove your logo and go back to the Property Basket logo?')) return;
        router.delete('/settings/logo', { preserveScroll: true, preserveState: true });
    }

    const shownLogo = preview ?? appearance.logo_url;

    return (
        <section className={`bg-white rounded-2xl shadow-soft p-5 sm:p-6 ${className}`}>
            <h2 className="text-[18px] font-semibold tracking-tight">Appearance</h2>
            <p className="text-[13px] text-ink-500 mt-1">The accent re-tints your whole dashboard and is saved to your account.</p>

            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase mt-6 mb-2.5">Accent</p>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Accent colour">
                {ACCENTS.map((a) => {
                    const on = accent === a.key;
                    return (
                        <button
                            key={a.key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => pickAccent(a.key)}
                            className={
                                'flex items-center gap-2.5 rounded-xl pl-1.5 pr-3.5 py-1.5 text-[13px] transition border ' +
                                (on ? 'border-ink-900 bg-white font-semibold shadow-soft' : 'border-transparent bg-ink-50 hover:bg-ink-100 text-ink-700')
                            }
                        >
                            <span className="w-7 h-7 rounded-lg" style={{ background: a.swatch }} />
                            {a.label}
                        </button>
                    );
                })}
            </div>

            {appearance.can_upload_logo !== false && (<>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase mt-7 mb-2.5">Dashboard logo</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-full sm:w-[240px] h-[84px] rounded-xl bg-[var(--pb-panel,#F5F6F5)] border border-dashed border-ink-300 flex items-center justify-center px-4 shrink-0">
                    {shownLogo
                        ? <img src={shownLogo} alt="Your logo" className="max-h-14 max-w-full object-contain" />
                        : <AppLogo height={24} />}
                </div>
                <div className="text-[12.5px] text-ink-500 space-y-2.5">
                    <p>
                        Replaces the Property Basket logo in your sidebar. PNG, JPG or WebP, up to 2&nbsp;MB —
                        a wide logo on a transparent background works best.
                    </p>
                    {appearance.logo_inherited && (
                        <p className="text-brand-700">You're seeing your agency's logo. Upload your own to override it.</p>
                    )}
                    {errors?.logo && <p className="text-danger">{errors.logo}</p>}
                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                        />
                        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={btnPrimary + ' min-w-[132px]'}>
                            {uploading ? <><Spinner size={14} />Uploading…</> : appearance.has_own_logo ? 'Replace logo' : 'Upload logo'}
                        </button>
                        {appearance.has_own_logo && (
                            <button type="button" onClick={removeLogo} className={btnOutline}>Remove</button>
                        )}
                    </div>
                </div>
            </div>
            </>)}
        </section>
    );
}
