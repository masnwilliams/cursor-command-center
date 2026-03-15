"use client";

import { use } from "react";
import HypeshipDashboard from "@/components/HypeshipDashboard";

export default function HypeshipAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <HypeshipDashboard env="production" initialAgentId={id} />;
}
