import { NextResponse } from "next/server";
import { getAppUrl, getStripeClient, getStripePriceId, type PaidTier } from "@/lib/stripe";

export const runtime = "nodejs";

const paidTiers = new Set<PaidTier>(["standard", "pro"]);

export async function POST(req: Request) {
  let body: { tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const tier = body.tier;
  if (!tier || !paidTiers.has(tier as PaidTier)) {
    return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
  }

  try {
    const appUrl = getAppUrl();
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: getStripePriceId(tier as PaidTier), quantity: 1 }],
      success_url: `${appUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing/cancel?tier=${tier}`,
      metadata: {
        tier,
        product: "recruit",
        environment: "sandbox",
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "missing_checkout_url" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      {
        error: "checkout_unavailable",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
