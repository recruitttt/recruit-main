import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageTransition } from "@/components/page-transition";
import { Topnav } from "@/components/shell/topnav";
import { isAuthenticated } from "@/lib/auth-server";
import {
  ONBOARDING_COOKIE_NAME,
  ONBOARDING_COOKIE_VALUE,
} from "@/lib/onboarding-cookie";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated().catch(() => false))) redirect("/sign-in");

  const onboardedCookie = (await cookies()).get(ONBOARDING_COOKIE_NAME);
  if (onboardedCookie?.value !== ONBOARDING_COOKIE_VALUE) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Topnav />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
