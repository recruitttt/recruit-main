//
// /ready — clean 2D Ready Room.
//
// The user lands here after onboarding, watches the GitHub / LinkedIn /
// Resume / Web / Chat intake pipelines finish, answers a few enrichment
// questions, and presses "Start searching for jobs" when they're ready.
//
// Server shell + client island. The shell pulls the user id from the
// better-auth session bridge (same pattern as /profile) so the client
// `useQuery` calls never run with an empty userId. The client island wires
// the intake status panel, enrichment chat, and CTA together.
//
// Spec: 2026-04-25-recruit-merge-design.md (Ready Room replaces the 3D
// scene-transition between onboarding and /dashboard).
//

import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth-server";
import { getSessionUser } from "@/app/(app)/profile/_session";
import { ReadyRoom } from "./_client";

export const metadata = {
  title: "Ready · Recruit",
  description:
    "Watch your intake sources finish, answer a few enrichment questions, then start the job search.",
};

export default async function ReadyPage(): Promise<React.ReactElement> {
  if (!(await isAuthenticated().catch(() => false))) {
    redirect("/sign-in");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/sign-in");
  }

  return (
    <ReadyRoom
      userId={sessionUser.id}
      fallbackName={sessionUser.name ?? undefined}
    />
  );
}
