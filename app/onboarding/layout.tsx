import { cx, mistClasses } from "@/components/design-system";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cx("relative min-h-screen overflow-hidden", mistClasses.page)}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.20)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,black_0%,transparent_80%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.18),transparent_55%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
