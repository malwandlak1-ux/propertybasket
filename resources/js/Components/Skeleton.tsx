/**
 * Skeleton primitives — placeholders shown while data loads.
 *
 * Usage:
 *   <Skeleton.Line width="60%" />
 *   <Skeleton.Box height={120} />
 *   <Skeleton.Avatar size={36} />
 *   <Skeleton.KpiCard />
 *   <Skeleton.TableRows columns={5} rows={8} />
 */

const BASE = 'animate-pulse bg-ink-200 rounded';

function Line({ width = '100%', height = 12, className = '' }: { width?: string | number; height?: number; className?: string }) {
    return (
        <div
            className={`${BASE} ${className}`}
            style={{ width, height }}
        />
    );
}

function Box({ width = '100%', height = 80, className = '' }: { width?: string | number; height?: number; className?: string }) {
    return (
        <div
            className={`${BASE} ${className}`}
            style={{ width, height }}
        />
    );
}

function Avatar({ size = 36, className = '' }: { size?: number; className?: string }) {
    return (
        <div
            className={`${BASE.replace('rounded', 'rounded-full')} ${className}`}
            style={{ width: size, height: size }}
        />
    );
}

function KpiCard() {
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
                <Line width={80} height={10} />
                <Box width={28} height={28} className="rounded-lg" />
            </div>
            <Line width={120} height={28} className="mb-2" />
            <Line width={140} height={10} />
        </div>
    );
}

function ListItem() {
    return (
        <div className="flex items-center gap-3 py-3 border-b border-ink-100 last:border-b-0">
            <Avatar size={36} />
            <div className="flex-1 space-y-2">
                <Line width="55%" height={12} />
                <Line width="35%" height={10} />
            </div>
            <Line width={70} height={14} />
        </div>
    );
}

function Card({ height = 160, className = '' }: { height?: number; className?: string }) {
    return (
        <div className={`bg-white rounded-xl border border-ink-200 p-5 shadow-soft ${className}`} style={{ height }}>
            <Line width={100} height={12} className="mb-3" />
            <Line width="80%" height={10} className="mb-2" />
            <Line width="60%" height={10} className="mb-2" />
            <Line width="70%" height={10} />
        </div>
    );
}

function TableRows({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <tr key={i} className="border-b border-ink-100">
                    {Array.from({ length: columns }).map((__, j) => (
                        <td key={j} className="px-5 py-4">
                            <Line width={j === 0 ? '70%' : '50%'} height={12} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

/**
 * Compact spinning circle — for button-internal loading.
 */
function Spinner({ size = 14, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            className={`animate-spin ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
            <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
            />
        </svg>
    );
}

const Skeleton = { Line, Box, Avatar, KpiCard, ListItem, Card, TableRows, Spinner };

export default Skeleton;
export { Spinner };
