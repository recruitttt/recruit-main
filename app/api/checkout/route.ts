export const dynamic = "force-dynamic";

const TIERS = {
  standard: { name: "Standard", unitAmount: 2400 },
  pro: { name: "Pro", unitAmount: 7900 },
} as const;

type Tier = keyof typeof TIERS;
type CheckoutMode = "test" | "mock" | "disabled";

function stripeSecret() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

function mockCheckoutEnabled() {
  return process.env.STRIPE_CHECKOUT_MOCK === "1";
}

function checkoutMode(secret = stripeSecret()): CheckoutMode {
  if (secret.startsWith("sk_test_")) {
    return "test";
  }
  if (!secret && mockCheckoutEnabled()) {
    return "mock";
  }
  return "disabled";
}

function appUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }
  return new URL(req.url).origin;
}

export async function GET() {
  const mode = checkoutMode();
  return Response.json({ configured: mode !== "disabled", mode });
}

export async function POST(req: Request) {
  let body: { tier?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_tier", message: "Choose a valid plan before checkout." },
      { status: 400 }
    );
  }

  const tier = body.tier;
  if (tier !== "standard" && tier !== "pro") {
    return Response.json(
      { error: "invalid_tier", message: "Choose Standard or Pro before checkout." },
      { status: 400 }
    );
  }

  const secret = stripeSecret();
  if (!secret) {
    if (mockCheckoutEnabled()) {
      const origin = appUrl(req);
      const selected = TIERS[tier as Tier];
      const mockUrl = new URL("/checkout/mock", origin);
      mockUrl.searchParams.set("tier", tier);
      mockUrl.searchParams.set("plan", selected.name);
      mockUrl.searchParams.set("amount", String(selected.unitAmount));
      return Response.json({ url: mockUrl.toString() });
    }
    return Response.json(
      {
        error: "checkout_unconfigured",
        message: "Stripe test checkout is not configured for this deployment.",
      },
      { status: 503 }
    );
  }
  if (!secret.startsWith("sk_test_")) {
    return Response.json(
      {
        error: "checkout_live_key_blocked",
        message: "This demo only accepts Stripe test-mode keys.",
      },
      { status: 403 }
    );
  }

  const selected = TIERS[tier as Tier];
  const origin = appUrl(req);
  const form = new URLSearchParams({
    mode: "subscription",
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `Recruit ${selected.name}`,
    "line_items[0][price_data][unit_amount]": String(selected.unitAmount),
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const json = (await response.json().catch(() => null)) as { url?: string; error?: { message?: string } } | null;
  if (!response.ok || !json?.url) {
    return Response.json(
      {
        error: "stripe_checkout_failed",
        message: "Stripe checkout could not be started. Try again in a moment.",
      },
      { status: 502 }
    );
  }

  return Response.json({ url: json.url });
}
