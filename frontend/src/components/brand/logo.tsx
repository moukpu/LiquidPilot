export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="64">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path
        d="M52 28c-2-12-12-20-20-20S10 16 8 28c-1 6 1 12 4 16 2 3 6 5 10 6 4 1 8 2 12 2s8-1 12-2c4-1 8-3 10-6 3-4 5-10 4-16z"
        fill="url(#sky)"
        opacity="0.25"
      />
      <path
        d="M32 8c-2 0-4 1-5 3l-8 14c-1 2-1 4 0 6l4 8c1 2 3 3 5 3h8c2 0 4-1 5-3l4-8c1-2 1-4 0-6l-8-14c-1-2-3-3-5-3z"
        fill="url(#sky)"
      />
      <path
        d="M32 44v12M28 52l4 4 4-4"
        stroke="url(#sky)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
