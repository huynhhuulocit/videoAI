import type { Metadata } from "next";
import { LanguageProvider } from "../components/i18n/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "VideoAI",
  description: "AI video generation dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
