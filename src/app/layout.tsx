import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { TrackerStateProvider } from "@/state/tracker-state-provider";

export const metadata: Metadata = {
  title: "WWE 2K26 League Control",
  description: "Workbook-driven WWE 2K26 League Year tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TrackerStateProvider>
          <AppShell>{children}</AppShell>
        </TrackerStateProvider>
      </body>
    </html>
  );
}
