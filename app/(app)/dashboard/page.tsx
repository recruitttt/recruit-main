import { DashboardEntryGate } from "@/components/dashboard/dashboard-entry-gate";
import { RecruitDashboard } from "@/components/recruit-dashboard";

export const metadata = {
  title: "Recruit dashboard",
  description: "Minimal application list for jobs in progress.",
};

export default function DashboardPage() {
  return (
    <DashboardEntryGate>
      <RecruitDashboard />
    </DashboardEntryGate>
  );
}
