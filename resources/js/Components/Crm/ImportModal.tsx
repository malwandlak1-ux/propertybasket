import { DragEvent, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import xlsxUrl from '@/vendor/xlsx.full.min.js?url';

type Row = {
    owner_name: string; unit: string; size: string; owner_type: string; id_reg: string; multi_unit: string;
    phone1: string; phone2: string; email: string; priority_note: string; notes: string;
};

declare global {
    interface Window {
        XLSX?: { read: (data: ArrayBuffer, opts: { type: 'array' }) => { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_json: (ws: unknown, opts: { header: 1; defval: string }) => unknown[][] } };
    }
}

/** SheetJS (~1 MB) is loaded only when someone imports an Excel file. */
function loadXlsx(): Promise<NonNullable<Window['XLSX']>> {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = xlsxUrl;
        s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('xlsx')));
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let cur: string[] = [], val = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
            if (ch === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else q = false; } else val += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { cur.push(val); val = ''; }
        else if (ch === '\n') { cur.push(val); rows.push(cur); cur = []; val = ''; }
        else if (ch !== '\r') val += ch;
    }
    if (val !== '' || cur.length) { cur.push(val); rows.push(cur); }
    return rows;
}

/** Column auto-detection, ported from the farming dashboard. */
export function mapRowsToOwners(rows: unknown[][]): Row[] {
    if (!rows?.length) return [];
    const KEYS: Record<string, string[]> = {
        owner: ['registered owner', 'owner name', 'first name', 'name', 'organization name'],
        unit: ['unit'], size: ['size', 'm²', 'm2'], otype: ['owner type', 'type', 'labels'],
        idreg: ['id / reg', 'reg number', 'id number', 'id/reg', 'id'],
        phone: ['phone 1 - value', 'phone 1', 'phone1', 'phone', 'mobile', 'cell', 'tel', 'contact'],
        phone2: ['phone 2 - value', 'phone 2', 'phone2'], email: ['email', 'e-mail'],
        multi: ['multi-unit', 'units held', 'sole owner'], priority: ['outreach priority', 'priority'], notes: ['notes', 'note'],
    };
    let hIdx = 0, best = -1;
    for (let i = 0; i < Math.min(8, rows.length); i++) {
        const cells = (rows[i] ?? []).map((c) => String(c ?? '').toLowerCase().trim());
        let score = 0;
        cells.forEach((c) => { for (const k in KEYS) { if (KEYS[k].some((kw) => c === kw || c.includes(kw))) { score++; break; } } });
        if (score > best) { best = score; hIdx = i; }
    }
    const hdr = (rows[hIdx] ?? []).map((c) => String(c ?? '').toLowerCase().trim());
    const col = (list: string[]) => {
        for (let j = 0; j < hdr.length; j++) if (list.some((kw) => hdr[j] === kw)) return j;
        for (let j = 0; j < hdr.length; j++) if (list.some((kw) => hdr[j].includes(kw))) return j;
        return -1;
    };
    const ci = Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, col(v)])) as Record<string, number>;
    const PH = /^(?:\+27\d{9}|0\d{9})$/;
    const isPhone = (s: string) => PH.test(s.replace(/\s/g, ''));
    const out: Row[] = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        const get = (j: number) => (j >= 0 && j < r.length ? String(r[j] ?? '').replace(/\n/g, ' ').trim() : '');
        const owner = get(ci.owner);
        if (!owner) continue;
        const phones: string[] = [];
        [get(ci.phone), get(ci.phone2)].forEach((v) => { if (v && isPhone(v) && !phones.includes(v)) phones.push(v); });
        if (phones.length < 2) r.forEach((c) => { const cs = String(c ?? '').trim(); if (isPhone(cs) && !phones.includes(cs) && phones.length < 2) phones.push(cs); });
        out.push({
            owner_name: owner.slice(0, 255), unit: get(ci.unit).slice(0, 40), size: get(ci.size).slice(0, 40),
            owner_type: get(ci.otype).slice(0, 80), id_reg: get(ci.idreg).slice(0, 40), multi_unit: get(ci.multi).slice(0, 120),
            phone1: phones[0] ?? '', phone2: phones[1] ?? '', email: get(ci.email).slice(0, 180),
            priority_note: get(ci.priority).slice(0, 255), notes: get(ci.notes).slice(0, 5000),
        });
    }
    return out;
}

export default function ImportModal({ schemeId, schemeName, onClose }: { schemeId: number; schemeName: string; onClose: () => void }) {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [file, setFile] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [drag, setDrag] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function read(f?: File | null) {
        if (!f) return;
        setError(''); setRows(null); setFile(f.name); setBusy(true);
        try {
            let raw: unknown[][];
            if (/\.csv$/i.test(f.name)) raw = parseCSV(await f.text());
            else {
                const XLSX = await loadXlsx();
                const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
                raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
            }
            const owners = mapRowsToOwners(raw);
            if (!owners.length) setError('No owner rows found. The file needs a column with owner names (e.g. "Registered Owner" or "First Name").');
            else setRows(owners);
        } catch {
            setError('Could not read that file. Use an .xlsx owner register or a .csv export.');
        } finally {
            setBusy(false);
        }
    }

    function commit() {
        if (!rows) return;
        setBusy(true);
        router.post(`/agent/crm/schemes/${schemeId}/import`, { rows }, { preserveScroll: true, onSuccess: onClose, onFinish: () => setBusy(false) });
    }

    const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files[0]); };

    return (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-lift w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div>
                    <h2 className="text-lg font-semibold">Import owners</h2>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">Add owner rows to {schemeName}. Duplicates (same owner and unit) are skipped.</p>
                </div>
                <div
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={onDrop}
                    className={'rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition ' +
                        (drag ? 'border-brand-500 bg-brand-50' : 'border-ink-300 bg-ink-50 hover:border-brand-300')}
                >
                    <p className="text-[14px] font-semibold text-ink-700">{busy && !rows ? 'Reading…' : 'Drop a file or click to browse'}</p>
                    <p className="text-[12px] text-ink-500 mt-1.5">
                        <b>.xlsx</b> owner registers or <b>.csv</b> (including Google Contacts exports).<br />Columns are detected automatically. Owner name and phone are enough.
                    </p>
                </div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => read(e.target.files?.[0])} />

                {error && <p className="text-[12.5px] text-danger">{error}</p>}
                {rows && (
                    <div>
                        <p className="text-[12.5px] text-ink-700"><b>{rows.length.toLocaleString('en-ZA')}</b> owner rows found in <b>{file}</b>. Preview:</p>
                        <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-ink-200">
                            <table className="w-full text-[12px]">
                                <thead className="bg-ink-50 text-ink-500 text-left">
                                    <tr><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Phone</th></tr>
                                </thead>
                                <tbody>
                                    {rows.slice(0, 8).map((r, i) => (
                                        <tr key={i} className="border-t border-ink-100">
                                            <td className="px-3 py-1.5 font-semibold">{r.unit}</td>
                                            <td className="px-3 py-1.5">{r.owner_name}</td>
                                            <td className="px-3 py-1.5">{r.phone1}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {rows.length > 8 && <p className="text-[11.5px] text-ink-500 mt-1.5">…and {(rows.length - 8).toLocaleString('en-ZA')} more</p>}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={btnOutline}>Cancel</button>
                    {rows && (
                        <button type="button" onClick={commit} disabled={busy} className={btnPrimary}>
                            {busy && <Spinner size={13} />}Import {rows.length.toLocaleString('en-ZA')} owners
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
