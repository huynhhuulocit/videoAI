import { redirect } from "next/navigation";

export default async function ShotPlanRedirectPage() {
  redirect("/projects");
}
