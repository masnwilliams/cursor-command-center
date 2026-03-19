"use client";

import { Suspense } from "react";
import HypeshipDashboard from "@/components/HypeshipDashboard";

export default function HypeshipStagingPage() {
  return (
    <Suspense>
      <HypeshipDashboard env="staging" />
    </Suspense>
  );
}
