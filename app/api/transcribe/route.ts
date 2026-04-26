import { getSessionUserId } from "@/lib/auth-server";
import { transcribeWithScribe } from "@/lib/intake/voice/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "invalid_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return Response.json({ ok: false, error: "file_too_large" }, { status: 413 });
  }

  const result = await transcribeWithScribe(file);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.reason }, { status: 502 });
  }

  return Response.json({ ok: true, text: result.text });
}
