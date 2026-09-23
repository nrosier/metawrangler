/**
 * System / light / dark, as three buttons rather than a two-state switch.
 *
 * A switch cannot express "follow the system", and following the system is the
 * default most people want. Icons carry an `aria-label`/`title` each, so nothing is
 * lost to a screen reader or a hover.
 */
import type { ReactNode } from 'react'
import { IconDark, IconLight, IconSystem, type IconProps } from '../icons'
import { THEME_MODES, type ThemeMode } from '../theme/theme'
import { useTheme } from '../theme/ThemeContext'

const ICONS: Record<ThemeMode, (props: IconProps) => ReactNode> = {
  system: IconSystem,
  light: IconLight,
  dark: IconDark,
}

const LABELS: Record<ThemeMode, string> = {
  system: 'Match system theme',
  light: 'Light theme',
  dark: 'Dark theme',
}

export function ThemeToggle(): ReactNode {
  const { mode, setMode } = useTheme()

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {THEME_MODES.map((option) => {
        const Icon = ICONS[option]
        const label = LABELS[option]
        return (
          <button
            key={option}
            type="button"
            className="theme-toggle__option"
            aria-pressed={mode === option}
            aria-label={label}
            title={label}
            onClick={() => {
              setMode(option)
            }}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
