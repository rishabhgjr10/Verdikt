"use client";

import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export type GlassVariant = "primary" | "neutral" | "active" | "danger";

const BASE_SHADOW =
  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]";

const VARIANTS: Record<GlassVariant, string> = {
  primary:
    "bg-violet-500/35 hover:bg-violet-500/45 text-white border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35),0_0_28px_rgba(139,92,246,0.35)]",
  neutral: `bg-white/10 hover:bg-white/15 text-white border-white/20 ${BASE_SHADOW}`,
  active:
    "bg-emerald-500/80 hover:bg-emerald-500/90 text-white border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35),0_0_24px_rgba(16,185,129,0.35)]",
  danger: `bg-red-500/15 hover:bg-red-500/25 text-red-300 border-red-400/25 ${BASE_SHADOW}`,
};

/**
 * Media hero recipe: one shape (h-12, rounded-2xl) for every hero button, a single
 * bright primary with the only violet glow, and calmer glass for everything else.
 */
const HERO_VARIANTS: Record<GlassVariant, string> = {
  // Deep violet glass; the glow sits on the text so the box keeps its inset highlight
  primary:
    "bg-violet-900/60 hover:bg-violet-800/80 backdrop-blur-md border-violet-500/30 text-white font-semibold tracking-wide [text-shadow:0_0_10px_rgba(167,139,250,0.6)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_8px_16px_rgba(0,0,0,0.4)]",
  neutral:
    "bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-lg border-white/[0.12] text-zinc-200 hover:text-white transition-colors font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
  active:
    "bg-emerald-500/80 hover:bg-emerald-500/90 text-white border-white/20 font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_8px_24px_rgba(0,0,0,0.35)]",
  danger: `bg-red-500/15 hover:bg-red-500/25 text-red-300 border-red-400/25 font-semibold ${BASE_SHADOW}`,
};

interface CommonProps {
  variant?: GlassVariant;
  /** "hero" = media detail hero recipe (h-12, rounded-2xl). Default keeps the original pill. */
  size?: "md" | "hero";
  /** Full-width stacked button: rounded-2xl instead of a pill. */
  block?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    ref?: React.Ref<HTMLButtonElement>;
  };

type LinkProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    href: string;
    ref?: React.Ref<HTMLAnchorElement>;
  };

export type GlassButtonProps = ButtonProps | LinkProps;

export function glassButtonClasses(
  variant: GlassVariant = "neutral",
  block = false,
  extra = "",
  size: "md" | "hero" = "md"
) {
  const hero = size === "hero";
  return [
    "glass-btn relative isolate inline-flex items-center justify-center overflow-hidden",
    hero ? "gap-[var(--gb-gap,8px)]" : "gap-2",
    // Hero padding/gap come from CSS variables so a caller can tighten them without class conflicts
    hero ? "h-12 px-[var(--gb-px,20px)] [&_svg]:size-[18px] [&_svg]:shrink-0" : "h-11 px-5",
    // Hero variants set their own weight (primary semibold, neutral medium)
    hero ? "" : "font-semibold",
    "text-sm whitespace-nowrap select-none border cursor-pointer",
    "transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
    "outline-none focus-visible:ring-2 focus-visible:ring-white/40",
    hero ? "rounded-2xl" : block ? "rounded-2xl" : "rounded-full",
    block ? "w-full" : "",
    hero ? HERO_VARIANTS[variant] : VARIANTS[variant],
    extra,
  ].join(" ");
}

/** Shared glass button; renders a <Link> when `href` is set, otherwise a <button>. */
export function GlassButton(props: GlassButtonProps) {
  const { variant = "neutral", size = "md", block = false, loading = false, icon, className = "", children, ...rest } = props;
  const classes = glassButtonClasses(variant, block, className, size);
  const content = (
    <>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, ref, ...anchorProps } = rest as Omit<LinkProps, keyof CommonProps>;
    return (
      <Link href={href} ref={ref} className={classes} {...anchorProps}>
        {content}
      </Link>
    );
  }

  const { ref, type = "button", disabled, ...buttonProps } = rest as Omit<ButtonProps, keyof CommonProps>;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...buttonProps}
    >
      {content}
    </button>
  );
}

export default GlassButton;
