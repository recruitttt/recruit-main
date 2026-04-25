import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-http";

export const runtime = "nodejs";

type Body = {
  company?: string;
  role?: string;
  location?: string;
  jobUrl?: string;
  descriptionPlain?: string;
};

export async function POST(req: Request) {
  const client = await getConvexClient();
  if (!client) return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const company = body.company?.trim();
  const role = body.role?.trim();
  const descriptionPlain = body.descriptionPlain?.trim();
  if (!company || !role || !descriptionPlain) {
    return Response.json({ ok: false, reason: "missing_required_custom_jd_fields" }, { status: 400 });
  }

  const result = await client.mutation(api.ashby.createCustomJob, {
    company,
    role,
    location: body.location?.trim() || undefined,
    jobUrl: body.jobUrl?.trim() || undefined,
    descriptionPlain,
  });
  const detail = await client.query(api.ashby.jobDetail, { jobId: result.jobId as never });
  return Response.json({ ok: true, provider: "Custom JD", ...result, detail });
}
