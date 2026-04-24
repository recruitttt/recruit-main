export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg)]">
      <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-[rgba(8,145,178,0.035)] via-transparent to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}
