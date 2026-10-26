"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { InterestPeriod } from "@/types/media";
import { PERIOD_OPTIONS, periodLabel } from "@/lib/most-interested";

interface PeriodDropdownProps {
  value: InterestPeriod;
  onChange: (period: InterestPeriod) => void;
}

const MENU_WIDTH = 184;
const GAP = 8;

/**
 * Period picker. The listbox is portaled with position: fixed; its top/right are measured
 * from the trigger in useLayoutEffect and it isn't rendered until that position is known.
 */
export function PeriodDropdown({ value, onChange }: PeriodDropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const measure = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // clientWidth excludes the scrollbar, matching how position: fixed resolves "right"
    setPosition({ top: rect.bottom + GAP, right: Math.max(8, document.documentElement.clientWidth - rect.right) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    // Measured before paint so the menu never flashes at a wrong spot
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  // Focus the active option once the list is placed
  useEffect(() => {
    if (open && position) {
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex]?.focus();
    }
  }, [open, position, activeIndex]);

  // Outside click closes
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  const openMenu = () => {
    setActiveIndex(Math.max(0, PERIOD_OPTIONS.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const close = (restoreFocus = true) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const select = (period: InterestPeriod) => {
    onChange(period);
    close();
  };

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    const last = PERIOD_OPTIONS.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i >= last ? 0 : i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? last : i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(last);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(PERIOD_OPTIONS[activeIndex].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu();
          }
        }}
        className="glass-btn relative inline-flex items-center gap-1.5 h-8 pl-3 pr-2.5 rounded-full whitespace-nowrap shrink-0 text-[11px] font-semibold text-zinc-200 bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
      >
        {periodLabel(value)}
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Time period"
            onKeyDown={handleListKeyDown}
            style={{ position: "fixed", top: position.top, right: position.right, width: MENU_WIDTH }}
            className="glass-surface glass-pop-in z-[75] origin-top-right p-1.5 rounded-2xl bg-zinc-900/70 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_16px_48px_rgba(0,0,0,0.55)]"
          >
            {PERIOD_OPTIONS.map((option, index) => {
              const selected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={() => select(option.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer outline-none transition-colors ${
                    index === activeIndex ? "bg-white/10 text-white" : "text-zinc-300"
                  } ${selected ? "font-semibold" : "font-medium"}`}
                >
                  {option.label}
                  {selected && <Check className="w-4 h-4 text-violet-300" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}

export default PeriodDropdown;
