/**
 * Shows the running frontend and backend versions so a stale deploy (e.g. a
 * cached frontend talking to a newer backend) is easy to spot.
 */
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function VersionFooter(): ReactNode {
  const { data, isError } = useQuery({
    queryKey: ['version'],
    queryFn: api.version,
    staleTime: Infinity,
    retry: false,
  })

  const frontend = `v${__APP_VERSION__} (${__APP_COMMIT__})`
  const backend = data
    ? `v${data.version} (${data.commit})`
    : isError
      ? 'unavailable'
      : '…'
  const title = `Frontend built ${__APP_BUILD_TIME__}` + (data ? `\nBackend built ${data.buildTime}` : '')

  return (
    <footer
      title={title}
      style={{
        marginTop: 'var(--space-6)',
        fontSize: 'var(--type-sm)',
        color: 'var(--text-muted, var(--text))',
        opacity: 0.7,
      }}
    >
      MetaWrangler · frontend {frontend} · backend {backend}
    </footer>
  )
}
