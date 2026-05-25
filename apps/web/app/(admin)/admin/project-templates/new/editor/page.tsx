import { redirect } from "next/navigation";
import { auth } from "../../../../../../lib/auth/auth";

export default async function AdminProjectTemplateNewEditorPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }
  redirect("/admin/project-templates/new/workflow");
}
