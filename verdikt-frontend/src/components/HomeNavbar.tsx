"use client";

import { Navbar, NavMediaCategory } from "./Navbar";

export function HomeNavbar({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory?: NavMediaCategory;
  onSelectCategory?: (cat: NavMediaCategory) => void;
}) {
  return (
    <Navbar
      selectedCategory={selectedCategory}
      onSelectCategory={onSelectCategory}
    />
  );
}
