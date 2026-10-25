export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-ink">
      ✓ verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-coral px-2.5 py-0.5 text-xs font-semibold text-ink">✗ mismatch</span>
  );
}
