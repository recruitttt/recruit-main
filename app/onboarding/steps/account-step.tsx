"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ActionButton } from "@/components/design-system";
import { GithubIcon } from "@/components/ui/brand-icons";
import { ChatCard } from "@/components/onboarding/chat-card";
import type { Step } from "@/app/onboarding/_data";

export function AccountStepCard({
  isAuthenticated,
  onGithubSignIn,
  onEmailContinue,
  onAdvance,
}: {
  isAuthenticated: boolean;
  onGithubSignIn: () => Promise<void>;
  onEmailContinue: () => void;
  onAdvance: (userText: string, nextStep: Step) => void;
}) {
  const [pending, setPending] = useState(false);

  const handleGithub = async () => {
    setPending(true);
    try {
      await onGithubSignIn();
    } finally {
      setPending(false);
    }
  };

  return (
    <ChatCard icon={<GithubIcon className="h-4 w-4 text-sky-600" />}>
      {isAuthenticated ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-700">
            Okay, signed in. Continue to upload your resume.
          </p>
          <div className="flex justify-end">
            <ActionButton
              variant="primary"
              onClick={() =>
                onAdvance("Continued with existing account", "resume")
              }
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-700">
            GitHub sign-in unlocks your repos right away — Scout starts
            pulling them in the background while you finish onboarding.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton
              variant="primary"
              size="lg"
              loading={pending}
              onClick={handleGithub}
            >
              <GithubIcon className="h-4 w-4" />
              Continue with GitHub
            </ActionButton>
            <ActionButton variant="secondary" size="lg" onClick={onEmailContinue}>
              Sign up with email
            </ActionButton>
          </div>
          <p className="font-mono text-[11px] leading-5 text-slate-500">
            We never post anything. Read-only access to public profile + repos.
          </p>
        </div>
      )}
    </ChatCard>
  );
}
