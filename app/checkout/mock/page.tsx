import { cx, mistClasses } from "@/components/design-system";

import { MockCheckoutContent } from "./_client";

const allowedPlans = new Set(["Standard", "Pro"]);

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[]; amount?: string | string[] }>;
}) {
  const params = await searchParams;
  const plan = allowedPlans.has(valueOf(params.plan) ?? "") ? (valueOf(params.plan) as string) : "Standard";
  const amountCents = Number(valueOf(params.amount) ?? "2400");
  const price = Number.isFinite(amountCents) ? `$${(amountCents / 100).toFixed(0)}` : "$24";

  return (
    <main className={cx("min-h-screen px-5 py-5 md:px-6 md:py-7", mistClasses.page)}>
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-3xl items-center">
        <MockCheckoutContent plan={plan} price={price} />
      </div>
    </main>
  );
}
