/** Money helpers matching the website's fmtMoney convention. */
export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `R ${Math.round(n / 1_000)}k`;
  return `R ${Math.round(n)}`;
}

/** Full-precision display: "R 18 500" (ZAR, space thousands, no decimals). */
export function fmtMoneyFull(n: number): string {
  return `R ${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}
