export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#2e6a3b" />
      <path d="M8 44c6-3 10-3 16 0s10 3 16 0 8-2 16-1v13a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z" fill="#5fa8c4" />
      <path d="M24 42V18M24 18c-3 2-4 5-4 8M24 18c3 2 4 5 4 8" stroke="#bfe3b4" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M41 42V13" stroke="#f1d9a8" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="37.5" y="16" width="7" height="14" rx="3.5" fill="#e2b76a" />
    </svg>
  );
}
