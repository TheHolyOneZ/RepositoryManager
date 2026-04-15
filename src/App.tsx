import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useSessionSync } from "./hooks/useSessionSync";
import { AuthPage } from "./routes/auth/AuthPage";
import { ReposPage } from "./routes/repos/ReposPage";
import { QueuePage } from "./routes/queue/QueuePage";
import { AnalyticsPage } from "./routes/analytics/AnalyticsPage";
import { SuggestionsPage } from "./routes/suggestions/SuggestionsPage";
import { ActionsPage } from "./routes/actions/ActionsPage";
import { WebhooksPage } from "./routes/webhooks/WebhooksPage";
import { CollaboratorsPage } from "./routes/collaborators/CollaboratorsPage";
import { BranchesPage } from "./routes/branches/BranchesPage";
import { SchedulerPage } from "./routes/scheduler/SchedulerPage";
import { MigrationPage } from "./routes/migration/MigrationPage";
import { ScannerPage } from "./routes/scanner/ScannerPage";
import { SettingsPage } from "./routes/settings/SettingsPage";
import { AboutPage } from "./routes/about/AboutPage";
import { UploadPage } from "./routes/upload/UploadPage";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { useAccountStore } from "./stores/accountStore";

function App() {
  const sessionReady = useSessionSync();
  const hasAccount = useAccountStore((s) => s.accounts.length > 0);

  if (!sessionReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#06080F] px-6 text-center">
        <div
          className="h-8 w-8 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.35), rgba(6,182,212,0.20))",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <p className="text-[0.875rem] font-semibold text-[#C8CDD8]">Restoring session…</p>
        <p className="max-w-xs text-[0.75rem] leading-relaxed text-[#4A5166]">
          Connecting to the local sign-in store. If you just restarted the app, add a token again in Settings when prompted.
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {hasAccount ? (
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/repos" replace />} />
              <Route path="/repos" element={<ReposPage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/actions" element={<ActionsPage />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
              <Route path="/collaborators" element={<CollaboratorsPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/scheduler" element={<SchedulerPage />} />
              <Route path="/migration" element={<MigrationPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<Navigate to="/repos" replace />} />
            </Route>
          ) : (
            <Route path="*" element={<AuthPage />} />
          )}
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
