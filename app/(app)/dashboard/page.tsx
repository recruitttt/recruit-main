import { RecruitDashboard } from "@/components/recruit-dashboard";
import { dashboardSeed } from "@/lib/dashboard-seed";

export const metadata = {
  title: "Recruit command center",
  description: "Glass UI dashboard for the autonomous job pipeline.",
};

export default function DashboardPage() {
  return <RecruitDashboard seed={dashboardSeed} />;
}
