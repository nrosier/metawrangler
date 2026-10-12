/**
 * The theme, as React sees it.
 *
 * Two values, because they answer different questions: `mode` is what the person
 * chose (including `system`, which is not a colour), and `resolved` is the colour
 * scheme actually on screen.
 *
 * One honest limitation. `tokens.css` makes the *system* theme correct at first
 * paint with no JavaScript, so the common cases — system-light, system-dark, and an
 * explicit choice that matches the system — never flash. Someone who explicitly
 * chose light on a dark machine does see one frame of dark before this provider
 * mounts. Fixing that needs an inline script, which would require loosening CSP; a
 * frame for the minority who overrode their own system is the better trade.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyMode,
  onSystemThemeChange,
  resolveTheme,
  storedMode,
  type ResolvedTheme,
  type ThemeMode,
} from './theme'

export interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [mode, setMode] = useState<ThemeMode>(storedMode)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(storedMode()))

  // Derived from `mode` during render rather than via setState-in-effect, to
  // avoid the extra cascading render that would otherwise follow every mode
  // change. See https://react.dev/learn/you-might-not-need-an-effect.
  const [prevMode, setPrevMode] = useState(mode)
  if (mode !== prevMode) {
    setPrevMode(mode)
    setResolved(resolveTheme(mode))
  }

  // Applying to the DOM and persisting are genuine external-system effects,
  // so they stay in a plain effect — this one just never calls setState.
  useEffect(() => {
    applyMode(mode)
  }, [mode])

  useEffect(
    () =>
      onSystemThemeChange((theme) => {
        // Only while following the system. An explicit choice outranks it, and
        // repainting on a system change would silently undo that choice.
        if (mode === 'system') setResolved(theme)
      }),
    [mode],
  )

  const change = useCallback((next: ThemeMode) => {
    setMode(next)
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ mode, resolved, setMode: change }),
    [mode, resolved, change],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext)
  if (state === null) throw new Error('useTheme() outside a ThemeProvider')
  return state
}
