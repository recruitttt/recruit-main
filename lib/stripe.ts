import Stripe from "stripe";

export type PaidTier = "standard" | "pro";

const STRIPE_API_VERSION = "2026-04-22.dahlia";

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
}

export function getStripePriceId(tier: PaidTier) {
  const envKey =
    tier === "standard" ? "STRIPE_STANDARD_PRICE_ID" : "STRIPE_PRO_PRICE_ID";
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new Error(`${envKey} is not configured`);
  }

  return priceId;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
