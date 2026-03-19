"use client";

import { Suspense } from "react";
import HypeshipDashboard from "@/components/HypeshipDashboard";

export default function HomePage() {
  return (
    <Suspense>
      <HypeshipDashboard env="production" />
    </Suspense>
  );
}
