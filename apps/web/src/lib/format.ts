export function rupeesPerKg(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function kg(grams: number): string {
  return `${(grams / 1000).toFixed(1)} kg`;
}

export function shortenHex(hex: string, chars = 6): string {
  return `${hex.slice(0, chars + 2)}…${hex.slice(-chars)}`;
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
