import { NewRunSetupWizard } from "@/components/new-run-setup-wizard";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function NewRunPage() {
  const data = loadTrackerData();

  return <>
    <PageHeader
      eyebrow="Quick access"
      title="Create New Run"
      description="Open the existing run setup flow without adding management controls to the main dashboard."
    />
    <NewRunSetupWizard meta={data.meta} />
  </>;
}
