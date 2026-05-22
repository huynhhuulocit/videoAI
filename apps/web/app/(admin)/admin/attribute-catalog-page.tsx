import type { AttributeCatalogType } from "@videoai/contracts";
import { redirect } from "next/navigation";
import {
  AttributeCatalogEditor,
  AttributeCatalogList,
} from "../../../components/admin/attribute-catalog-manager";
import { DashboardShell } from "../../../components/shell/dashboard-shell";
import { auth } from "../../../lib/auth/auth";

const copy = {
  story: {
    title: "Story Attribute",
    description: "Manage Story attribute catalogs used by Step 1 Story Content generation.",
  },
  scenario: {
    title: "Scenario Attribute",
    description: "Manage Scenario attribute catalogs used by Step 2 Scenario analysis.",
  },
  shots: {
    title: "Shots Attribute",
    description: "Manage Shots attribute catalogs used by Step 3 shot generation.",
  },
} satisfies Record<AttributeCatalogType, { title: string; description: string }>;

async function requireAdmin() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }
}

export async function renderAttributeCatalogPage(type: AttributeCatalogType) {
  await requireAdmin();
  const page = copy[type];
  return (
    <DashboardShell
      role="admin"
      title={page.title}
      description={page.description}
      backHref="/admin/ai-config"
    >
      <AttributeCatalogList
        type={type}
        title={`${page.title} catalogs`}
        description={page.description}
      />
    </DashboardShell>
  );
}

export async function renderAttributeCatalogEditorPage(type: AttributeCatalogType, catalogId?: string) {
  await requireAdmin();
  const page = copy[type];
  return (
    <DashboardShell
      role="admin"
      title={page.title}
      description={page.description}
      backHref={`/admin/${type}/attributes`}
    >
      <AttributeCatalogEditor
        type={type}
        title={`${page.title} catalog editor`}
        description={page.description}
        catalogId={catalogId}
      />
    </DashboardShell>
  );
}
