"use client";

import PageShell from "@/components/PageShell";
import SettingsView from "@/components/SettingsView";

export default function SettingsPage() {
  return (
    <PageShell env="production" activeTab="settings">
      <SettingsView />
    </PageShell>
  );
}
