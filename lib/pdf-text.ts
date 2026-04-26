type UnpdfModule = typeof import("unpdf");

let unpdfModule: Promise<UnpdfModule> | null = null;
let pdfjsReady: Promise<void> | null = null;

function ensurePromiseTry() {
  if (typeof (Promise as unknown as { try?: unknown }).try !== "function") {
    (Promise as unknown as { try: (fn: () => unknown) => Promise<unknown> }).try =
      (fn) => new Promise((resolve) => resolve(fn()));
  }
}

async function getUnpdf() {
  ensurePromiseTry();
  if (!unpdfModule) {
    unpdfModule = import("unpdf");
  }
  return await unpdfModule;
}

async function ensurePDFJS() {
  if (!pdfjsReady) {
    const { definePDFJSModule } = await getUnpdf();
    pdfjsReady = definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs"));
  }
  return await pdfjsReady;
}

export async function extractPdfTextForEvidence(input: Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  try {
    await ensurePDFJS();
    const { extractText, getDocumentProxy } = await getUnpdf();
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch {
    return extractPdfLiteralText(bytes);
  }
}

export function extractPdfLiteralText(input: Uint8Array): string {
  const raw = Buffer.from(input).toString("latin1");
  const parts = [...raw.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)].map((match) =>
    match[1]
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
  );
  return parts.join("\n").trim();
}
