import { redirect } from "next/navigation";
import { PageTransition } from "@/components/page-transition";
import { Topnav } from "@/components/shell/topnav";
import { isAuthenticated } from "@/lib/auth-server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated().catch(() => false))) redirect("/sign-in");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Topnav />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
