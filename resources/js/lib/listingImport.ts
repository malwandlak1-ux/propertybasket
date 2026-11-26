/**
 * Browser side of Agency → Listings → Import. Reads another CRM's export
 * (xlsx / xls / csv) and the optional photos ZIP with SheetJS, guesses which
 * column is which, and shrinks photos before upload.
 */
import xlsxUrl from '@/vendor/xlsx.full.min.js?url';

export type Field =
    | 'external_ref' | 'title' | 'listing_type' | 'property_type' | 'status' | 'price' | 'description'
    | 'address' | 'suburb' | 'city' | 'province' | 'postal_code' | 'bedrooms' | 'bathrooms' | 'area_sqm'
    | 'latitude' | 'longitude' | 'agent_email' | 'features' | 'photo_urls';

export const FIELD_LABELS: Record<Field, string> = {
    external_ref: 'Listing reference', title: 'Title / heading', listing_type: 'Sale or rent', property_type: 'Property type',
    status: 'Status', price: 'Price / rent', description: 'Description', address: 'Street address', suburb: 'Suburb',
    city: 'City / town', province: 'Province', postal_code: 'Postal code', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms',
    area_sqm: 'Floor size (m²)', latitude: 'Latitude', longitude: 'Longitude', agent_email: 'Agent email',
    features: 'Features', photo_urls: 'Photo links',
};

export const FIELD_HINTS: Partial<Record<Field, string>> = {
    external_ref: 'Your CRM’s listing number. Re-importing the same file then updates instead of duplicating, and photos in the ZIP are matched by it.',
    price: 'Sale price, or monthly rent for rentals. “R 1 250 000” is fine.',
    listing_type: 'Words like “For sale”, “To let” or “Rental”. Empty rows use the default below.',
    status: 'Sold, rented and withdrawn listings are imported but never shown publicly.',
    agent_email: 'Matched to your agents’ emails; others go to the default agent.',
    features: 'Separated by commas or semicolons.',
    photo_urls: 'Web links to photos, separated by spaces, commas or semicolons. Downloaded in the background.',
};

/** Header words per field, most specific first. Exact matches win, then "contains". */
const SYNONYMS: Record<Field, string[]> = {
    external_ref: ['listing number', 'listing no', 'listing id', 'listing ref', 'listing reference', 'web ref', 'reference', 'property id', 'stock number', 'mandate number', 'ref no', 'ref', 'id'],
    title: ['marketing heading', 'listing title', 'heading', 'headline', 'title'],
    listing_type: ['listing type', 'sale or rent', 'sale/rent', 'sale / rent', 'transaction type', 'sale type', 'for sale/to let', 'market'],
    property_type: ['property type', 'type of property', 'property category', 'building type', 'property sub type', 'type'],
    status: ['listing status', 'status'],
    price: ['asking price', 'list price', 'listing price', 'monthly rental', 'rental amount', 'price', 'rental', 'rent', 'amount'],
    description: ['marketing description', 'description', 'remarks', 'details', 'body'],
    address: ['street address', 'address line 1', 'physical address', 'address', 'street'],
    suburb: ['suburb', 'area'],
    city: ['city', 'town', 'municipality'],
    province: ['province', 'region'],
    postal_code: ['postal code', 'postcode', 'post code', 'zip'],
    bedrooms: ['bedrooms', 'bedroom', 'beds'],
    bathrooms: ['bathrooms', 'bathroom', 'baths'],
    area_sqm: ['floor size', 'floor area', 'building size', 'size (m', 'size m', 'm²', 'm2', 'size'],
    latitude: ['latitude', 'lat'],
    longitude: ['longitude', 'lng', 'lon', 'long'],
    agent_email: ['agent email', 'agent e-mail', 'listing agent email', 'agent 1 email', 'email'],
    features: ['property features', 'features', 'amenities', 'extras'],
    photo_urls: ['photo urls', 'image urls', 'photo links', 'image links', 'photos', 'images', 'pictures', 'photo', 'image'],
};

export const FIELDS = Object.keys(SYNONYMS) as Field[];

type SheetJs = {
    read: (data: ArrayBuffer | Uint8Array, opts: { type: 'array' }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json: (ws: unknown, opts: { header: 1; defval: string; raw: boolean }) => unknown[][] };
    CFB: { read: (data: Uint8Array, opts: { type: 'array' }) => { FileIndex: { name: string; type: number; content: Uint8Array | number[] }[]; FullPaths: string[] } };
};

let sheetJs: Promise<SheetJs> | null = null;

/** SheetJS (~1 MB) only loads when someone imports. */
export function loadSheetJs(): Promise<SheetJs> {
    const w = window as unknown as { XLSX?: SheetJs };
    if (w.XLSX?.CFB) return Promise.resolve(w.XLSX);
    sheetJs ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = xlsxUrl;
        s.onload = () => (w.XLSX ? resolve(w.XLSX) : reject(new Error('xlsx')));
        s.onerror = reject;
        document.head.appendChild(s);
    });
    return sheetJs;
}

