"use client";

import PageShell from "@/components/PageShell";
import SecretsView from "@/components/SecretsView";

export default function StagingSecretsPage() {
  return (
    <PageShell env="staging" activeTab="secrets">
      <SecretsView />
    </PageShell>
  );
}
