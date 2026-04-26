"use client";

import { ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { LocalDataReconciler } from "@/components/local-data-reconciler";

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl]
  );

  if (!client)
    return (
      <>
        <LocalDataReconciler />
        {children}
      </>
    );
  return (
    <ConvexBetterAuthProvider
      client={client}
      authClient={authClient}
      initialToken={initialToken}
    >
      <LocalDataReconciler />
      {children}
    </ConvexBetterAuthProvider>
  );
}
