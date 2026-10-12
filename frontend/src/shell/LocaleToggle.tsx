/**
 * Locale toggle — switch between English and Spanish
 * Persists selection to localStorage
 */
import { useLocale } from "@/i18n";

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as "en" | "es")}
      aria-label="Select language"
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface-card)",
        color: "var(--text)",
        fontSize: "var(--type-sm)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}
