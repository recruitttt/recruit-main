import YAML from "yaml";
import type { ManifestParsed } from "@/lib/intake/shared";

type Ecosystem = ManifestParsed["ecosystem"];

const MANIFEST_PATHS: Array<{ path: string; ecosystem: Ecosystem }> = [
  { path: "package.json", ecosystem: "npm" },
  { path: "requirements.txt", ecosystem: "pip" },
  { path: "pyproject.toml", ecosystem: "pip" },
  { path: "go.mod", ecosystem: "go" },
  { path: "Cargo.toml", ecosystem: "cargo" },
  { path: "Gemfile", ecosystem: "rubygems" },
  { path: "pubspec.yaml", ecosystem: "pub" },
  { path: "composer.json", ecosystem: "composer" },
  { path: "pom.xml", ecosystem: "maven" },
  { path: "build.gradle", ecosystem: "gradle" },
  { path: "build.gradle.kts", ecosystem: "gradle" },
];

export const MANIFEST_FILE_LIST: ReadonlyArray<{ path: string; ecosystem: Ecosystem }> = MANIFEST_PATHS;

export function parseManifest(path: string, ecosystem: Ecosystem, content: string): ManifestParsed {
  switch (ecosystem) {
    case "npm":
      return parseNpm(path, content);
    case "pip":
      return path.endsWith("pyproject.toml") ? parsePyproject(path, content) : parseRequirementsTxt(path, content);
    case "go":
      return parseGoMod(path, content);
    case "cargo":
      return parseCargoToml(path, content);
    case "rubygems":
      return parseGemfile(path, content);
    case "pub":
      return parsePubspec(path, content);
    case "composer":
      return parseComposer(path, content);
    case "maven":
      return parsePomXml(path, content);
    case "gradle":
      return parseGradle(path, content);
    default:
      return { path, ecosystem: "unknown", dependencies: [] };
  }
}

function parseNpm(path: string, content: string): ManifestParsed {
  try {
    const json = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return {
      path,
      ecosystem: "npm",
      dependencies: Object.keys({ ...json.dependencies, ...json.peerDependencies }),
      devDependencies: Object.keys(json.devDependencies ?? {}),
    };
  } catch {
    return { path, ecosystem: "npm", dependencies: [] };
  }
}

function parseRequirementsTxt(path: string, content: string): ManifestParsed {
  const deps = content
    .split(/\r?\n/)
    .map((line) => line.split("#")[0]?.trim() ?? "")
    .filter((line) => line && !line.startsWith("-"))
    .map((line) => line.split(/[<>=!~;\s]/)[0]?.toLowerCase().trim() ?? "")
    .filter((s): s is string => Boolean(s));
  return { path, ecosystem: "pip", dependencies: Array.from(new Set(deps)) };
}

function parsePyproject(path: string, content: string): ManifestParsed {
  const deps = new Set<string>();
  for (const m of content.matchAll(/^\s*"?([a-zA-Z0-9_.\-]+)"?\s*=\s*[">]/gm)) {
    if (m[1] && !["python", "name", "version", "description", "authors", "license", "readme", "requires-python"].includes(m[1])) {
      deps.add(m[1].toLowerCase());
    }
  }
  for (const m of content.matchAll(/dependencies\s*=\s*\[([^\]]+)\]/g)) {
    const block = m[1] ?? "";
    for (const inner of block.matchAll(/"([^"<>=!~;\s]+)/g)) {
      if (inner[1]) deps.add(inner[1].toLowerCase());
    }
  }
  return { path, ecosystem: "pip", dependencies: Array.from(deps) };
}

function parseGoMod(path: string, content: string): ManifestParsed {
  const deps = new Set<string>();
  let inBlock = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("require (")) inBlock = true;
    else if (line === ")") inBlock = false;
    else if (inBlock) {
      const m = line.match(/^([^\s]+)\s+v[\d.]+/);
      if (m && m[1]) deps.add(m[1]);
    } else {
      const m = line.match(/^require\s+([^\s]+)\s+v[\d.]+/);
      if (m && m[1]) deps.add(m[1]);
    }
  }
  return { path, ecosystem: "go", dependencies: Array.from(deps) };
}

function parseCargoToml(path: string, content: string): ManifestParsed {
  const deps = new Set<string>();
  let inDeps = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[dependencies") || line.startsWith("[dev-dependencies") || line.startsWith("[build-dependencies")) {
      inDeps = true;
      continue;
    }
    if (line.startsWith("[")) inDeps = false;
    if (!inDeps) continue;
    const m = line.match(/^([a-zA-Z0-9_\-]+)\s*=/);
    if (m && m[1]) deps.add(m[1]);
  }
  return { path, ecosystem: "cargo", dependencies: Array.from(deps) };
}

function parseGemfile(path: string, content: string): ManifestParsed {
  const deps = new Set<string>();
  for (const m of content.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)) {
    if (m[1]) deps.add(m[1]);
  }
  return { path, ecosystem: "rubygems", dependencies: Array.from(deps) };
}

function parsePubspec(path: string, content: string): ManifestParsed {
  try {
    const doc = YAML.parse(content) as { dependencies?: Record<string, unknown>; dev_dependencies?: Record<string, unknown> } | null;
    return {
      path,
      ecosystem: "pub",
      dependencies: Object.keys(doc?.dependencies ?? {}),
      devDependencies: Object.keys(doc?.dev_dependencies ?? {}),
    };
  } catch {
    return { path, ecosystem: "pub", dependencies: [] };
  }
}

function parseComposer(path: string, content: string): ManifestParsed {
  try {
    const json = JSON.parse(content) as { require?: Record<string, string>; "require-dev"?: Record<string, string> };
    return {
      path,
      ecosystem: "composer",
      dependencies: Object.keys(json.require ?? {}).filter((k) => !k.startsWith("php")),
      devDependencies: Object.keys(json["require-dev"] ?? {}),
    };
  } catch {
    return { path, ecosystem: "composer", dependencies: [] };
  }
}

function parsePomXml(path: string, content: string): ManifestParsed {
  const deps = new Set<string>();
  for (const m of content.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)) {
    if (m[1]) deps.add(m[1]);
  }
  return { path, ecosystem: "maven", dependencies: Array.from(deps) };
}

function parseGradle(path: string, content: string): ManifestParsed {
  const deps = new Set<string>();
  for (const m of content.matchAll(/(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*[\(\s]+["']([^"':]+):([^"':]+):/g)) {
    if (m[2]) deps.add(m[2]);
  }
  return { path, ecosystem: "gradle", dependencies: Array.from(deps) };
}
