export type SourceRunLike = {
  status?: string | null;
} | null;

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
}: {
  connected: boolean;
  run: SourceRunLike;
}): boolean {
  return connected && !run;
}
