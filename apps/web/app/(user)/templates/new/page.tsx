import { redirect } from "next/navigation";

export default async function NewScenarioPage() {
  redirect("/admin/scenario/attributes");
}
