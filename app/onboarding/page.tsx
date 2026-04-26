import { Suspense } from "react";
import { OnboardingClient } from "./_client";
import { OnboardingFallback } from "@/components/onboarding/onboarding-fallback";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingClient />
    </Suspense>
  );
}
