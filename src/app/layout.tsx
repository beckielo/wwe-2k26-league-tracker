import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { TrackerStateProvider } from "@/state/tracker-state-provider";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WWE 2K26 League Control",
  description: "WWE 2K26 League Year tracker.",
  icons: {
    icon: "/brand-assets/decorative/site/deco-gwf-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const data = loadTrackerData();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TrackerStateProvider workflowContext={data.workflowContext}>
          <AppShell>{children}</AppShell>
        </TrackerStateProvider>
      </body>
    </html>
  );
}
