// Client-side helpers that POST to the SSE intake routes (resume + linkedin)
// and drain the response body so the route handler stays alive through the
// full pipeline. The byUserKind Convex subscription surfaces individual
// events to the UI; we don't read them here.

interface ResumeIntakeInput {
  fileId: string;
  filename?: string;
}

export async function streamResumeIntake(
  input: ResumeIntakeInput,
): Promise<void> {
  const response = await fetch("/api/intake/resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`resume_intake_${response.status}: ${text || "no body"}`);
  }
  const reader = response.body?.getReader();
  if (!reader) return;
  while (!(await reader.read()).done) {
    /* keep draining */
  }
}

export async function startLinkedinIntake(
  profileUrl: string,
): Promise<{ drain: Promise<void> }> {
  const response = await fetch("/api/intake/linkedin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileUrl }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `linkedin_route_${response.status}: ${text || response.statusText}`,
    );
  }

  return { drain: drainLinkedinIntake(response) };
}

async function drainLinkedinIntake(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  try {
    while (!(await reader.read()).done) {
      /* keep draining */
    }
  } finally {
    reader.releaseLock();
  }
}
