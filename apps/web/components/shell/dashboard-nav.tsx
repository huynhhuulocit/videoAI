"use client";

import {
  FileText,
  Film,
  FolderOpen,
  LayoutDashboard,
  Logs,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TranslationKey } from "../../lib/i18n/dictionary";
import { I18nText } from "../i18n/i18n-text";

type NavItem = {
  href?: string;
  label: TranslationKey;
  icon: LucideIcon;
  children?: Array<{
    href: string;
    label: TranslationKey;
  }>;
};

const userNav: NavItem[] = [
  { href: "/dashboard", label: "shell.dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "shell.projectWorkspace", icon: FolderOpen },
  { href: "/one-click", label: "shell.oneClick", icon: Sparkles },
];

const adminNav: NavItem[] = [
  {
    label: "shell.ai",
    icon: Settings,
    children: [
      { href: "/admin/ai-config", label: "shell.aiConfig" },
      { href: "/admin/master-prompt-config", label: "shell.masterPromptConfig" },
    ],
  },
  {
    label: "shell.story",
    icon: FileText,
    children: [
      { href: "/admin/story/master-prompt", label: "shell.storyMasterPrompt" },
      { href: "/admin/story/attributes", label: "shell.storyAttribute" },
    ],
  },
  {
    label: "shell.scenario",
    icon: FileText,
    children: [
      { href: "/admin/scenario/master-prompt", label: "shell.scenarioMasterPrompt" },
      { href: "/admin/scenario/attributes", label: "shell.scenarioAttribute" },
    ],
  },
  {
    label: "shell.shotsGroup",
    icon: Film,
    children: [
      { href: "/admin/shots/master-prompt", label: "shell.shotsMasterPrompt" },
      { href: "/admin/shots/attributes", label: "shell.shotsAttribute" },
    ],
  },
  {
    label: "shell.shotGroup",
    icon: Film,
    children: [
      { href: "/admin/shot/master-prompt", label: "shell.shotMasterPrompt" },
      { href: "/admin/shot/attributes", label: "shell.shotAttribute" },
    ],
  },
  { href: "/admin/ai-logs", label: "shell.aiLogs", icon: Logs },
];

function isActive(pathname: string, href: string, children?: NavItem["children"]) {
  if (pathname === href || pathname.startsWith(`${href}/`)) {
    return true;
  }
  return children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) ?? false;
}

export function DashboardNav({ role }: { role: "user" | "admin" }) {
  const pathname = usePathname();
  const nav = role === "admin" ? adminNav : userNav;

  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const itemKey = item.href ?? item.label;
        const active = item.href ? isActive(pathname, item.href, item.children) : item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) ?? false;
        return (
          <div key={itemKey}>
            {item.href ? (
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-sky-50 text-sky-700"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon size={16} />
                <I18nText id={item.label} />
              </Link>
            ) : (
              <div
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${
                  active ? "bg-sky-50 text-sky-700" : "text-foreground"
                }`}
              >
                <item.icon size={16} />
                <I18nText id={item.label} />
              </div>
            )}
            {item.children ? (
              <div className="ml-7 mt-1 space-y-1 border-l border-border pl-3">
                {item.children.map((child) => {
                  const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        childActive
                          ? "bg-sky-100 text-sky-700"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <I18nText id={child.label} />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
