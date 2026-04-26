import {
  extractPdfText,
  extractStructuredProfile,
} from "@/lib/intake/resume/parse";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, reason: "missing_file" }, { status: 400 });
  }

  const pdfText = await extractPdfText(file);
  if (!pdfText.ok) {
    return Response.json(
      { ok: false, reason: pdfText.reason },
      { status: 422 }
    );
  }

  const { rawText } = pdfText;

  const structuredResult = await extractStructuredProfile(rawText);
  if (!structuredResult.ok) {
    return Response.json({
      ok: true,
      rawText,
      structured: null,
      reason: structuredResult.reason,
      filename: file.name,
    });
  }

  return Response.json({
    ok: true,
    rawText,
    structured: structuredResult.structured,
    filename: file.name,
  });
}
