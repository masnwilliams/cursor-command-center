"use client";

import PageShell from "@/components/PageShell";
import SettingsView from "@/components/SettingsView";

export default function StagingSettingsPage() {
  return (
    <PageShell env="staging" activeTab="settings">
      <SettingsView />
    </PageShell>
  );
}
