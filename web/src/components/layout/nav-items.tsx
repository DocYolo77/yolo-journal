import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// Beta scope: these five workflows are wired up end-to-end (Weekly
// Review joined the P0 set once its aggregation/report/PDF/JSON layer
// shipped). Monthly Review, Rules & Timeline, and Google Drive Export
// remain P1 (post-Beta) — their routes still exist as placeholders but
// are intentionally not linked from nav until they're real, per the
// "funktional > schön" beta instruction (hidden rather than shown as
// dead "coming later" links). Pre-Market Commitment is the first-class
// home workflow, hence href "/". See
// LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §1 for the full legacy nav this
// will grow back into after the Beta.
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Pre-Market Commitment",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 3v2h6V3" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/shadowlist",
    label: "Shadowlist",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M2 12c2.5-4.5 6-6.5 10-6.5s7.5 2 10 6.5c-2.5 4.5-6 6.5-10 6.5S4.5 16.5 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: "/ibkr-import",
    label: "IBKR Import",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 3v12" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 19h14" />
      </svg>
    ),
  },
  {
    href: "/daily-review",
    label: "Daily Review",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 3v3M16 3v3" />
      </svg>
    ),
  },
  {
    href: "/weekly-review",
    label: "Weekly Review",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 3v3M16 3v3" />
        <path d="M7 14h3M14 14h3M7 17h3" />
      </svg>
    ),
  },
  {
    href: "/archive",
    label: "Archiv",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="4" width="18" height="5" rx="1" />
        <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
        <path d="M10 13h4" />
      </svg>
    ),
  },
  {
    href: "/lessons-learned",
    label: "Lessons Learned",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        <path d="M9 7h7M9 11h5" />
      </svg>
    ),
  },
];

// P1 — not linked in the Beta nav, routes still exist as placeholders.
// href kept here (not in NAV_ITEMS) so a future phase can re-add them
// without redesigning this file.
export const COMING_LATER_ROUTES = ["/monthly-review", "/rules-timeline", "/drive-export"];

// Crypto journal — a deliberately separate, much lighter section (no
// daily Pre-Market Commitment/Lock/Shadowlist workflow applies here, see
// lib/data/crypto-trades.ts's own header comment). Rendered as its own
// labeled group below a divider at the bottom of the sidebar, not mixed
// into the stock-journal NAV_ITEMS above.
export const CRYPTO_NAV_GROUP_LABEL = "Cryptotrades";

export const CRYPTO_NAV_ITEMS: NavItem[] = [
  {
    href: "/crypto",
    label: "Trades",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M14 8h6v6" />
      </svg>
    ),
  },
  {
    href: "/crypto/learnings",
    label: "Learnings",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        <path d="M9 7h7M9 11h5" />
      </svg>
    ),
  },
  {
    href: "/crypto/weekly-review",
    label: "Weekly Review",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 3v3M16 3v3" />
        <path d="M7 14h3M14 14h3M7 17h3" />
      </svg>
    ),
  },
];
