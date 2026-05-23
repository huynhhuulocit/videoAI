import { ArrowRight, Clapperboard, ShieldCheck, Sparkles } from "lucide-react";
import { LinkButton } from "../../components/ui/button";
import { BackButton } from "../../components/ui/back-button";
import { Card } from "../../components/ui/card";
import { I18nText } from "../../components/i18n/i18n-text";
import { AiHandoffInstallCard } from "../../components/home/ai-handoff-install-card";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" />
          <div className="text-lg font-semibold">VideoAI</div>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/login" className="gap-2">
            <I18nText id="common.login" />
            <ArrowRight size={16} />
          </LinkButton>
        </div>
      </nav>
      <section className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-sky-700">
            <I18nText id="home.eyebrow" />
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-foreground">
            <I18nText id="home.headline" />
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            <I18nText id="home.subcopy" />
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/login">
              <I18nText id="home.startDemo" />
            </LinkButton>
            <LinkButton href="/admin/ai-config" variant="secondary">
              <I18nText id="home.adminConfig" />
            </LinkButton>
          </div>
        </div>
        <div className="grid gap-4">
          <Card>
            <div className="flex items-start gap-4">
              <Sparkles className="text-sky-600" />
              <div>
                <h2 className="font-semibold">
                  <I18nText id="home.cardPromptTitle" />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <I18nText id="home.cardPromptBody" />
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-4">
              <Clapperboard className="text-sky-600" />
              <div>
                <h2 className="font-semibold">
                  <I18nText id="home.cardWorkspaceTitle" />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <I18nText id="home.cardWorkspaceBody" />
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-4">
              <ShieldCheck className="text-sky-600" />
              <div>
                <h2 className="font-semibold">
                  <I18nText id="home.cardAdminTitle" />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <I18nText id="home.cardAdminBody" />
                </p>
              </div>
            </div>
          </Card>
          <AiHandoffInstallCard />
        </div>
      </section>
    </main>
  );
}
