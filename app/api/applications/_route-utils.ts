export async function readJson(req: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await req.json() };
  } catch {
    return {
      ok: false,
      response: Response.json({ ok: false, reason: "bad_request" }, { status: 400 }),
    };
  }
}

export async function readParams<T extends Record<string, string>>(
  context: { params: T | Promise<T> },
): Promise<T> {
  return await context.params;
}

export function routeError(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error);
  const status = message === "run_not_found" ? 404 : 500;
  return Response.json({ ok: false, reason: message }, { status });
}
