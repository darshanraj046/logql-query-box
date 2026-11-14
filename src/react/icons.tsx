import type { ReactNode } from 'react'

export const FIELD_ICONS: Record<string, ReactNode> = {
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  warn: <path d="M12 4l9 16H3zM12 10v4M12 17.2v.1" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.1" />
    </>
  ),
  terminal: <path d="M5 8l4 4-4 4M12 17h7" />,
  pulse: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  asterisk: <path d="M12 4v16M5 8l14 8M19 8L5 16" />,
  bars: <path d="M5 20v-6M12 20V6M19 20v-10" />,
  cube: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  code: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  lines: <path d="M4 7h16M4 12h16M4 17h10" />,
  trace: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="M8 5h5a3 3 0 010 6h-2a3 3 0 000 6h5" />
    </>
  ),
  span: (
    <>
      <rect x="3" y="4" width="10" height="4" rx="1" />
      <rect x="8" y="10" width="13" height="4" rx="1" />
      <rect x="5" y="16" width="9" height="4" rx="1" />
    </>
  )
}
