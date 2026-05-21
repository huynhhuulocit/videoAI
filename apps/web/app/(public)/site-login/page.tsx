import { LockKeyhole } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import {
  getSafeNextPath,
  isSiteGateEnabled,
  SITE_GATE_COOKIE_NAME,
  verifySiteGateCookieValue,
} from "../../../lib/site-gate";

type SiteLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SiteLoginPage({ searchParams }: SiteLoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = getSafeNextPath(getSearchValue(resolvedSearchParams, "next"));
  const hasError = getSearchValue(resolvedSearchParams, "error") === "1";

  if (!isSiteGateEnabled()) {
    redirect(nextPath);
  }

  const cookieStore = await cookies();
  const hasGateSession = await verifySiteGateCookieValue(
    cookieStore.get(SITE_GATE_COOKIE_NAME)?.value,
  );
  if (hasGateSession) {
    redirect(nextPath);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <Card
        className="w-full max-w-md"
        title={
          <span className="inline-flex items-center gap-2">
            <LockKeyhole size={18} className="text-sky-600" />
            Protected site
          </span>
        }
      >
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          Enter the site password before using VideoAI. Your browser will remember this session.
        </p>
        {hasError ? (
          <div className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            Invalid site username or password.
          </div>
        ) : null}
        <form action="/api/site-gate/login" method="post" className="space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <div>
            <label className="text-sm font-medium" htmlFor="siteGateUsername">
              Username
            </label>
            <input
              autoComplete="username"
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              id="siteGateUsername"
              name="username"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="siteGatePassword">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              id="siteGatePassword"
              name="password"
              required
              type="password"
            />
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </Card>
    </main>
  );
}
