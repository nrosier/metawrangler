/**
 * The frame every page renders inside.
 *
 * A skip link is the first thing in the tab order, so a keyboard user is not made to
 * walk past the nav on every page. It is visually parked off-screen and slides in on
 * `:focus-visible`.
 *
 * The header and the navigation are the same markup at every width; only
 * `shell.css` differs, so the two layouts cannot disagree about which page is
 * current.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconFilm } from '../icons'
import { Nav } from './Nav'
import { ThemeToggle } from './ThemeToggle'
import './shell.css'

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps): ReactNode {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="header">
        <div className="header__lead">
          <Link to="/" className="brand">
            <IconFilm className="brand__mark" />
            <span className="brand__name">MetaWrangler</span>
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <Nav />

      <main id="main" className="main">
        {children}
      </main>
    </div>
  )
}
