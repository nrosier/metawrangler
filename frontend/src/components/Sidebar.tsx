import { NavLink, useLocation } from "react-router-dom";
import { FolderOpen, List, Settings, ClipboardList, Film } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Browse", icon: FolderOpen, end: true },
  { to: "/jobs", label: "Jobs", icon: List },
  { to: "/audit", label: "Audit Log", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-52 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Film size={18} className="text-accent" />
          <span className="font-semibold text-base tracking-tight">MetaWrangler</span>
        </div>
        <p className="text-xs text-muted mt-0.5">MKV metadata editor</p>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors",
                isActive
                  ? "bg-accent text-white font-medium"
                  : "text-gray-700 hover:bg-gray-200"
              )
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border text-xs text-muted">
        v1.0.0
      </div>
    </aside>
  );
}
