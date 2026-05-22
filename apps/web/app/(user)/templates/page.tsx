import { redirect } from "next/navigation";

export default async function TemplatesPage() {
  redirect("/admin/scenario/attributes");
}
