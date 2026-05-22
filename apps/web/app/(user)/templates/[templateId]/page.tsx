import { redirect } from "next/navigation";

export default async function ScenarioEditPage() {
  redirect("/admin/scenario/attributes");
}
