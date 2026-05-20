import { redirect } from "next/navigation";
import { auth, signIn } from "../../../lib/auth/auth";
import { getRoleLandingPath, verifyCredentials } from "../../../lib/auth/credentials";
import { BackButton } from "../../../components/ui/back-button";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { I18nText } from "../../../components/i18n/i18n-text";

async function login(formData: FormData) {
  "use server";

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await verifyCredentials(username, password);

  if (!user) {
    redirect("/login?error=CredentialsSignin");
  }

  await signIn("credentials", {
    username,
    password,
    redirect: false
  });
  redirect(getRoleLandingPath(user.role));
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role) {
    redirect(getRoleLandingPath(session.user.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <div className="absolute left-5 top-5 flex items-center gap-2">
        <BackButton fallbackHref="/" />
      </div>
      <Card className="w-full max-w-md" title={<I18nText id="login.title" />}>
        <form action={login} className="space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="username">
              <I18nText id="login.username" />
            </label>
            <input
              id="username"
              name="username"
              defaultValue="user"
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="password">
              <I18nText id="login.password" />
            </label>
            <input
              id="password"
              name="password"
              type="password"
              defaultValue="User@123"
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <Button type="submit" className="w-full">
            <I18nText id="common.login" />
          </Button>
        </form>
        <div className="mt-5 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <I18nText id="login.demoPrefix" /> <span className="font-medium text-foreground">user/User@123</span>{" "}
          <I18nText id="login.or" />{" "}
          <span className="font-medium text-foreground">admin/Admin@123</span>.
        </div>
      </Card>
    </main>
  );
}
