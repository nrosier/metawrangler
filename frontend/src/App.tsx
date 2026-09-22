import { Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { BrowsePage } from "@/pages/Browse";
import { BulkEditPage } from "@/pages/BulkEdit";
import { JobsPage } from "@/pages/Jobs";
import { JobDetailPage } from "@/pages/JobDetail";
import { SettingsPage } from "@/pages/Settings";
import { AuditLogPage } from "@/pages/AuditLog";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<BrowsePage />} />
          <Route path="/bulk-edit" element={<BulkEditPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
        </Routes>
      </main>
    </div>
  );
}
