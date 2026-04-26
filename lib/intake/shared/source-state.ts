export type SourceRunLike = {
  status?: string | null;
} | null | undefined;

export type SourceConnectionStatus =
  | "loading"
  | "not-connected"
  | "saved"
  | "connected"
  | "processing"
  | "done"
  | "failed";

export type GithubConnectionLike = {
  github?: {
    linked?: boolean | null;
    hasAccessToken?: boolean | null;
  } | null;
} | null | undefined;

export function isActiveSourceRun(run: SourceRunLike): boolean {
  if (!run?.status) return false;
  return run.status !== "completed" && run.status !== "failed";
}

export function canStartSourceRun(run: SourceRunLike): boolean {
  return !isActiveSourceRun(run);
}

export function isGithubConnected(connection: GithubConnectionLike): boolean {
  return Boolean(connection?.github?.linked && connection.github.hasAccessToken);
}

export function shouldAutoStartGithubIntake({
  connected,
  run,
  hasImportedGithub,
}: {
  connected: boolean;
  run: SourceRunLike;
  hasImportedGithub?: boolean;
}): boolean {
  if (!connected) return false;
  if (!run) return true;
  if (isActiveSourceRun(run)) return false;
  if (run.status === "failed") return true;
  if (run.status === "completed" && hasImportedGithub === false) return true;
  return false;
}

export function getSourceConnectionStatus({
  loading = false,
  connected = false,
  saved = false,
  run,
}: {
  loading?: boolean;
  connected?: boolean;
  saved?: boolean;
  run?: SourceRunLike;
}): SourceConnectionStatus {
  if (loading) return "loading";
  if (run?.status === "queued" || run?.status === "running") {
    return "processing";
  }
  if (run?.status === "completed") return "done";
  if (run?.status === "failed") return "failed";
  if (connected) return "connected";
  if (saved) return "saved";
  return "not-connected";
}

export function normalizeLinkedinProfileUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function isLinkedinProfileUrl(input: string): boolean {
  try {
    const url = new URL(normalizeLinkedinProfileUrl(input));
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "linkedin.com" || host === "www.linkedin.com") &&
      url.pathname.toLowerCase().startsWith("/in/")
    );
  } catch {
    return false;
  }
}
