/**
 * The section navigation — one `<nav>`, styled into a bottom tab bar or a sidebar by
 * the viewport (see `shell.css`).
 *
 * One element in one place in the DOM, not two hidden behind media queries: a second
 * copy would double the tab stops on the wide layout. `NavLink` sets
 * `aria-current="page"` on the active link itself, which is also what the stylesheet
 * keys off, so the highlight and the announcement can never disagree.
 */
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { IconClipboard, IconFolder, IconList, IconSettings, type IconProps } from '../icons'

const ROUTES: Array<{ to: string; label: string; Icon: (props: IconProps) => ReactNode }> = [
  { to: '/', label: 'Browse', Icon: IconFolder },
  { to: '/jobs', label: 'Jobs', Icon: IconList },
  { to: '/audit', label: 'Audit Log', Icon: IconClipboard },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

export function Nav(): ReactNode {
  return (
    <nav className="nav" aria-label="Sections">
      {ROUTES.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className="nav__link" end={to === '/'}>
          <Icon />
          <span className="nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