/** Every sheet cell as text; the first sheet of a workbook. */
export async function readTable(file: File): Promise<string[][]> {
    const X = await loadSheetJs();
    const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
    return rows.map((r) => (r ?? []).map((c) => String(c ?? '').trim()));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** The row (within the first 10) that looks most like a header, and a best-guess column per field. */
export function guessMapping(rows: string[][]): { headerRow: number; mapping: Record<Field, number> } {
    let headerRow = 0, best = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const cells = rows[i].map(norm);
        const hits = cells.filter((c) => c && FIELDS.some((f) => SYNONYMS[f].some((s) => c === s || (s.length >= 4 && c.includes(s))))).length;
        if (hits > best) { best = hits; headerRow = i; }
    }
    const hdr = (rows[headerRow] ?? []).map(norm);
    const used = new Set<number>();
    const mapping = Object.fromEntries(FIELDS.map((f) => [f, -1])) as Record<Field, number>;
    // Pass 1: exact header names. Pass 2: header contains a (long enough) synonym.
    for (const exact of [true, false]) {
        for (const f of FIELDS) {
            if (mapping[f] >= 0) continue;
            for (const s of SYNONYMS[f]) {
                const j = hdr.findIndex((h, k) => !used.has(k) && h !== '' && (exact ? h === s : s.length >= 4 && h.includes(s)));
                if (j >= 0) { mapping[f] = j; used.add(j); break; }
            }
        }
    }
    return { headerRow, mapping };
}

export type MappedRow = Partial<Record<Field, string>> & { _row: number };

export function buildRows(rows: string[][], headerRow: number, mapping: Record<Field, number>): MappedRow[] {
    const out: MappedRow[] = [];
    for (let i = headerRow + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.every((c) => c === '')) continue;
        const row: MappedRow = { _row: i + 1 };
        for (const f of FIELDS) {
            const j = mapping[f];
            if (j >= 0 && r[j] !== undefined && r[j] !== '') row[f] = r[j];
        }
        out.push(row);
    }
    return out;
}

// ── Photos ZIP ────────────────────────────────────────────────────────────

export type ZipPhoto = { name: string; bytes: Uint8Array; keys: string[] };

const IMG = /\.(jpe?g|png|webp|gif)$/i;
export const refKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Every photo in the ZIP with the references it could belong to: its folders
 * ("ENT-101/1.jpg") and its file name ("ENT-101_1.jpg", "ENT-101 (2).jpg").
 * photosFor() then picks the ones for a listing's real reference.
 */
export async function readPhotoZip(file: File): Promise<ZipPhoto[]> {
    const X = await loadSheetJs();
    const zip = X.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const root = (zip.FullPaths[0] ?? '').replace(/\\/g, '/'); // SheetJS's own root entry, not a folder in the ZIP
    const out: ZipPhoto[] = [];
    zip.FileIndex.forEach((entry, i) => {
        let path = (zip.FullPaths[i] ?? entry.name).replace(/\\/g, '/');
        if (root && path.startsWith(root)) path = path.slice(root.length);
        if (entry.type !== 2 || !IMG.test(path) || /(^|\/)(__MACOSX|\.)/.test(path)) return;
        const parts = path.split('/').filter(Boolean);
        const fileName = parts[parts.length - 1];
        // "ENT-102_3.jpg" → ENT-102, but "ENT-101.jpg" may itself be the reference: keep both.
        const bare = fileName.replace(IMG, '');
        const keys = [...parts.slice(0, -1), bare, bare.replace(/[\s_-]*\(?\d{1,3}\)?$/, '')].map(refKey).filter(Boolean);
        out.push({ name: fileName, bytes: entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content), keys });
    });
    return out;
}

/** The ZIP photos for one listing reference, in natural file order (1, 2, … 10). */
export function photosFor(all: ZipPhoto[], ref: string | null | undefined): ZipPhoto[] {
    const key = ref ? refKey(ref) : '';
    if (!key) return [];
    const collator = new Intl.Collator(undefined, { numeric: true });
    const num = (n: string) => Number(n.replace(IMG, '').match(/(\d{1,3})\)?$/)?.[1] ?? 0);
    return all.filter((p) => p.keys.includes(key)).sort((a, b) => num(a.name) - num(b.name) || collator.compare(a.name, b.name));
}

/** Resize to max 1600 px JPEG so every upload stays well under the server's limit. */
export async function shrinkPhoto(photo: ZipPhoto): Promise<Blob> {
    const type = /\.png$/i.test(photo.name) ? 'image/png' : /\.webp$/i.test(photo.name) ? 'image/webp' : 'image/jpeg';
    const src = new Blob([photo.bytes as BlobPart], { type });
    const bmp = await createImageBitmap(src);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && src.size < 1.5 * 1024 * 1024 && type === 'image/jpeg') return src;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize'))), 'image/jpeg', 0.85));
}

// ── Requests ──────────────────────────────────────────────────────────────

function csrf(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { message?: string }).message || `Request failed (${res.status})`);
    return data as T;
}

export async function uploadPhoto(listingId: number, blob: Blob, name: string): Promise<boolean> {
    const fd = new FormData();
    fd.append('photo', blob, name.replace(/\.\w+$/, '') + '.jpg');
    const res = await fetch(`/agency/listings/import/${listingId}/photo`, {
        method: 'POST', credentials: 'same-origin', body: fd,
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
    });
    return res.ok;
}

/** A CSV template with our column names and one example row. */
export function templateCsv(): string {
    const head = ['Listing reference', 'Title', 'Sale or rent', 'Property type', 'Status', 'Price', 'Description', 'Street address',
        'Suburb', 'City', 'Province', 'Postal code', 'Bedrooms', 'Bathrooms', 'Floor size', 'Latitude', 'Longitude', 'Agent email', 'Features', 'Photo links'];
    const example = ['ENT-101', '4 bedroom family home in Bryanston', 'For sale', 'House', 'Active', 'R 2 450 000', 'Spacious family home close to schools.',
        '12 Example Road', 'Bryanston', 'Sandton', 'Gauteng', '2191', '4', '2.5', '320', '', '', 'agent@youragency.co.za', 'Pool; Garden; Borehole', ''];
    const q = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return [head, example].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}
