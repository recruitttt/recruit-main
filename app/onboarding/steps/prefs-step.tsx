"use client";

import { ArrowRight, Briefcase, MapPin } from "lucide-react";
import {
  ActionButton,
  ChoiceChipGroup,
  TextField,
} from "@/components/design-system";
import { ChatCard } from "@/components/onboarding/chat-card";
import {
  AUTH_OPTIONS,
  ROLE_OPTIONS,
  type Data,
  type DataUpdate,
  type Step,
} from "@/app/onboarding/_data";

export function PrefsStepCard({
  data,
  selectedRoles,
  toggleRole,
  updateData,
  onAdvance,
}: {
  data: Data;
  selectedRoles: string[];
  toggleRole: (role: string) => void;
  updateData: (updates: DataUpdate) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
}) {
  const canAdvance = selectedRoles.length > 0;
  return (
    <ChatCard icon={<Briefcase className="h-4 w-4 text-sky-600" />}>
      <div className="space-y-4">
        <div>
          <div className="mb-2 block text-xs font-semibold text-slate-500">
            Role focus
          </div>
          <ChoiceChipGroup
            options={ROLE_OPTIONS}
            selected={selectedRoles}
            multi
            onToggle={toggleRole}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-2 block text-xs font-semibold text-slate-500">
              Location
            </div>
            <TextField
              value={data.prefs.location}
              placeholder="Remote, San Francisco, New York"
              readOnly={false}
              onChange={(e) =>
                updateData({ prefs: { location: e.target.value } })
              }
            />
          </div>
          <div>
            <div className="mb-2 block text-xs font-semibold text-slate-500">
              Work authorization
            </div>
            <ChoiceChipGroup
              options={AUTH_OPTIONS}
              selected={data.prefs.workAuth ? [data.prefs.workAuth] : []}
              onToggle={(value) =>
                updateData({
                  prefs: {
                    workAuth: value === data.prefs.workAuth ? "" : value,
                  },
                })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pl-1">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Stored locally and in your profile
          </span>
        </div>

        <div className="flex justify-end">
          <ActionButton
            variant="primary"
            disabled={!canAdvance}
            onClick={() => {
              const parts = [
                selectedRoles.join(", "),
                data.prefs.location,
                data.prefs.workAuth,
              ].filter(Boolean);
              onAdvance(
                parts.length > 0 ? parts.join(" · ") : "Defaults",
                "activate",
              );
            }}
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </div>
    </ChatCard>
  );
}
