"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ShotsManagerProps = {
  mode?: "create" | "edit" | "manage";
  shotPlanId?: string;
};

export function ShotsManager(_props: ShotsManagerProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projects");
  }, [router]);

  return null;
}
