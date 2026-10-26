"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";

const AUTH_ROUTES = ["/login", "/register", "/signup"];

export function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  return (
    <>
      {!isAuthRoute && <Navbar />}
      <div
        className={
          isAuthRoute
            ? "relative z-10 min-h-dvh w-full overflow-hidden"
            : "relative z-10 flex min-h-screen flex-col"
        }
        style={isAuthRoute ? undefined : { paddingTop: "7rem" }}
      >
        {children}
      </div>
    </>
  );
}

export default NavbarWrapper;
