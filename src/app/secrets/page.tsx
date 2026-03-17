"use client";

import PageShell from "@/components/PageShell";
import SecretsView from "@/components/SecretsView";

export default function SecretsPage() {
  return (
    <PageShell env="production" activeTab="secrets">
      <SecretsView />
    </PageShell>
  );
}
