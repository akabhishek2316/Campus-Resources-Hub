export function Crest({ size = 36 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 56"
      width={size}
      height={Math.round((size * 56) / 48)}
      role="img"
      aria-label="College crest"
    >
      <path
        d="M24 2 L44 9 V28 C44 40 35 49 24 54 C13 49 4 40 4 28 V9 Z"
        fill="#1B3F8B"
        stroke="#E8A317"
        strokeWidth="2.5"
      />
      <path
        d="M13 22 Q18.5 19 24 22 Q29.5 19 35 22 V36 Q29.5 33 24 36 Q18.5 33 13 36 Z"
        fill="#fff"
      />
      <path d="M24 22 V36" stroke="#1B3F8B" strokeWidth="1.5" />
      <circle cx="24" cy="12.5" r="2.7" fill="#E8A317" />
    </svg>
  );
}

export function Icon({ paths, className = 'h-5 w-5' }: { paths: string[]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export const ICONS = {
  check: ['M5 13l4 4L19 7'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  scale: ['M12 3v18', 'M6 21h12', 'M5 7h14', 'M5 7l-3 7a3 3 0 006 0z', 'M19 7l-3 7a3 3 0 006 0z'],
  clock: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 7v5l3 2'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z'],
  bell: ['M6 16v-5a6 6 0 0112 0v5l2 2H4z', 'M10 21a2 2 0 004 0'],
  search: ['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M20 20l-4-4'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  key: ['M15 7a4 4 0 11-3.9 4.9L4 19v-3h3v-2h2l2.1-2.1A4 4 0 0115 7z'],
  log: ['M6 3h9l4 4v14H6z', 'M9 12h7', 'M9 16h7', 'M9 8h3'],
};
