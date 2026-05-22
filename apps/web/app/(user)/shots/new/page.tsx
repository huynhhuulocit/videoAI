import { redirect } from "next/navigation";

export default async function NewShotPlanRedirectPage() {
  redirect("/projects");
}
