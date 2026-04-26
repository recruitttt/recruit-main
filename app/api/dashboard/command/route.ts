import { runDashboardCommand } from "@/lib/dashboard-command/model";
import { DashboardCommandRequestSchema } from "@/lib/dashboard-command/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = DashboardCommandRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        reason: "invalid_dashboard_command",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const result = await runDashboardCommand(parsed.data);
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        reason: result.reason,
        providerAttempts: result.providerAttempts,
      },
      { status: result.reason === "no_ai_provider" ? 503 : 502 },
    );
  }

  return Response.json({
    ok: true,
    command: result.value,
    model: {
      provider: result.provider,
      modelId: result.modelId,
      fallbackUsed: result.fallbackUsed,
    },
    sponsor: {
      name: "K2 Think V2",
      provider: "K2",
      placement: "dashboard-command-bar",
      active: result.provider === "k2",
    },
  });
}
