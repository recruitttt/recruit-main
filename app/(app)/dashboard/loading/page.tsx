import { DashboardLoadingPage } from "@/components/dashboard/dashboard-loading-page";

export const metadata = {
  title: "Loading Recruit dashboard",
  description: "Preparing the Recruit application dashboard.",
};

type LoadingDashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoadingDashboardPage({
  searchParams,
}: LoadingDashboardPageProps) {
  const params = (await searchParams) ?? {};
  const preview = readFlag(params.preview) || readFlag(params.test);

  return <DashboardLoadingPage preview={preview} />;
}

function readFlag(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
