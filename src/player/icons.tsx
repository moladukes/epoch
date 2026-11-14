import type { ReactNode } from "react"

type IconName =
  | "previous"
  | "play"
  | "pause"
  | "stop"
  | "next"
  | "shuffle"
  | "repeat"
  | "compact"
  | "volume"
  | "muted"
  | "eject"
  | "close"
  | "plus"
  | "minus"
  | "sort"
  | "list"

const filled: Partial<Record<IconName, ReactNode>> = {
  previous: (
    <>
      <rect x="3" y="4" width="2.5" height="12" />
      <path d="M17 4v12L7 10z" />
    </>
  ),
  play: <path d="M5.5 3.5v13l11-6.5z" />,
  pause: (
    <>
      <rect x="4.5" y="4" width="4" height="12" />
      <rect x="11.5" y="4" width="4" height="12" />
    </>
  ),
  stop: <rect x="4.5" y="4.5" width="11" height="11" />,
  next: (
    <>
      <rect x="14.5" y="4" width="2.5" height="12" />
      <path d="M3 4v12l10-6z" />
    </>
  ),
  volume: (
    <>
      <path d="M2.5 7.5H6L10.5 4v12L6 12.5H2.5z" />
      <path d="M13 6.6a4.6 4.6 0 0 1 0 6.8l-1-1.1a3.1 3.1 0 0 0 0-4.6zM15.2 4.3a7.8 7.8 0 0 1 0 11.4l-1-1.1a6.3 6.3 0 0 0 0-9.2z" />
    </>
  ),
  eject: (
    <>
      <path d="M10 3.5l6.5 8h-13z" />
      <rect x="3.5" y="13.5" width="13" height="3" />
    </>
  ),
  muted: (
    <>
      <path d="M2.5 7.5H6L10.5 4v12L6 12.5H2.5z" />
      <path d="M12.6 7.1l1.1-1.1 1.9 1.9 1.9-1.9 1.1 1.1-1.9 1.9 1.9 1.9-1.1 1.1-1.9-1.9-1.9 1.9-1.1-1.1 1.9-1.9z" />
    </>
  ),
}

const stroked: Partial<Record<IconName, ReactNode>> = {
  shuffle: (
    <path d="M3 6h2.5l9 8H17M3 14h2.5l2.2-2M11.8 8l2.7-2H17M15 4l2 2-2 2M15 12l2 2-2 2" />
  ),
  repeat: (
    <path d="M4.5 9V7.5a2 2 0 0 1 2-2H16M13.5 3l2.5 2.5L13.5 8M15.5 11v1.5a2 2 0 0 1-2 2H4M6.5 17L4 14.5 6.5 12" />
  ),
  compact: <path d="M5 8l5-4 5 4M5 12l5 4 5-4" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  plus: <path d="M10 4v12M4 10h12" />,
  minus: <path d="M4 10h12" />,
  sort: <path d="M4 5h12M4 10h8M4 15h4" />,
  list: <path d="M3.5 6V15.5h13V7.5H10L8.5 5.5h-5z" />,
}

function Icon({ name }: { name: IconName }) {
  const line = stroked[name]
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill={line ? "none" : "currentColor"}
      stroke={line ? "currentColor" : "none"}
      strokeWidth={line ? 1.8 : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {line ?? filled[name]}
    </svg>
  )
}

export { Icon }
export type { IconName }
