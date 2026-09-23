import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/shell/AppShell";
import { BrowsePage } from "@/pages/Browse";
import { BulkEditPage } from "@/pages/BulkEdit";
import { JobsPage } from "@/pages/Jobs";
import { JobDetailPage } from "@/pages/JobDetail";
import { SettingsPage } from "@/pages/Settings";
import { AuditLogPage } from "@/pages/AuditLog";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<BrowsePage />} />
        <Route path="/bulk-edit" element={<BulkEditPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
      </Routes>
    </AppShell>
  );
}
