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

// Matches the legacy Journal OS V7.4.3 top-level sections exactly — see
// LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §1. Pre-Market Commitment is the
// first-class home workflow, hence href "/".
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
        <path d="M7 13h3M14 13h3M7 17h3" />
      </svg>
    ),
  },
  {
    href: "/monthly-review",
    label: "Monthly Review",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M4 19V9l5-3 5 3 5-3v10l-5 3-5-3-5 3Z" />
        <path d="M9 6v10M14 9v10" />
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
    href: "/rules-timeline",
    label: "Rules & Timeline",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M4 4v16" />
        <circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="17" r="1.5" fill="currentColor" stroke="none" />
        <path d="M9 7h11M9 12h11M9 17h11" />
      </svg>
    ),
  },
  {
    href: "/drive-export",
    label: "Google Drive Export",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M8 3h8l6 10-4 7H6l-4-7Z" />
        <path d="M8 3l6 10M10 20l4-7" />
      </svg>
    ),
  },
];
