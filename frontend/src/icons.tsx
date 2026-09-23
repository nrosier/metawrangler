/**
 * The icon set, hand-drawn.
 *
 * Same rationale as the sibling Balancr/Astraya projects: one dependency less to
 * prove doesn't fetch anything, and every glyph inherits `currentColor` so nav
 * highlighting and dark mode need no icon-specific styling at all.
 */
import type { ReactNode } from 'react'

export interface IconProps {
  className?: string
}

const svg = (children: ReactNode, props: IconProps): ReactNode => (
  <svg
    className={props.className}
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

/** Browse — an open folder. */
export const IconFolder = (props: IconProps): ReactNode =>
  svg(
    <path d="M2.5 6.5a1 1 0 0 1 1-1H8l1.5 2h7a1 1 0 0 1 .98 1.2l-1.2 6.2a1 1 0 0 1-.98.8H4.5a1 1 0 0 1-1-1z" />,
    props,
  )

/** Jobs — a list. */
export const IconList = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M7 5.5h10.5M7 10h10.5M7 14.5h10.5" />
      <path d="M2.5 5.5h.01M2.5 10h.01M2.5 14.5h.01" />
    </>,
    props,
  )

/** Settings. */
export const IconSettings = (props: IconProps): ReactNode =>
  svg(
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2M10 15.5v2M3.9 6.5l1.7 1M14.4 12.5l1.7 1M3.9 13.5l1.7-1M14.4 7.5l1.7-1" />
    </>,
    props,
  )

/** Audit log — a clipboard with lines. */
export const IconClipboard = (props: IconProps): ReactNode =>
  svg(
    <>
      <rect x="4" y="3.5" width="12" height="14" rx="1.5" />
      <path d="M7.5 2.5h5a.5.5 0 0 1 .5.5v1.5h-6V3a.5.5 0 0 1 .5-.5Z" />
      <path d="M7 8.5h6M7 11.5h6M7 14.5h4" />
    </>,
    props,
  )

/** Brand mark — a film strip. */
export const IconFilm = (props: IconProps): ReactNode =>
  svg(
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
      <path d="M2.5 7.5h15M2.5 12.5h15M6 4v3.5M6 12.5V16M14 4v3.5M14 12.5V16" />
    </>,
    props,
  )

export const IconChevronRight = (props: IconProps): ReactNode =>
  svg(<path d="M7.5 4.5 13 10l-5.5 5.5" />, props)

export const IconChevronLeft = (props: IconProps): ReactNode =>
  svg(<path d="M12.5 4.5 7 10l5.5 5.5" />, props)

export const IconSearch = (props: IconProps): ReactNode =>
  svg(
    <>
      <circle cx="8.7" cy="8.7" r="5.2" />
      <path d="M16.5 16.5 13 13" />
    </>,
    props,
  )

/** Tri-state checkbox: unchecked box, an interior tick, or an interior dash. */
export function IconCheckbox({
  state,
  ...props
}: IconProps & { state: 'checked' | 'indeterminate' | 'unchecked' }): ReactNode {
  return svg(
    <>
      <rect x="3" y="3" width="14" height="14" rx="3" />
      {state === 'checked' && <path d="M6.5 10.2 9 12.7l4.5-5.4" />}
      {state === 'indeterminate' && <path d="M6.5 10h7" />}
    </>,
    props,
  )
}

export const IconPencil = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M12.6 3.4a1.7 1.7 0 0 1 2.4 2.4L6.5 14.3l-3 .7.7-3Z" />
      <path d="M11.3 4.7l2.4 2.4" />
    </>,
    props,
  )

export const IconRefresh = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M4 10a6 6 0 0 1 10.2-4.2M16 10a6 6 0 0 1-10.2 4.2" />
      <path d="M14.2 3v3h-3M5.8 17v-3h3" />
    </>,
    props,
  )

export const IconAlertCircle = (props: IconProps): ReactNode =>
  svg(
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v4.5" />
      <path d="M10 13.7h.01" />
    </>,
    props,
  )

export const IconAlertTriangle = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M10 3.2 17.5 16h-15Z" />
      <path d="M10 8.3v3.7" />
      <path d="M10 14.5h.01" />
    </>,
    props,
  )

export const IconCheckCircle = (props: IconProps): ReactNode =>
  svg(
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M6.8 10.2 9 12.4l4.2-5" />
    </>,
    props,
  )

export const IconXCircle = (props: IconProps): ReactNode =>
  svg(
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7.8 7.8l4.4 4.4M12.2 7.8l-4.4 4.4" />
    </>,
    props,
  )

export const IconClock = (props: IconProps): ReactNode =>
  svg(
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5V10l2.8 1.6" />
    </>,
    props,
  )

export const IconSkipForward = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M5 5v10l7-5Z" />
      <path d="M15 5v10" />
    </>,
    props,
  )

/** Dry run — a flask. */
export const IconFlask = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M8 3h4M8.5 3v4.3L4.8 14a1.6 1.6 0 0 0 1.4 2.4h7.6a1.6 1.6 0 0 0 1.4-2.4l-3.7-6.7V3" />
      <path d="M6.7 12.2h6.6" />
    </>,
    props,
  )

/** A mount's health — a hard drive. */
export const IconHardDrive = (props: IconProps): ReactNode =>
  svg(
    <>
      <rect x="2.5" y="7" width="15" height="9" rx="1.5" />
      <path d="M2.5 12.5h15" />
      <path d="M5.5 14.5h.01M9 14.5h.01" />
      <path d="M6 7 8.3 3.5h3.4L14 7" />
    </>,
    props,
  )

/** Loading — pair with the `.spin` utility class. */
export const IconLoader = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M10 3v3" />
      <path d="M10 14v3" strokeOpacity="0.35" />
      <path d="M4.5 10h3" strokeOpacity="0.7" />
      <path d="M12.5 10h3" strokeOpacity="0.5" />
      <path d="M6.05 6.05l2.1 2.1" strokeOpacity="0.85" />
      <path d="M11.85 11.85l2.1 2.1" strokeOpacity="0.2" />
      <path d="M6.05 13.95l2.1-2.1" strokeOpacity="0.6" />
      <path d="M11.85 8.15l2.1-2.1" />
    </>,
    props,
  )

export const IconPlus = (props: IconProps): ReactNode =>
  svg(<path d="M10 4v12M4 10h12" />, props)

export const IconTrash = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M4 6h12" />
      <path d="M7.5 6V4.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
      <path d="M5.5 6 6.3 16a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9L14.5 6" />
      <path d="M8.5 9v5M11.5 9v5" />
    </>,
    props,
  )

/** Undo. */
export const IconRotateCcw = (props: IconProps): ReactNode =>
  svg(
    <>
      <path d="M4.5 10a5.5 5.5 0 1 0 1.9-4.15" />
      <path d="M4 3.5v3h3" />
    </>,
    props,
  )

/** Follow the system. */
export const IconSystem = (props: IconProps): ReactNode =>
  svg(
    <>
      <rect x="2.5" y="4" width="15" height="9.5" rx="1.5" />
      <path d="M7 17h6" />
    </>,
    props,
  )

export const IconLight = (props: IconProps): ReactNode =>
  svg(
    <>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2v1.6M10 16.4V18M2 10h1.6M16.4 10H18M4.5 4.5l1.1 1.1M14.4 14.4l1.1 1.1M4.5 15.5l1.1-1.1M14.4 5.6l1.1-1.1" />
    </>,
    props,
  )

export const IconDark = (props: IconProps): ReactNode =>
  svg(<path d="M15.5 12.6A6.2 6.2 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1Z" />, props)
