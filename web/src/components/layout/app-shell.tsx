"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CRYPTO_NAV_GROUP_LABEL, CRYPTO_NAV_ITEMS, NAV_ITEMS } from "./nav-items";
import { logoutAction } from "@/app/login/actions";

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-xs text-muted-foreground hover:text-negative">
        Abmelden
      </button>
    </form>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinkRow({
  item,
  pathname,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-surface-hover text-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      <span className={active ? "text-accent" : ""}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
      {NAV_ITEMS.map((item) => (
        <NavLinkRow key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}

      {/* Bottom-left group, separated by a divider — deliberately kept
          apart from the stock-journal items above since Crypto is a
          functionally separate, much lighter section. */}
      <div className="mt-auto border-t border-border pt-3">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {CRYPTO_NAV_GROUP_LABEL}
        </p>
        {CRYPTO_NAV_ITEMS.map((item) => (
          <NavLinkRow key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const activeLabel =
    [...NAV_ITEMS, ...CRYPTO_NAV_ITEMS].find((item) => isActive(pathname, item.href))?.label ??
    "yolo-journal";

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-sm font-semibold tracking-wide text-foreground">
            yolo<span className="text-accent">journal</span>
          </span>
        </div>
        <NavLinks pathname={pathname} />
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>Single-User V1</span>
          <LogoutButton />
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Navigation schließen"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-semibold tracking-wide text-foreground">
                yolo<span className="text-accent">journal</span>
              </span>
              <button
                type="button"
                aria-label="Navigation schließen"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setMobileNavOpen(false)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <NavLinks
              pathname={pathname}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-6">
          <button
            type="button"
            aria-label="Navigation öffnen"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-medium text-foreground">
            {activeLabel}
          </span>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
