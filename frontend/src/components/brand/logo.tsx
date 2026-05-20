export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="lp-drop" x1="0" y1="0" x2="0" y2="64">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="lp-plane" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      {/* outer water drop — the liquid */}
      <path
        d="M32 4 C16 22 10 32 10 42 a22 22 0 0 0 44 0 c0 -10 -6 -20 -22 -38 z"
        fill="url(#lp-drop)"
      />
      {/* gloss highlight on the drop */}
      <path
        d="M22 30 C20 36 21 42 25 46"
        stroke="#bae6fd"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      {/* paper plane silhouette riding the drop */}
      <path
        d="M22 42 L46 30 L34 44 L34 38 Z"
        fill="url(#lp-plane)"
        stroke="#0c4a6e"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M34 38 L46 30"
        stroke="#0c4a6e"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
