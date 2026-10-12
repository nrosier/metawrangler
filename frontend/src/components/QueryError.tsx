/**
 * Shared "this query failed" state — distinct from both loading and a
 * genuinely empty result (UX-02). Pages previously destructured only
 * `data`/`isLoading` from useQuery, so a failed fetch (auth, backend, proxy,
 * or filesystem error) rendered identically to "no items" or hung on a
 * permanent loading spinner, pushing users to debug the wrong layer.
 */
import { IconAlertCircle, IconRefresh } from "@/icons";

interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function QueryError({ error, onRetry }: QueryErrorProps) {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  return (
    <div className="card stack" style={{ alignItems: "flex-start" }}>
      <p className="toolbar" style={{ gap: "var(--space-2)", color: "var(--negative)" }}>
        <IconAlertCircle /> {message}
      </p>
      <button className="button button--quiet" onClick={onRetry}>
        <IconRefresh /> Retry
      </button>
    </div>
  );
}
