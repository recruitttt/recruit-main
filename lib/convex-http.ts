import { ConvexHttpClient } from "convex/browser";
import { getToken } from "@/lib/auth-server";

export async function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;

  const client = new ConvexHttpClient(url.replace(/\/+$/, ""));
  try {
    const token = await getToken();
    if (token) client.setAuth(token);
  } catch {
    // Keep unauthenticated demo/API fallbacks working when auth env is absent.
  }

  return client;
}
