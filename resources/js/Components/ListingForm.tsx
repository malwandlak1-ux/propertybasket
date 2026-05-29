/**
 * Shared 6-step Create-Listing form used by Agency, Agent, and Landlord dashboards.
 *
 * Props are pre-filled by the calling page from the appropriate controller
 * (which scopes the new listing to the right owner: Agency or Landlord).
 *
 *   submitUrl      — POST endpoint that creates the listing
 *   cancelUrl      — back link
 *   agents         — list of agents (only meaningful for agency-side; agents/landlords pass [] or single self)
 *   amenities      — group → labels
 *   property_types — dropdown options
 *   provinces      — dropdown options
 *   showAgentSelect — render the "Assign to agent" field (true for agency, false otherwise)
 *   ownerLabel     — appears in the header (e.g. "Sandton Realty", "Sipho Dlamini", "Thandi Mokoena")
 */
import { useMemo, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

function hasUnitContent(u: { unit_number: string; monthly_rent: string }): boolean {
    return u.unit_number.trim() !== '' || u.monthly_rent.trim() !== '';
}

type Agent = { id: number; name: string; email: string };
type Option = { value: string; label: string };

type Unit = {
    unit_number: string;
    monthly_rent: string;
    bedrooms: string;
    bathrooms: string;
    area_sqm: string;
};

export type ListingFormInitial = {
    listing_type?: '' | 'for_sale' | 'long_term_rent';
    title?: string;
    property_type?: string;
    description?: string;
    listing_structure?: 'single_unit' | 'multi_unit';
    sale_price?: string;
    monthly_rent?: string;
    bedrooms?: string;
    bathrooms?: string;
    area_sqm?: string;
    units?: Unit[];
    address?: string;
    suburb?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    latitude?: string;
    longitude?: string;
    amenities?: string[];
    negotiator_protocol?: boolean;
    primary_image?: string | null;     // existing URL
    gallery_images?: string[];          // existing URLs
};

type Props = {
    submitUrl: string;
    cancelUrl: string;
    ownerLabel: string;
    agents: Agent[];
    amenities: Record<string, string[]>;
    property_types: Option[];
    provinces: string[];
    showAgentSelect?: boolean;
    /** When provided, the form is in edit mode and these fill the initial state. */
    initial?: ListingFormInitial;
    mode?: 'create' | 'edit';
};

export default function ListingForm({
    submitUrl,
    cancelUrl,
    ownerLabel,
    agents,
    amenities,
    property_types,
    provinces,
    showAgentSelect = false,
    initial,
    mode = 'create',
}: Props) {
    const existingPrimary  = initial?.primary_image ?? null;
    const existingGallery  = initial?.gallery_images ?? [];

    const { data, setData, post, processing, errors, progress, transform } = useForm<{
        listing_type: '' | 'for_sale' | 'long_term_rent';
        title: string;
        property_type: string;
        description: string;
        listing_structure: 'single_unit' | 'multi_unit';
        sale_price: string;
        monthly_rent: string;
        bedrooms: string;
        bathrooms: string;
        area_sqm: string;
        units: Unit[];
        address: string;
        suburb: string;
        city: string;
        province: string;
        postal_code: string;
        latitude: string;
        longitude: string;
        amenities: string[];
        custom_amenities: string[];
        primary_image: File | null;
        gallery_images: File[];
        negotiator_protocol: boolean;
        agent_id: string;
    }>({
        listing_type:        initial?.listing_type        ?? '',
        title:               initial?.title               ?? '',
        property_type:       initial?.property_type       ?? '',
        description:         initial?.description         ?? '',
        listing_structure:   initial?.listing_structure   ?? 'single_unit',
        sale_price:          initial?.sale_price          ?? '',
        monthly_rent:        initial?.monthly_rent        ?? '',
        bedrooms:            initial?.bedrooms            ?? '',
        bathrooms:           initial?.bathrooms           ?? '',
        area_sqm:            initial?.area_sqm            ?? '',
        units:               initial?.units && initial.units.length > 0
            ? initial.units
            : [{ unit_number: '', monthly_rent: '', bedrooms: '', bathrooms: '', area_sqm: '' }],
        address:             initial?.address             ?? '',
        suburb:              initial?.suburb              ?? '',
        city:                initial?.city                ?? '',
        province:            initial?.province            ?? '',
        postal_code:         initial?.postal_code         ?? '',
        latitude:            initial?.latitude            ?? '',
        longitude:           initial?.longitude           ?? '',
        amenities:           initial?.amenities           ?? [],
        custom_amenities:    [],
        primary_image:       null,
        gallery_images:      [],
        negotiator_protocol: initial?.negotiator_protocol ?? false,
        agent_id:            '',
    });

    const [customAmenityInput, setCustomAmenityInput] = useState('');

    const mapSrc = useMemo(() => {
        const lat = parseFloat(data.latitude || '');
        const lng = parseFloat(data.longitude || '');
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const d = 0.005;
            return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
        }
        return 'https://www.openstreetmap.org/export/embed.html?bbox=27.95%2C-26.30%2C28.18%2C-26.13&layer=mapnik';
    }, [data.latitude, data.longitude]);

    function toggleAmenity(label: string) {
        setData('amenities', data.amenities.includes(label)
            ? data.amenities.filter((a) => a !== label)
            : [...data.amenities, label]);
    }
    function addCustomAmenity() {
        const trimmed = customAmenityInput.trim();
        if (! trimmed || data.custom_amenities.includes(trimmed)) return;
        setData('custom_amenities', [...data.custom_amenities, trimmed]);
        setCustomAmenityInput('');
    }
    function removeCustomAmenity(label: string) {
        setData('custom_amenities', data.custom_amenities.filter((a) => a !== label));
    }

    function addUnit() {
        setData('units', [...data.units, { unit_number: '', monthly_rent: '', bedrooms: '', bathrooms: '', area_sqm: '' }]);
    }
    function removeUnit(i: number) {
        setData('units', data.units.filter((_, idx) => idx !== i));
    }
    function updateUnit(i: number, patch: Partial<Unit>) {
        setData('units', data.units.map((u, idx) => idx === i ? { ...u, ...patch } : u));
    }

    function onPrimaryFile(e: React.ChangeEvent<HTMLInputElement>) {
        setData('primary_image', e.target.files?.[0] ?? null);
    }
    function onGalleryFiles(e: React.ChangeEvent<HTMLInputElement>) {
        if (! e.target.files) return;
        setData('gallery_images', Array.from(e.target.files).slice(0, 50));
    }

    // The form keeps a placeholder unit in state for UX. If the user isn't
    // submitting a multi-unit rental, strip `units` before posting — otherwise
    // the server's `required_with:units` rules fire on the empty placeholder
    // and silently reject the listing.
    transform((d) => {
        const shouldSendUnits = d.listing_structure === 'multi_unit'
            && d.listing_type === 'long_term_rent'
            && d.units.some(hasUnitContent);
        return shouldSendUnits ? d : { ...d, units: [] };
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(submitUrl, { forceFormData: true });
    }

    const isRent = data.listing_type === 'long_term_rent';
    const isSale = data.listing_type === 'for_sale';

    return (
        <form onSubmit={submit} className="px-4 sm:px-8 py-7 space-y-6 max-w-7xl">
            {/* Header */}
            <header className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                    </span>
                    <div>
                        <h1 className="text-xl font-bold text-brand-700">
                            {mode === 'edit' ? 'Edit Property Listing' : 'Create New Property Listing'}
                        </h1>
                        <p className="text-[12.5px] text-ink-500">
                            {mode === 'edit' ? 'Update details for ' : 'Publishing as '}<strong>{ownerLabel}</strong>
                            {mode === 'edit' ? ' — make your changes and save.' : ' — fill in the details below.'}
                        </p>
                    </div>
                </div>
            </header>

            {/* Step 1 */}
            <Step n={1} title="Listing Type" subtitle="Select the primary purpose of this listing.">
                <div className="grid grid-cols-2 gap-4">
                    <TypeButton active={data.listing_type === 'for_sale'} onClick={() => setData('listing_type', 'for_sale')} label="For Sale" />
                    <TypeButton active={data.listing_type === 'long_term_rent'} onClick={() => setData('listing_type', 'long_term_rent')} label="For Rent" />
                </div>
                {errors.listing_type && <p className="text-danger text-[12px] mt-2">{errors.listing_type}</p>}
            </Step>

            {/* Step 2 */}
            <Step n={2} title="Basic Details" subtitle="Provide core information about the property.">
                <div className="grid grid-cols-2 gap-5">
                    <Field label="Title" error={errors.title}>
                        <input value={data.title} onChange={(e) => setData('title', e.target.value)} placeholder="e.g. Modern Apartment, 3 Beds" className={inputCls} />
                    </Field>
                    <Field label="Property Type" error={errors.property_type}>
                        <select value={data.property_type} onChange={(e) => setData('property_type', e.target.value)} className={inputCls}>
                            <option value="">Select asset type…</option>
                            {property_types.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </Field>
                </div>
                <Field label="Detailed Description" error={errors.description} className="mt-4">
                    <textarea value={data.description} onChange={(e) => setData('description', e.target.value)} placeholder="Highlight unique features and location benefits." rows={4} className={inputCls} />
                </Field>
            </Step>

            {/* Step 3 */}
            <Step n={3} title="Structure, Pricing & Features" subtitle="Define the structure and features of the property.">
                {isRent && (
                    <Field label="Listing Structure">
                        <div className="grid grid-cols-2 gap-4">
                            <StructureCard
                                active={data.listing_structure === 'single_unit'}
                                onClick={() => setData('listing_structure', 'single_unit')}
                                title="Single Unit / Whole Property"
                                subtitle="List the entire property under one price."
                                icon={<path d="M3 21V10l9-7 9 7v11H3z M9 21v-7h6v7"/>}
                            />
                            <StructureCard
                                active={data.listing_structure === 'multi_unit'}
                                onClick={() => setData('listing_structure', 'multi_unit')}
                                title="Multi-Unit / Subletting"
                                subtitle="Define and price individual units / rooms."
                                icon={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>}
                            />
                        </div>
                    </Field>
                )}

                {(isSale || (isRent && data.listing_structure === 'single_unit')) && (
                    <div className="grid grid-cols-4 gap-4 mt-4">
                        {isSale && (
                            <Field label="Sale Price (R)" error={errors.sale_price}>
                                <input type="number" min={0} value={data.sale_price} onChange={(e) => setData('sale_price', e.target.value)} className={inputCls} />
                            </Field>
                        )}
                        {isRent && data.listing_structure === 'single_unit' && (
                            <Field label="Monthly Rent (R)" error={errors.monthly_rent}>
                                <input type="number" min={0} value={data.monthly_rent} onChange={(e) => setData('monthly_rent', e.target.value)} className={inputCls} />
                            </Field>
                        )}
                        <Field label="Bedrooms" error={errors.bedrooms}>
                            <input type="number" min={0} value={data.bedrooms} onChange={(e) => setData('bedrooms', e.target.value)} className={inputCls} />
                        </Field>
                        <Field label="Bathrooms" error={errors.bathrooms}>
                            <input type="number" min={0} step={0.5} value={data.bathrooms} onChange={(e) => setData('bathrooms', e.target.value)} className={inputCls} />
                        </Field>
                        <Field label="Area (sq. meters)" error={errors.area_sqm}>
                            <input type="number" min={0} value={data.area_sqm} onChange={(e) => setData('area_sqm', e.target.value)} className={inputCls} />
                        </Field>
                    </div>
                )}

                {isRent && data.listing_structure === 'multi_unit' && (
                    <div className="mt-4 space-y-3">
                        <p className="text-[12px] text-ink-500">Define each rentable unit / room — each can have its own rent.</p>
                        {data.units.map((u, i) => (
                            <div key={i} className="bg-ink-50 border border-ink-200 rounded-lg p-3 grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-3">
                                    <label className="block text-[11px] text-ink-500 mb-1">Unit / Room</label>
                                    <input className={inputCls} value={u.unit_number} onChange={(e) => updateUnit(i, { unit_number: e.target.value })} placeholder="e.g. Unit 1A" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] text-ink-500 mb-1">Rent (R)</label>
                                    <input type="number" min={0} className={inputCls} value={u.monthly_rent} onChange={(e) => updateUnit(i, { monthly_rent: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] text-ink-500 mb-1">Beds</label>
                                    <input type="number" min={0} className={inputCls} value={u.bedrooms} onChange={(e) => updateUnit(i, { bedrooms: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] text-ink-500 mb-1">Baths</label>
                                    <input type="number" min={0} step={0.5} className={inputCls} value={u.bathrooms} onChange={(e) => updateUnit(i, { bathrooms: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] text-ink-500 mb-1">Area m²</label>
                                    <input type="number" min={0} className={inputCls} value={u.area_sqm} onChange={(e) => updateUnit(i, { area_sqm: e.target.value })} />
                                </div>
                                <div className="col-span-1 flex">
                                    <button type="button" onClick={() => removeUnit(i)} disabled={data.units.length === 1}
                                        className="text-[11px] px-2 py-2 text-danger hover:bg-danger/10 rounded disabled:opacity-40 disabled:cursor-not-allowed">✕</button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addUnit}
                            className="text-[12px] px-3 py-1.5 border border-dashed border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50">
                            + Add another unit
                        </button>
                    </div>
                )}
            </Step>

            {/* Step 4 */}
            <Step n={4} title="Location & Map" subtitle="Add the address and (optionally) GPS coordinates to display a map pin.">
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Street Address" error={errors.address} className="col-span-2">
                        <input className={inputCls} value={data.address} onChange={(e) => setData('address', e.target.value)} placeholder="e.g. 12 Mooi Crescent" />
                    </Field>
                    <Field label="Suburb" error={errors.suburb}>
                        <input className={inputCls} value={data.suburb} onChange={(e) => setData('suburb', e.target.value)} />
                    </Field>
                    <Field label="City" error={errors.city}>
                        <input className={inputCls} value={data.city} onChange={(e) => setData('city', e.target.value)} />
                    </Field>
                    <Field label="Province" error={errors.province}>
                        <select value={data.province} onChange={(e) => setData('province', e.target.value)} className={inputCls}>
                            <option value="">Select province…</option>
                            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </Field>
                    <Field label="Postal Code" error={errors.postal_code}>
                        <input className={inputCls} value={data.postal_code} onChange={(e) => setData('postal_code', e.target.value)} />
                    </Field>
                    <Field label="Latitude (optional)" error={errors.latitude}>
                        <input type="number" step="any" className={inputCls} value={data.latitude} onChange={(e) => setData('latitude', e.target.value)} placeholder="-26.107" />
                    </Field>
                    <Field label="Longitude (optional)" error={errors.longitude}>
                        <input type="number" step="any" className={inputCls} value={data.longitude} onChange={(e) => setData('longitude', e.target.value)} placeholder="28.054" />
                    </Field>
                </div>
                <div className="mt-4 rounded-lg border border-ink-200 overflow-hidden">
                    <iframe key={mapSrc} src={mapSrc} title="Property location" className="w-full" style={{ height: 320, border: 0 }} />
                </div>
                <p className="text-[11px] text-ink-400 mt-2">
                    Tip: paste GPS coordinates from Google Maps (right-click any point → copy "lat, lng").
                </p>
            </Step>

            {/* Step 5 */}
            <Step n={5} title="Features & Amenities" subtitle="Select all amenities available at the property.">
                {Object.entries(amenities).map(([group, items]) => (
                    <div key={group} className="mb-5">
                        <p className="text-[12px] font-bold uppercase text-brand-600 tracking-wider mb-2">{group}</p>
                        <div className="grid grid-cols-3 gap-2">
                            {items.map((item) => (
                                <label key={item} className="flex items-center gap-2 text-[13px] cursor-pointer">
                                    <input type="checkbox" checked={data.amenities.includes(item)} onChange={() => toggleAmenity(item)}
                                        className="rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                                    {item}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
                <div className="border-t border-ink-200 pt-4 mt-2">
                    <p className="text-[12px] font-bold uppercase text-ink-500 tracking-wider mb-2">Custom amenities</p>
                    <div className="flex items-center gap-2 mb-2">
                        <input value={customAmenityInput} onChange={(e) => setCustomAmenityInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
                            placeholder="Add something not in the list (e.g. Rooftop deck)"
                            className={inputCls + ' flex-1'} />
                        <button type="button" onClick={addCustomAmenity} className="px-3 py-2 text-[12px] bg-ink-900 text-white rounded-md font-semibold hover:bg-ink-800 transition">+ Add</button>
                    </div>
                    {data.custom_amenities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {data.custom_amenities.map((a) => (
                                <span key={a} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 px-2 py-1 rounded-full text-[12px] font-semibold">
                                    {a}
                                    <button type="button" onClick={() => removeCustomAmenity(a)} className="text-brand-600 hover:text-brand-700">✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </Step>

            {/* Step 6 */}
            <Step n={6} title="Advanced Options & Media" subtitle="Upload your images and configure advanced options.">
                <div className="grid grid-cols-2 gap-5">
                    <Field label="Primary Image (1 file, max 5 MB)" error={errors.primary_image}>
                        {existingPrimary && ! data.primary_image && (
                            <div className="mb-2">
                                <img src={existingPrimary} alt="Current primary" className="w-32 h-24 object-cover rounded-lg border border-ink-200" />
                                <p className="text-[11px] text-ink-500 mt-1">Current image — pick a new file to replace it.</p>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={onPrimaryFile} className={fileCls} />
                        {data.primary_image && <p className="text-[11px] text-success mt-1">✓ {data.primary_image.name}</p>}
                    </Field>
                    <Field label="Gallery Images (max 50 files)" error={errors.gallery_images}>
                        {existingGallery.length > 0 && data.gallery_images.length === 0 && (
                            <p className="text-[11px] text-ink-500 mb-2">
                                {existingGallery.length} existing image{existingGallery.length === 1 ? '' : 's'} — new uploads will be appended.
                            </p>
                        )}
                        <input type="file" accept="image/*" multiple onChange={onGalleryFiles} className={fileCls} />
                        {data.gallery_images.length > 0 && <p className="text-[11px] text-success mt-1">✓ {data.gallery_images.length} file{data.gallery_images.length === 1 ? '' : 's'} selected</p>}
                    </Field>
                </div>

                <div className="grid grid-cols-2 gap-5 mt-4">
                    {showAgentSelect && (
                        <Field label="Assign to Agent (optional)">
                            <select value={data.agent_id} onChange={(e) => setData('agent_id', e.target.value)} className={inputCls}>
                                <option value="">Auto-allocate via round-robin</option>
                                {agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.email}</option>)}
                            </select>
                        </Field>
                    )}
                    <div className={'flex items-end ' + (showAgentSelect ? '' : 'col-span-2')}>
                        <label className="flex items-start gap-3 cursor-pointer bg-ink-50 border border-ink-200 rounded-lg p-3 flex-1">
                            <input type="checkbox" checked={data.negotiator_protocol} onChange={(e) => setData('negotiator_protocol', e.target.checked)}
                                className="mt-0.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                            <div>
                                <p className="text-[13px] font-semibold">Enable Negotiator Protocol</p>
                                <p className="text-[11px] text-ink-500 mt-0.5">Allow potential clients to submit counter offers.</p>
                            </div>
                        </label>
                    </div>
                </div>

                {progress && (
                    <div className="mt-3">
                        <div className="h-1.5 bg-ink-200 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress.percentage}%` }} />
                        </div>
                        <p className="text-[11px] text-ink-500 mt-1">Uploading… {progress.percentage}%</p>
                    </div>
                )}
            </Step>

            {/* Submit */}
            {Object.keys(errors).length > 0 && (
                <div className="bg-danger/5 border border-danger/30 text-danger rounded-xl p-4 text-[13px]">
                    <p className="font-semibold mb-1">Please fix the following before saving:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                        {Object.entries(errors).map(([field, msg]) => (
                            <li key={field}><strong>{field}:</strong> {msg as string}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex items-center justify-between bg-white rounded-xl border border-ink-200 p-5 shadow-soft sticky bottom-4 z-10">
                <Link href={cancelUrl} className="text-[13px] text-ink-500 hover:text-ink-900">← Cancel and go back</Link>
                <button type="submit" disabled={processing}
                    className="px-5 py-2 text-[13px] bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 inline-flex items-center gap-2 font-semibold transition">
                    {processing && <Spinner size={14} />}
                    {processing
                        ? (mode === 'edit' ? 'Saving Changes…' : 'Saving Property…')
                        : (mode === 'edit' ? 'Save Changes' : 'Save Property')}
                </button>
            </div>
        </form>
    );
}

// ──────────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition';
const fileCls = 'w-full text-[12px] text-ink-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-ink-100 file:text-ink-700 hover:file:bg-ink-200';

function Step({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <div className="mb-4">
                <h2 className="text-[17px] font-bold">Step {n}: {title}</h2>
                {subtitle && <p className="text-[12.5px] text-ink-500 mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </section>
    );
}

function Field({ label, error, children, className = '' }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">{label}</label>
            {children}
            {error && <p className="text-danger text-[11px] mt-1">{error}</p>}
        </div>
    );
}

function TypeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button type="button" onClick={onClick}
            className={'rounded-lg border-2 py-3 text-[14px] font-semibold transition ' +
                (active ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-ink-700 border-ink-200 hover:border-brand-300')}>
            {label}
        </button>
    );
}

function StructureCard({ active, onClick, title, subtitle, icon }: { active: boolean; onClick: () => void; title: string; subtitle: string; icon: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition ' +
                (active ? 'border-brand-500 bg-brand-50/60' : 'border-ink-200 hover:border-brand-300')}>
            <span className={'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ' + (active ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-700')}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{icon}</svg>
            </span>
            <div>
                <p className="text-[13.5px] font-bold">{title}</p>
                <p className="text-[11.5px] text-ink-500 mt-0.5">{subtitle}</p>
            </div>
        </button>
    );
}
