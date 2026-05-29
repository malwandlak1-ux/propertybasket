import { FormEvent, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import ListingCard, { ListingCardData } from '@/Components/ListingCard';

type Props = {
    featured: ListingCardData[];
    cities: { city: string; total: number }[];
    totals: { listings: number; agencies: number; contractors: number };
};

const PROPERTY_TYPES: Array<{ value: string; label: string }> = [
    { value: 'apartment',  label: 'Apartment' },
    { value: 'house',      label: 'House' },
    { value: 'townhouse',  label: 'Townhouse' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'land',       label: 'Land' },
    { value: 'other',      label: 'Other' },
];

export default function Home({ featured, cities, totals }: Props) {
    return (
        <PublicLayout>
            <Head title="Find your next home" />

            {/* Hero */}
            <section
                className="relative text-white"
                style={{
                    background:
                        'radial-gradient(at 20% 20%, rgba(91,61,245,0.45) 0, transparent 50%),' +
                        'radial-gradient(at 80% 0%, rgba(74,46,224,0.40) 0, transparent 50%),' +
                        'radial-gradient(at 60% 80%, rgba(58,35,184,0.50) 0, transparent 50%),' +
                        '#0B0B0F',
                }}
            >
                <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28 relative">
                    <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
                        🇿🇦 South African properties
                    </span>
                    <h1 className="mt-5 text-4xl lg:text-6xl font-bold tracking-tight max-w-3xl leading-tight">
                        Find a home, rent a place, or partner with the people who keep them running.
                    </h1>
                    <p className="mt-5 text-white/70 text-[17px] max-w-2xl">
                        Every active listing across our network of agencies and private landlords —
                        plus a marketplace of vetted contractors to keep the lights on.
                    </p>

                    <div className="mt-9 flex flex-wrap gap-3">
                        <Link
                            href="/properties"
                            className="px-5 py-3 rounded-lg bg-white text-ink-900 font-semibold text-[14px] hover:bg-ink-100 transition"
                        >
                            Browse properties
                        </Link>
                        <Link
                            href="/agencies"
                            className="px-5 py-3 rounded-lg bg-white/10 hover:bg-white/15 backdrop-blur text-white font-semibold text-[14px] transition border border-white/20"
                        >
                            Explore agencies
                        </Link>
                    </div>

                    <div className="mt-12 flex flex-wrap items-center gap-8 text-white/80">
                        <div>
                            <p className="text-3xl font-bold text-white">{totals.listings}</p>
                            <p className="text-[12px] uppercase tracking-wider text-white/60">Active listings</p>
                        </div>
                        <div className="w-px h-10 bg-white/20" />
                        <div>
                            <p className="text-3xl font-bold text-white">{totals.agencies}</p>
                            <p className="text-[12px] uppercase tracking-wider text-white/60">Agencies</p>
                        </div>
                        <div className="w-px h-10 bg-white/20" />
                        <div>
                            <p className="text-3xl font-bold text-white">{totals.contractors}</p>
                            <p className="text-[12px] uppercase tracking-wider text-white/60">Contractors</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Search & filter widget — overlaps the hero */}
            <SearchWidget cities={cities} />

            {/* Featured listings */}
            <section className="max-w-7xl mx-auto px-6 py-16">
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Featured properties</h2>
                        <p className="text-ink-500 mt-1 text-[14px]">Fresh on the market this week</p>
                    </div>
                    <Link
                        href="/properties"
                        className="hidden md:inline text-[14px] font-semibold text-brand-700 hover:underline"
                    >
                        See all →
                    </Link>
                </div>

                {featured.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-ink-200 p-12 text-center text-ink-500">
                        No properties on the market yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {featured.map((l) => (
                            <ListingCard key={l.slug} listing={l} />
                        ))}
                    </div>
                )}
            </section>

            {/* Explore cities */}
            {cities.length > 0 && <ExploreCities cities={cities} />}

            {/* Rental Management — value props + inline registration */}
            <RentalManagement />
        </PublicLayout>
    );
}

