import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { build } from "esbuild";

function pdfWithText(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const stream = `BT /F1 18 Tf 40 100 Td (${text}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(encoder.encode(body).length);
    body += object;
  }

  const xrefOffset = encoder.encode(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(body);
}

async function main() {
  const tempDir = await mkdtemp(path.join(tmpdir(), "recruit-resume-parse-"));
  try {
    const entryPath = path.join(tempDir, "entry.ts");
    const bundlePath = path.join(tempDir, "entry.mjs");
    const parserPath = path.join(process.cwd(), "lib/intake/resume/parse.ts");

    await writeFile(
      entryPath,
      `
	${pdfWithText.toString()}

delete Promise.try;
const { extractPdfText } = await import(${JSON.stringify(parserPath)});
const result = await extractPdfText(pdfWithText("Ada Lovelace Resume"));
if (!result.ok) {
  throw new Error(result.reason);
}
console.log(result.rawText);
`
    );

    const buildResult = await build({
      bundle: true,
      entryPoints: [entryPath],
      format: "esm",
      logLevel: "silent",
      metafile: true,
      outfile: bundlePath,
      platform: "node",
      target: "node22",
    });

    const bundleInputs = Object.keys(buildResult.metafile.inputs);
    assert.equal(
      bundleInputs.some((input) => input.endsWith("pdfjs-dist/legacy/build/pdf.mjs")),
      false,
      "resume parser must use unpdf's serverless bundle, not pdfjs-dist's worker-based build"
    );
    assert.equal(
      bundleInputs.some((input) => input.endsWith("pdfjs-dist/legacy/build/pdf.worker.mjs")),
      false,
      "resume parser bundle must not include pdf.worker.mjs"
    );

    const run = spawnSync(process.execPath, [bundlePath], {
      encoding: "utf8",
    });

    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.equal(run.stdout.trim(), "Ada Lovelace Resume");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
