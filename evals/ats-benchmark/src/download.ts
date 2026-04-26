import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type HuggingFaceTreeItem = {
  path?: string;
  type?: string;
};

const DEFAULT_DATASET = "zeel180503/resume-score-details";

export async function downloadResumeScoreDetails(options: {
  dataset?: string;
  outputDir?: string;
  fetchFn?: typeof fetch;
} = {}): Promise<{ dataset: string; outputDir: string; fileCount: number }> {
  const dataset = options.dataset ?? DEFAULT_DATASET;
  const outputDir = path.resolve(
    process.cwd(),
    options.outputDir ?? path.join("evals", "ats-benchmark", ".data", "raw", "resume-score-details")
  );
  const fetchFn = options.fetchFn ?? fetch;
  await mkdir(outputDir, { recursive: true });
  const treeUrl = `https://huggingface.co/api/datasets/${dataset}/tree/main?recursive=true`;
  const treeRes = await fetchFn(treeUrl);
  if (!treeRes.ok) throw new Error(`huggingface_tree_${treeRes.status}`);
  const tree = await treeRes.json() as HuggingFaceTreeItem[];
  const jsonFiles = tree
    .map((item) => item.path)
    .filter((item): item is string => Boolean(item && /\.(json|jsonl)$/i.test(item)));
  let fileCount = 0;
  for (const file of jsonFiles) {
    const rawUrl = `https://huggingface.co/datasets/${dataset}/resolve/main/${file}`;
    const res = await fetchFn(rawUrl);
    if (!res.ok) continue;
    const text = await res.text();
    const targetPath = path.join(outputDir, file);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, text, "utf8");
    fileCount += 1;
  }
  return { dataset, outputDir, fileCount };
}

export function parseDownloadArgs(args: string[]): { dataset?: string; outputDir?: string } {
  const out: { dataset?: string; outputDir?: string } = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [name, value] = splitArg(arg);
    if (name === "dataset") out.dataset = value;
    else if (name === "output") out.outputDir = value;
    else throw new Error(`Unknown option --${name}`);
  }
  return out;
}

function splitArg(arg: string): [string, string] {
  const body = arg.slice(2);
  const eq = body.indexOf("=");
  return eq === -1 ? [body, "true"] : [body.slice(0, eq), body.slice(eq + 1)];
}
