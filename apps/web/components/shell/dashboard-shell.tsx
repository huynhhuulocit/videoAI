import {
  BarChart3,
  FileText,
  KeyRound,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import type { PropsWithChildren, ReactNode } from "react";
import { I18nText } from "../i18n/i18n-text";
import { logoutAction } from "../../lib/auth/actions";
import { BackButton } from "../ui/back-button";
import { DashboardNav } from "./dashboard-nav";

type DashboardShellProps = PropsWithChildren<{
  role: "user" | "admin";
  title: ReactNode;
  description: ReactNode;
  backHref?: string;
}>;

export function DashboardShell({ role, title, description, backHref, children }: DashboardShellProps) {
  const fallbackHref = backHref ?? (role === "admin" ? "/admin/ai-config" : "/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white p-4 md:block">
        <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 size={18} />
          </span>
          VideoAI
        </Link>
        <DashboardNav role={role} />
        <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
            <FileText size={14} />
            <I18nText id="shell.docsSynced" />
          </div>
          <I18nText id="shell.docsNote" />
        </div>
      </aside>
      <main className="md:pl-64">
        <header className="border-b border-border bg-white px-5 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <BackButton fallbackHref={fallbackHref} />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <I18nText id={role === "admin" ? "common.adminDashboard" : "common.userDashboard"} />
                </p>
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-2">
              <form
                action={logoutAction}
                className="hidden items-center gap-2 rounded-md border border-border bg-white px-2 py-2 text-sm text-muted-foreground shadow-sm sm:flex"
              >
                <div className="flex items-center gap-2 px-2">
                  <KeyRound size={15} />
                  <span className="font-medium">
                    <I18nText id={role === "admin" ? "common.admin" : "common.user"} />
                  </span>
                </div>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-sky-200"
                  aria-label="Logout"
                >
                  <LogOut size={15} />
                  <I18nText id="common.logout" />
                </button>
              </form>
              <form action={logoutAction} className="sm:hidden">
                <button
                  type="submit"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                </button>
              </form>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-5">{children}</div>
      </main>
    </div>
  );
}
