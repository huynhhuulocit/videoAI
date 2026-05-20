import { redirect } from "next/navigation";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { I18nInput } from "../../../../components/i18n/i18n-input";
import { Badge } from "../../../../components/ui/badge";
import { Card } from "../../../../components/ui/card";
import { auth } from "../../../../lib/auth/auth";
import { getAiLogs } from "../../../../lib/api/client";

export default async function AiLogsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const logs = await getAiLogs();

  return (
    <DashboardShell
      role="admin"
      title={<I18nText id="adminLogs.title" />}
      description={<I18nText id="adminLogs.description" />}
      backHref="/admin/ai-config"
    >
      <Card title={<I18nText id="adminLogs.requestLog" />}>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <I18nInput placeholderId="adminLogs.search" className="h-10 rounded-md border border-border px-3 text-sm" />
          <select className="h-10 rounded-md border border-border px-3 text-sm">
            <option>
              <I18nText id="dashboard.status" />
            </option>
            <option>success</option>
            <option>pending</option>
            <option>failed</option>
          </select>
          <select className="h-10 rounded-md border border-border px-3 text-sm">
            <option>
              <I18nText id="adminConfig.provider" />
            </option>
            <option>gemini</option>
            <option>chatgpt</option>
            <option>veo</option>
          </select>
          <input type="date" className="h-10 rounded-md border border-border px-3 text-sm" />
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="adminLogs.requestId" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="dashboard.flow" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="adminConfig.provider" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="adminConfig.model" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="dashboard.status" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="adminLogs.latency" />
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.requestId} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{log.requestId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{log.flowType}</td>
                  <td className="px-4 py-3">{log.provider}</td>
                  <td className="px-4 py-3">{log.model}</td>
                  <td className="px-4 py-3">
                    <Badge variant={log.status === "success" ? "success" : log.status === "failed" ? "danger" : "info"}>
                      {log.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{log.latencyMs ?? 0}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardShell>
  );
}
