// A very casual, funny little mascot logo for Tour e Chol:
// a goofy wandering blob wearing a tiny explorer hat, with googly eyes,
// a big lopsided grin, and a little suitcase. Pure inline SVG, no deps.
export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Tour e Chol mascot"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* little suitcase being dragged along */}
      <g transform="rotate(-8 50 48)">
        <rect x="44" y="40" width="14" height="11" rx="2" fill="#f59e0b" />
        <rect x="49" y="37" width="4" height="4" rx="1.5" fill="#b45309" />
        <line x1="44" y1="45" x2="58" y2="45" stroke="#b45309" strokeWidth="1.5" />
      </g>

      {/* the blob body */}
      <path
        d="M14 36c0-11 8-19 18-19s18 8 18 19c0 6-3 10-6 10-2 0-3-1-5-1s-3 2-7 2-5-2-7-2-3 1-5 1c-3 0-6-4-6-10z"
        fill="#2dd4bf"
        stroke="#0f766e"
        strokeWidth="2"
      />

      {/* tiny explorer hat, worn at a jaunty angle */}
      <g transform="rotate(-10 32 14)">
        <ellipse cx="32" cy="16" rx="16" ry="4" fill="#0f766e" />
        <path d="M24 16c0-6 3-9 8-9s8 3 8 9z" fill="#115e59" />
        <rect x="24" y="13" width="16" height="3" rx="1.5" fill="#f59e0b" />
      </g>

      {/* googly eyes */}
      <circle cx="26" cy="30" r="5" fill="#fff" stroke="#0f766e" strokeWidth="1.5" />
      <circle cx="40" cy="30" r="5" fill="#fff" stroke="#0f766e" strokeWidth="1.5" />
      <circle cx="27" cy="31" r="2.2" fill="#1e293b" />
      <circle cx="39" cy="29" r="2.2" fill="#1e293b" />

      {/* big lopsided grin + a cheeky tongue */}
      <path
        d="M24 38c3 5 13 5 16 0"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M33 41c2 0 3-1 3-2-2 0-4 0-5 1z" fill="#fb7185" />

      {/* rosy cheeks */}
      <circle cx="20" cy="36" r="2" fill="#fbbf24" opacity="0.7" />
      <circle cx="44" cy="36" r="2" fill="#fbbf24" opacity="0.7" />

      {/* two stubby little feet mid-waddle */}
      <ellipse cx="25" cy="48" rx="4" ry="2.5" fill="#0f766e" />
      <ellipse cx="37" cy="49" rx="4" ry="2.5" fill="#0f766e" />
    </svg>
  );
}
