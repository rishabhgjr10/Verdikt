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

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3.5 3.5h5.2l4.1 5.6 4.8-5.6h2.2l-6 7 6.9 9.5h-5.2l-4.5-6.1-5.3 6.1H3.5l6.6-7.6zm3 1.6 9.9 13.8h1.9L8.4 5.1z" />
    </svg>
  );
}
