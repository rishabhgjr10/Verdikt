import React from "react";

/** Monoline brand glyphs (lucide v1 ships no brand icons). 24px grid, currentColor. */
type IconProps = React.SVGProps<SVGSVGElement>;

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function YouTubeIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.5 9.5v5l4.3-2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5V16M8 7.8v.1M11.5 16v-5.5M11.5 13.2c0-1.6 1-2.7 2.4-2.7s2.1 1 2.1 2.7V16" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3.5 3.5h5.2l4.1 5.6 4.8-5.6h2.2l-6 7 6.9 9.5h-5.2l-4.5-6.1-5.3 6.1H3.5l6.6-7.6zm3 1.6 9.9 13.8h1.9L8.4 5.1z" />
    </svg>
  );
}
