"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/**
 * Adds "Connect" to the main page's nav (app/page.tsx renders <nav className="nav">).
 * Kept as a small wrapper so the large home page file is untouched.
 */
export function ConnectNavLink() {
  const pathname = usePathname();
  const [nav, setNav] = useState<Element | null>(null);

  useEffect(() => {
    if (pathname !== "/") { setNav(null); return; }
    const find = () => {
      const el = document.querySelector("header .nav");
      setNav((prev) => (prev === el ? prev : el));
    };
    find();
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [pathname]);

  if (!nav) return null;
  return createPortal(
    <a className="nav-btn" href="/connect" style={{ textDecoration: "none" }}>
      Connect
    </a>,
    nav
  );
}