const CITY_IMAGE_MAP: Record<string, string> = {
    Johannesburg: '/images/cities/johannesburg.jpg',
    'Cape Town':  '/images/cities/cape-town.jpg',
    Durban:       '/images/cities/durban.jpg',
    Pretoria:     '/images/cities/pretoria.jpg',
};

const FALLBACK_CITY_IMAGE = '/images/cities/default.jpg';

function ExploreCities({ cities }: { cities: Props['cities'] }) {
    return (
        <section className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
                <div className="lg:col-span-1 flex flex-col justify-center">
                    <h2 className="text-3xl font-bold tracking-tight">Explore Cities</h2>
                    <p className="mt-3 text-[14px] text-ink-500 leading-relaxed">
                        Check out our listings from your favourite city
                    </p>
                </div>

                <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {cities.map((c) => (
                        <CityTile key={c.city} city={c.city} total={c.total} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function CityTile({ city, total }: { city: string; total: number }) {
    const image = CITY_IMAGE_MAP[city] ?? FALLBACK_CITY_IMAGE;
    const propertiesLabel = total === 1 ? '1 Property' : `${total} Properties`;

    return (
        <Link
            href={`/properties?city=${encodeURIComponent(city)}`}
            className="group relative aspect-[3/5] rounded-2xl overflow-hidden block hover:shadow-lift transition-shadow"
        >
            <img
                src={image}
                alt={city}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/55" />
            <div className="absolute inset-0 flex flex-col p-5 text-white">
                <p className="text-[12px] font-medium text-white/90">{propertiesLabel}</p>
                <h3 className="mt-1 text-[22px] font-bold leading-tight">{city}</h3>
                <div className="mt-auto flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-[0.15em] uppercase">More Details</span>
                    <span className="w-8 h-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center group-hover:bg-white/30 transition">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                            <path d="M5 12h14M13 6l6 6-6 6"/>
                        </svg>
                    </span>
                </div>
            </div>
        </Link>
    );
}

function RentalManagement() {
    return (
        <section
            className="relative text-white overflow-hidden"
            style={{
                backgroundImage:
                    'linear-gradient(rgba(11,11,15,0.92), rgba(11,11,15,0.92)),' +
                    'url(/images/home/rental-bg.jpg)',
                backgroundSize:     'cover',
                backgroundPosition: 'center',
                backgroundColor:    '#0B0B0F',
            }}
        >
            <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
                {/* Left: heading + 2x2 marketing grid */}
                <div className="lg:col-span-2 space-y-10">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                        Rental<br/>Management
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-10">
                        <ValueProp
                            title="Tenants"
                            body="The Tenant Dashboard is a secure self-service portal for tenants. They can log maintenance requests, make payments, and view their deposit balance. Tenants can also access their lease agreement online at any time."
                        />
                        <ValueProp
                            title="Contractors"
                            body="Registered contractors can respond to RFQs from agencies and landlords, receive payment for completed maintenance work, and track the income generated from their jobs."
                        />
                        <ValueProp
                            title="Agency/Landlord"
                            body="Enables landlords and agents to efficiently manage their rental properties. They can send invoices to tenants, handle maintenance requests, monitor income versus expenses and streamline moving in and out inspections."
                        />
                        <div>
                            <h3 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                                Book<br/>A Demo
                            </h3>
                            <Link
                                href="/contact"
                                className="mt-6 inline-flex items-center justify-center px-8 py-3 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white font-semibold text-[13px] transition"
                            >
                                Book here
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right: inline registration card */}
                <div className="lg:col-span-1">
                    <RegisterCard />
                </div>
            </div>
        </section>
    );
}

function ValueProp({ title, body }: { title: string; body: string }) {
    return (
        <div>
            <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
            <p className="mt-4 text-[14px] text-white/70 leading-relaxed">{body}</p>
        </div>
    );
}

type RegisterRole = 'landlord' | 'tenant' | 'contractor';

function RegisterCard() {
    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string;
        email: string;
        password: string;
        password_confirmation: string;
        role: RegisterRole;
        business_name: string;
        compliance_number: string;
        terms_accepted: boolean;
    }>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'landlord',
        business_name: '',
        compliance_number: '',
        terms_accepted: false,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        if (data.role === 'tenant') {
            router.visit('/properties');
            return;
        }
        post('/register', { onSuccess: () => reset('password', 'password_confirmation') });
    }

    const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';
    const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

    const isTenant     = data.role === 'tenant';
    const isContractor = data.role === 'contractor';

    return (
        <div className="bg-white text-ink-900 rounded-2xl shadow-lift p-6 md:p-8">
            <h3 className="text-[20px] font-bold text-center">Create an Account</h3>
            <p className="text-[12px] text-ink-500 text-center mt-1">Join our platform to get started.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                    <label className={labelCls}>Full Name</label>
                    <input
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        disabled={isTenant}
                        required={!isTenant}
                        className={inputCls + (isTenant ? ' opacity-50' : '')}
                    />
                    {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                </div>

                <div>
                    <label className={labelCls}>Email</label>
                    <input
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        disabled={isTenant}
                        required={!isTenant}
                        className={inputCls + (isTenant ? ' opacity-50' : '')}
                    />
                    {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Password</label>
                        <input
                            type="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            disabled={isTenant}
                            required={!isTenant}
                            minLength={8}
                            className={inputCls + (isTenant ? ' opacity-50' : '')}
                        />
                        {errors.password && <p className="text-[11px] text-danger mt-1">{errors.password}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Confirm Password</label>
                        <input
                            type="password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            disabled={isTenant}
                            required={!isTenant}
                            minLength={8}
                            className={inputCls + (isTenant ? ' opacity-50' : '')}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>I am a…</label>
                    <select
                        value={data.role}
                        onChange={(e) => setData('role', e.target.value as RegisterRole)}
                        className={inputCls}
                    >
                        <option value="landlord">Landlord</option>
                        <option value="tenant">Tenant</option>
                        <option value="contractor">Contractor</option>
                    </select>
                </div>

                {isContractor && (
                    <div className="grid grid-cols-1 gap-3 pt-1 border-t border-ink-100">
                        <div>
                            <label className={labelCls}>Business name</label>
                            <input
                                value={data.business_name}
                                onChange={(e) => setData('business_name', e.target.value)}
                                required
                                className={inputCls}
                                placeholder="e.g. PlumbPro Solutions"
                            />
                            {errors.business_name && <p className="text-[11px] text-danger mt-1">{errors.business_name}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>CIPC / trade number</label>
                            <input
                                value={data.compliance_number}
                                onChange={(e) => setData('compliance_number', e.target.value)}
                                required
                                className={inputCls}
                                placeholder="Registration number"
                            />
                            {errors.compliance_number && <p className="text-[11px] text-danger mt-1">{errors.compliance_number}</p>}
                        </div>
                    </div>
                )}

                {isTenant && (
                    <div className="rounded-lg bg-brand-50 border border-brand-100 text-ink-700 px-4 py-3 text-[12px] leading-relaxed">
                        Tenant accounts are invited by your landlord or agent. Browse listings and inquire — once your lease is set up, you'll receive an invite email.
                    </div>
                )}

                {!isTenant && (
                    <label className="flex items-start gap-2 text-[12px] text-ink-600">
                        <input
                            type="checkbox"
                            checked={data.terms_accepted}
                            onChange={(e) => setData('terms_accepted', e.target.checked)}
                            className="mt-0.5"
                        />
                        <span>I agree to the <Link href="/terms" className="text-brand-700 hover:underline font-semibold">Terms and Conditions</Link>.</span>
                    </label>
                )}
                {errors.terms_accepted && <p className="text-[11px] text-danger -mt-2">{errors.terms_accepted}</p>}

                <button
                    type="submit"
                    disabled={processing || (!isTenant && !data.terms_accepted)}
                    className="w-full px-4 py-3 bg-ink-900 hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-[14px] transition"
                >
                    {isTenant ? 'Browse properties' : (processing ? 'Creating account…' : 'Create Account')}
                </button>

                <div className="text-center space-y-1 pt-1">
                    <p className="text-[12px] text-ink-600">
                        Already have an account? <Link href="/login" className="text-brand-700 hover:underline font-semibold">Log in</Link>
                    </p>
                    <p className="text-[12px] text-ink-600">
                        Are you an Agency? <Link href="/register" className="text-brand-700 hover:underline font-semibold">Register your Agency here</Link>
                    </p>
                </div>
            </form>
        </div>
    );
}

function SearchWidget({ cities }: { cities: Props['cities'] }) {
    const [listingType, setListingType]   = useState<'long_term_rent' | 'for_sale'>('long_term_rent');
    const [propertyType, setPropertyType] = useState('');
    const [city, setCity]                 = useState('');
    const [bedrooms, setBedrooms]         = useState('');
    const [priceMin, setPriceMin]         = useState('');
    const [priceMax, setPriceMax]         = useState('');

    function submit(e: FormEvent) {
        e.preventDefault();
        const query: Record<string, string> = { listing_type: listingType };
        if (propertyType) query.property_type = propertyType;
        if (city)         query.city          = city;
        if (bedrooms)     query.bedrooms      = bedrooms;
        if (priceMin)     query.price_min     = priceMin;
        if (priceMax)     query.price_max     = priceMax;
        router.get('/properties', query);
    }

    const tabCls = (active: boolean) =>
        'px-10 py-4 text-[16px] font-semibold rounded-t-lg transition ' +
        (active ? 'bg-brand-600 text-white' : 'bg-ink-900/80 text-white/70 hover:text-white');

    const fieldLabelCls = 'text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase mb-1.5 block';
    const fieldCls = 'w-full bg-white border-0 text-[14px] text-ink-900 placeholder:text-ink-400 outline-none focus:ring-0';

    return (
        <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 -mt-10 md:-mt-14">
            <div className="flex justify-center gap-[1%]">
                <button type="button" onClick={() => setListingType('long_term_rent')} className={tabCls(listingType === 'long_term_rent')}>
                    For Rent
                </button>
                <button type="button" onClick={() => setListingType('for_sale')} className={tabCls(listingType === 'for_sale')}>
                    For Sale
                </button>
            </div>

            <form onSubmit={submit} className="bg-white rounded-xl shadow-lift border border-ink-200 p-4 md:p-5 grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 items-end">
                <div>
                    <label className={fieldLabelCls}>Looking for</label>
                    <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={fieldCls}>
                        <option value="">Property Type</option>
                        {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>

                <div className="md:border-l md:border-ink-200 md:pl-4">
                    <label className={fieldLabelCls}>Location</label>
                    <select value={city} onChange={(e) => setCity(e.target.value)} className={fieldCls}>
                        <option value="">All Cities</option>
                        {cities.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
                    </select>
                </div>

                <div className="md:border-l md:border-ink-200 md:pl-4">
                    <label className={fieldLabelCls}>Property size</label>
                    <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={fieldCls}>
                        <option value="">Bedrooms</option>
                        <option value="1">1+ bed</option>
                        <option value="2">2+ beds</option>
                        <option value="3">3+ beds</option>
                        <option value="4">4+ beds</option>
                        <option value="5">5+ beds</option>
                    </select>
                </div>

                <div className="md:border-l md:border-ink-200 md:pl-4">
                    <label className={fieldLabelCls}>Your budget</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="0"
                            value={priceMin}
                            onChange={(e) => setPriceMin(e.target.value)}
                            placeholder="Min."
                            className={fieldCls}
                        />
                        <span className="text-ink-300 text-[12px]">—</span>
                        <input
                            type="number"
                            min="0"
                            value={priceMax}
                            onChange={(e) => setPriceMax(e.target.value)}
                            placeholder="Max."
                            className={fieldCls}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    aria-label="Search properties"
                    className="col-span-2 md:col-span-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-ink-900 hover:bg-ink-800 text-white rounded-lg transition font-semibold text-[13px]"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <span className="md:hidden">Search</span>
                </button>
            </form>
        </section>
    );
}
