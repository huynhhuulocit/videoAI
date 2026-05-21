"use client";

import {
  FileText,
  Film,
  FolderOpen,
  LayoutDashboard,
  LayoutTemplate,
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
  href: string;
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
  { href: "/shots", label: "shell.shots", icon: Film },
  { href: "/templates", label: "shell.templates", icon: LayoutTemplate },
];

const adminNav: NavItem[] = [
  { href: "/admin/ai-config", label: "shell.aiConfig", icon: Settings },
  {
    href: "/admin/shot-prompt",
    label: "shell.shotPrompt",
    icon: FileText,
    children: [
      { href: "/admin/shot-prompt/story-content", label: "shell.masterPromptStory" },
      { href: "/admin/shot-prompt/scenario", label: "shell.masterPromptScenario" },
      { href: "/admin/shot-prompt/shots", label: "shell.masterPromptShots" },
    ],
  },
  { href: "/admin/ai-logs", label: "shell.aiLogs", icon: Logs },
];

function isActive(pathname: string, href: string, children?: NavItem["children"]) {
  if (pathname === href || pathname.startsWith(`${href}/`)) {
    return true;
  }
  return children?.some((child) => pathname === child.href) ?? false;
}

export function DashboardNav({ role }: { role: "user" | "admin" }) {
  const pathname = usePathname();
  const nav = role === "admin" ? adminNav : userNav;

  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const active = isActive(pathname, item.href, item.children);
        return (
          <div key={item.href}>
            <Link
              href={item.children?.[0]?.href ?? item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-sky-50 text-sky-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon size={16} />
              <I18nText id={item.label} />
            </Link>
            {item.children ? (
              <div className="ml-7 mt-1 space-y-1 border-l border-border pl-3">
                {item.children.map((child) => {
                  const childActive = pathname === child.href;
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
