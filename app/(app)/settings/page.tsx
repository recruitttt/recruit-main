import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GithubIcon, LinkedinIcon, XIcon, DevpostIcon } from "@/components/ui/brand-icons";
import { Sparkles } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-7">
        <h1 className="font-serif text-[36px] leading-tight tracking-tight text-[var(--color-fg)]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          The intake the agent uses on every application. Edit anything — the agent picks up changes immediately.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <Pill tone="success">Verified</Pill>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Full name" value="Mo Hoshir" />
            <Field label="Email" value="mohoshirmo@gmail.com" />
            <Field label="Pronouns" value="he/him" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work authorization</CardTitle>
            <Pill tone="accent">Cached on every app</Pill>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Authorized to work in the US" value="Yes" />
            <Field label="Sponsorship required" value="No" />
            <Field label="Earliest start date" value="4 weeks from offer" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <LinkRow icon={GithubIcon} prefix="github.com/" handle="mohoshir" />
            <LinkRow icon={LinkedinIcon} prefix="linkedin.com/in/" handle="mohoshir" />
            <LinkRow icon={XIcon} prefix="x.com/" handle="mohoshir" />
            <LinkRow icon={DevpostIcon} prefix="devpost.com/" handle="mohoshir" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Career preferences</CardTitle>
            <Button variant="ghost" size="sm">Edit</Button>
          </CardHeader>
          <CardBody className="space-y-3">
            <PrefRow label="Target roles">
              {["Software Engineer", "Product Engineer", "Founding Engineer"]}
            </PrefRow>
            <PrefRow label="Locations">
              {["Remote · Worldwide", "San Francisco"]}
            </PrefRow>
            <PrefRow label="Minimum salary">
              {["$200k+"]}
            </PrefRow>
            <PrefRow label="Company size">
              {["Series A/B (15-100)", "Series C+ (100-500)"]}
            </PrefRow>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cached answers <span className="text-[var(--color-fg-subtle)] font-mono ml-2 text-[11px]">312 cached · reused 7x today</span></CardTitle>
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-accent)] font-mono">
              <Sparkles className="h-3 w-3" /> Memory wedge
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-[13px] text-[var(--color-fg-muted)] leading-relaxed">
              Every question you've ever answered is here. The agent never asks the same one twice.
            </p>
            <Button variant="secondary" size="sm" className="mt-4">
              Browse answer cache
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-baseline">
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
        {label}
      </div>
      <div className="text-[14px] text-[var(--color-fg)]">{value}</div>
    </div>
  );
}

function LinkRow({
  icon: Icon,
  prefix,
  handle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  prefix: string;
  handle: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5">
      <Icon className="h-4 w-4 text-[var(--color-accent)]" />
      <span className="text-[13px] font-mono text-[var(--color-fg-subtle)]">
        {prefix}
      </span>
      <span className="text-[13px] font-mono text-[var(--color-fg)]">
        {handle}
      </span>
    </div>
  );
}

function PrefRow({
  label,
  children,
}: {
  label: string;
  children: string[];
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {children.map((c) => (
          <span
            key={c}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-1 text-[12px] text-[var(--color-fg-muted)]"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
