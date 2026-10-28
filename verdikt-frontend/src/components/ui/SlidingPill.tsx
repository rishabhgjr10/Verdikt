"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Sliding-pill helper: measures a row of items so a pill can glide to the hovered/active one.
 * Attach `track` to the row container (must be positioned), `item(i)` to each item, and
 * render <GlidePill> children before the items.
 */
export function useGlider<T extends HTMLElement>() {
  const track = useRef<T>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const [rects, setRects] = useState<({ x: number; y: number; w: number; h: number } | undefined)[]>([]);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    const measure = () => {
      setRects(Array.from(items.current, (n) => (n ? { x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight } : undefined)));
      // Items resizing on their own (e.g. a label expanding) must re-measure too
      items.current.forEach((n) => n && ro.observe(n));
      // Skip the transition on first paint so pills don't slide in from x=0
      requestAnimationFrame(() => setReady(true));
    };
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const item = (i: number) => (n: HTMLElement | null) => {
    items.current[i] = n;
  };
  return { track, item, rects, ready, hover, setHover };
}

export function GlidePill({
  glide,
  index,
  className,
  box = false,
}: {
  glide: { rects: ({ x: number; y: number; w: number; h: number } | undefined)[]; ready: boolean };
  index: number | null;
  className: string;
  /** Also track the item's vertical position and height (vertical or wrapping lists). */
  box?: boolean;
}) {
  const rect = index === null ? undefined : glide.rects[index];
  return (
    <span
      aria-hidden="true"
      className={`glide-pill pointer-events-none absolute left-0 ${box ? "top-0" : ""} rounded-full ${className}`}
      style={{
        width: rect?.w ?? 0,
        ...(box && { height: rect?.h ?? 0 }),
        transform: `translate(${rect?.x ?? 0}px, ${box ? (rect?.y ?? 0) : 0}px)`,
        opacity: rect ? 1 : 0,
        // Transitions live in navbar.css (.glide-pill); none on first paint so pills do not slide in from x=0
        ...(!glide.ready && { transition: "none" }),
      }}
    />
  );
}

export interface SlidingPillItem {
  label: string;
  value: string;
  href?: string;
  icon?: React.ElementType;
}

type Variant = "nav" | "tabs" | "filter";

const ACTIVE_STRONG =
  "bg-gradient-to-r from-violet-600/90 to-purple-600/90 border border-purple-400/40 shadow-[0_0_20px_rgba(139,92,246,0.35)]";
const ACTIVE_SOFT = "bg-violet-500/20 border border-violet-400/30 shadow-[0_0_14px_rgba(139,92,246,0.25)]";

const VARIANTS: Record<Variant, { track: string; item: (active: boolean) => string; hover: string; active: string; box: boolean }> = {
  // Navbar categories: sizing and colors live in navbar.css (.shared-categories / .shared-category)
  nav: {
    track: "shared-categories",
    item: () => "shared-category cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
    hover: "inset-y-0.5 bg-white/[0.08] backdrop-blur-md",
    active: `inset-y-0.5 ${ACTIVE_SOFT}`,
    box: false,
  },
  tabs: {
    track: "relative flex gap-1 overflow-x-auto [scrollbar-width:none]",
    item: (active) =>
      `relative z-10 flex flex-shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm whitespace-nowrap cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-colors duration-200 ${
        active ? "text-white font-semibold" : "text-zinc-400 hover:text-white font-medium"
      }`,
    hover: "bg-white/[0.06] border border-white/[0.08]",
    active: ACTIVE_STRONG,
    box: true,
  },
  filter: {
    track: "relative flex items-center gap-1 overflow-x-auto [scrollbar-width:none]",
    item: (active) =>
      `relative z-10 flex-shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-colors duration-200 ${
        active ? "text-white font-semibold" : "text-zinc-300/90 hover:text-white font-medium"
      }`,
    hover: "bg-white/[0.08] border border-white/[0.12]",
    active: ACTIVE_SOFT,
    box: true,
  },
};

/**
 * Row of tabs/filters with a hover pill and an active pill that glide between items.
 * Links (`href`) navigate; buttons report clicks through `onChange`. Only the visual layer:
 * selection state stays with the caller via `activeValue`.
 */
export function SlidingPill({
  items,
  activeValue,
  onChange,
  variant = "tabs",
  as: Tag = "div",
  ariaLabel,
  className = "",
  tabIdPrefix,
}: {
  items: SlidingPillItem[];
  activeValue: string | null | undefined;
  onChange?: (value: string) => void;
  variant?: Variant;
  as?: "div" | "nav";
  ariaLabel?: string;
  /** Extra track classes, e.g. a vertical layout at some breakpoint. */
  className?: string;
  /** Button rows act as ARIA tabs with ids `${prefix}-${value}` controlling `${prefix}-${value}-panel`. */
  tabIdPrefix?: string;
}) {
  const v = VARIANTS[variant];
  const { track, item, ...glide } = useGlider<HTMLDivElement>();
  const activeIndex = items.findIndex((i) => i.value === activeValue);
  const isTabs = items.some((i) => !i.href);

  return (
    <Tag
      ref={track}
      role={isTabs && Tag === "div" ? "tablist" : undefined}
      aria-label={ariaLabel}
      className={`${v.track} ${className}`}
      onMouseLeave={() => glide.setHover(null)}
    >
      <GlidePill box={v.box} glide={glide} index={glide.hover} className={v.hover} />
      <GlidePill box={v.box} glide={glide} index={activeIndex >= 0 ? activeIndex : null} className={v.active} />
      {items.map(({ label, value, href, icon: Icon }, i) => {
        const active = value === activeValue;
        const content = (
          <>
            {Icon && <Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
            {label}
          </>
        );
        return href ? (
          <Link
            key={value}
            ref={item(i)}
            href={href}
            onMouseEnter={() => glide.setHover(i)}
            onClick={() => onChange?.(value)}
            className={v.item(active)}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        ) : (
          <button
            key={value}
            ref={item(i)}
            type="button"
            role="tab"
            id={tabIdPrefix ? `${tabIdPrefix}-${value}` : undefined}
            aria-controls={tabIdPrefix ? `${tabIdPrefix}-${value}-panel` : undefined}
            aria-selected={active}
            onMouseEnter={() => glide.setHover(i)}
            onClick={() => onChange?.(value)}
            className={v.item(active)}
          >
            {content}
          </button>
        );
      })}
    </Tag>
  );
}
