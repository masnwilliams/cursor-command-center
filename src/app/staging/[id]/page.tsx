"use client";

import { use } from "react";
import HypeshipDashboard from "@/components/HypeshipDashboard";

export default function HypeshipStagingAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <HypeshipDashboard env="staging" initialAgentId={id} />;
}
