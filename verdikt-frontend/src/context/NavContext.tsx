"use client";

import React, { createContext, useContext, useState } from "react";
import { NavMediaCategory } from "@/components/Navbar";

export type { NavMediaCategory };

interface NavContextType {
  activeCategory: NavMediaCategory | null;
  setActiveCategory: (cat: NavMediaCategory | null) => void;
}

const NavContext = createContext<NavContextType>({
  activeCategory: null,
  setActiveCategory: () => {},
});

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<NavMediaCategory | null>(null);

  return (
    <NavContext.Provider value={{ activeCategory, setActiveCategory }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  return useContext(NavContext);
}
