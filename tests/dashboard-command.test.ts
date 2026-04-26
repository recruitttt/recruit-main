import assert from "node:assert/strict";

import { POST as postDashboardCommand } from "../app/api/dashboard/command/route";
import { parseDashboardCommand } from "../lib/dashboard-command/model";
import { assertJsonResponse, installFetchStub, jsonRequest, withEnvAsync } from "./helpers";

async function main() {
  assert.deepEqual(
    parseDashboardCommand(`\`\`\`json
{"intent":"clear","answer":"Cleared filters.","filters":[],"reorder":null,"explanations":[],"suggestedChips":[]}
\`\`\``),
    {
      ok: true,
      value: {
        intent: "clear",
        answer: "Cleared filters.",
        filters: [],
        reorder: null,
        explanations: [],
        suggestedChips: [],
      },
    },
  );
  assert.deepEqual(
    parseDashboardCommand(`Reasoning with a distracting example {"intent":"unknown"}.
</think>
{"intent":"summarize","answer":"Board shows one Acme role."}`),
    {
      ok: true,
      value: {
        intent: "summarize",
        answer: "Board shows one Acme role.",
        filters: [],
        reorder: null,
        explanations: [],
        suggestedChips: [],
      },
    },
  );
  assert.deepEqual(
    parseDashboardCommand(
      `{"intent":"summarize","answer":"Board shows one Acme role.","reorder":{"jobIds":[],"reason":""}}`,
    ),
    {
      ok: true,
      value: {
        intent: "summarize",
        answer: "Board shows one Acme role.",
        filters: [],
        reorder: null,
        explanations: [],
        suggestedChips: [],
      },
    },
  );

  await withEnvAsync(
    {
      K2_API_KEY: undefined,
      K2_THINK_API_KEY: undefined,
      K2THINK_API_KEY: undefined,
      K2_BASE_URL: undefined,
      K2_THINK_BASE_URL: undefined,
      K2THINK_BASE_URL: undefined,
      K2_MODEL: undefined,
      K2_THINK_MODEL: undefined,
      K2THINK_MODEL: undefined,
      OPENAI_API_KEY: undefined,
      AI_GATEWAY_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
  },
  async () => {
    const json = await assertJsonResponse(
      await postDashboardCommand(jsonRequest({
        prompt: "show remote jobs",
        context: {
          jobs: [
            { jobId: "job_1", company: "Acme", title: "Remote AI Engineer", location: "Remote", score: 88 },
          ],
        },
      })),
      200,
      { ok: true },
    );
    assert.equal((json.model as { provider?: string }).provider, "demo");
    assert.equal((json.command as { intent?: string }).intent, "filter");
  },
);

  await withEnvAsync(
    {
      K2_API_KEY: undefined,
      K2_THINK_API_KEY: undefined,
      K2THINK_API_KEY: undefined,
      K2_BASE_URL: undefined,
      K2_THINK_BASE_URL: undefined,
      K2THINK_BASE_URL: undefined,
      K2_MODEL: undefined,
      K2_THINK_MODEL: undefined,
      K2THINK_MODEL: undefined,
      OPENAI_API_KEY: undefined,
      AI_GATEWAY_API_KEY: undefined,
      ANTHROPIC_API_KEY: "anthropic_should_not_be_used",
    },
    async () => {
      const json = await assertJsonResponse(
        await postDashboardCommand(jsonRequest({
          prompt: "summarize the board",
          context: {
            jobs: [{ jobId: "job_1", company: "Acme", title: "AI Engineer", score: 88 }],
          },
        })),
        200,
        { ok: true },
      );
      assert.equal((json.model as { provider?: string }).provider, "demo");
      assert.notEqual((json.model as { provider?: string }).provider, "anthropic");
    },
  );

  await withEnvAsync(
    {
      K2_API_KEY: undefined,
      K2_THINK_API_KEY: undefined,
      K2THINK_API_KEY: undefined,
      K2_BASE_URL: undefined,
      K2_THINK_BASE_URL: undefined,
      K2THINK_BASE_URL: undefined,
      K2_MODEL: undefined,
      K2_THINK_MODEL: undefined,
      K2THINK_MODEL: undefined,
      OPENAI_API_KEY: undefined,
      AI_GATEWAY_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    },
    async () => {
      const json = await assertJsonResponse(
        await postDashboardCommand(jsonRequest({
          prompt: "I hate google, let's remove the google options.",
          context: {
            jobs: [
              { jobId: "job_google", company: "Google DeepMind", title: "Staff Software Engineer", score: 97 },
              { jobId: "job_apple", company: "Apple", title: "Machine Learning Engineer", score: 96 },
            ],
          },
        })),
        200,
        { ok: true },
      );
      const command = json.command as {
        filters?: Array<{ field?: string; op?: string; value?: string }>;
        reorder?: { jobIds?: string[] } | null;
        answer?: string;
      };
      assert.deepEqual(command.filters, [
        { field: "company", op: "not_contains", value: "google", label: "Hide Google" },
      ]);
      assert.deepEqual(command.reorder?.jobIds, ["job_apple"]);
      assert.match(command.answer ?? "", /Hide Google/);
      assert.doesNotMatch(command.answer ?? "", /put Google/i);
    },
  );

  await withEnvAsync(
    {
      K2_API_KEY: "k2_test",
      K2_BASE_URL: "https://k2.test/v1",
      K2_MODEL: "k2-think-v2",
      OPENAI_API_KEY: undefined,
      AI_GATEWAY_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    },
    async () => {
      const restoreFetch = installFetchStub(async (input, init) => {
        assert.equal(input, "https://k2.test/v1/chat/completions");
        const payload = JSON.parse(String(init?.body)) as {
          model?: string;
          messages?: unknown[];
          chat_template_kwargs?: { reasoning_effort?: string };
        };
        assert.equal(payload.model, "k2-think-v2");
        assert.ok(Array.isArray(payload.messages));
        assert.equal("response_format" in payload, false);
        assert.equal(payload.chat_template_kwargs?.reasoning_effort, "high");

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "reorder",
                    answer: "Putting the strongest AI role first.",
                    filters: [],
                    reorder: { jobIds: ["job_2", "job_1"], reason: "AI fit and score" },
                    explanations: [
                      { jobId: "job_2", summary: "Best AI fit.", evidence: ["Strength includes agents"] },
                    ],
                    suggestedChips: ["Explain top fit"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      try {
        const json = await assertJsonResponse(
          await postDashboardCommand(
            jsonRequest({
              prompt: "rank for AI infra",
              context: {
                jobs: [
                  { jobId: "job_1", company: "Acme", title: "Backend Engineer", score: 82 },
                  { jobId: "job_2", company: "Northstar", title: "AI Infra Engineer", score: 94 },
                ],
              },
            }),
          ),
          200,
          { ok: true },
        );

        assert.deepEqual((json.command as { reorder?: { jobIds?: string[] } }).reorder?.jobIds, ["job_2", "job_1"]);
        assert.deepEqual(json.model, { provider: "k2", modelId: "k2-think-v2", fallbackUsed: false });
        assert.deepEqual(json.sponsor, {
          name: "K2 Think V2",
          provider: "K2",
          placement: "dashboard-command-bar",
          active: true,
        });
      } finally {
        restoreFetch();
      }
    },
  );

  await withEnvAsync(
    {
      K2_API_KEY: "k2_test",
      K2_BASE_URL: "https://k2.test/v1",
      K2_MODEL: "k2-think-v2",
      K2_THINK_API_KEY: undefined,
      K2THINK_API_KEY: undefined,
      OPENAI_API_KEY: "openai_should_not_be_used",
      AI_GATEWAY_API_KEY: "gateway_should_not_be_used",
      ANTHROPIC_API_KEY: undefined,
    },
    async () => {
      const restoreFetch = installFetchStub(async () =>
        new Response(
          JSON.stringify({ error: { message: "k2 unavailable" } }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        )
      );

      try {
        const json = await assertJsonResponse(
          await postDashboardCommand(
            jsonRequest({
              prompt: "rank this board",
              context: {
                jobs: [{ jobId: "job_1", company: "Acme", title: "AI Engineer", score: 88 }],
              },
            }),
          ),
          502,
          { ok: false, reason: "k2 unavailable" },
        );
        assert.deepEqual(json.providerAttempts, [{ provider: "k2", reason: "k2 unavailable" }]);
      } finally {
        restoreFetch();
      }
    },
  );

  await withEnvAsync(
    {
      K2_API_KEY: "k2_test",
      K2_BASE_URL: "https://k2.test/v1",
      K2_MODEL: "k2-think-v2",
      K2_THINK_API_KEY: undefined,
      K2THINK_API_KEY: undefined,
      ANTHROPIC_API_KEY: "anthropic_test",
      ANTHROPIC_BASE_URL: undefined,
      ANTHROPIC_DASHBOARD_COMMAND_MODEL: undefined,
      CLAUDE_DASHBOARD_COMMAND_MODEL: undefined,
      OPENAI_API_KEY: "openai_should_not_be_used",
      AI_GATEWAY_API_KEY: "gateway_should_not_be_used",
    },
    async () => {
      const calls: string[] = [];
      const restoreFetch = installFetchStub(async (input, init) => {
        calls.push(String(input));
        if (String(input) === "https://k2.test/v1/chat/completions") {
          return new Response(
            JSON.stringify({ error: { message: "k2 unavailable" } }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        assert.equal(input, "https://api.anthropic.com/v1/messages");
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers["x-api-key"], "anthropic_test");
        const payload = JSON.parse(String(init?.body)) as {
          model?: string;
          system?: string;
          messages?: Array<{ role?: string }>;
        };
        assert.equal(payload.model, "claude-haiku-4-5");
        assert.match(payload.system ?? "", /Recruit dashboard command model/);
        assert.deepEqual(payload.messages?.map((message) => message.role), ["user"]);

        return new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  intent: "reorder",
                  answer: "Putting the strongest AI role first.",
                  filters: [],
                  reorder: { jobIds: ["job_2", "job_1"], reason: "AI fit and score" },
                  explanations: [],
                  suggestedChips: [],
                }),
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      try {
        const json = await assertJsonResponse(
          await postDashboardCommand(
            jsonRequest({
              prompt: "rank for AI infra",
              context: {
                jobs: [
                  { jobId: "job_1", company: "Acme", title: "Backend Engineer", score: 82 },
                  { jobId: "job_2", company: "Northstar", title: "AI Infra Engineer", score: 94 },
                ],
              },
            }),
          ),
          200,
          { ok: true },
        );

        assert.deepEqual(calls, [
          "https://k2.test/v1/chat/completions",
          "https://api.anthropic.com/v1/messages",
        ]);
        assert.deepEqual((json.command as { reorder?: { jobIds?: string[] } }).reorder?.jobIds, ["job_2", "job_1"]);
        assert.deepEqual(json.model, {
          provider: "anthropic",
          modelId: "anthropic/claude-haiku-4-5",
          fallbackUsed: true,
        });
        assert.deepEqual(json.sponsor, {
          name: "K2 Think V2",
          provider: "K2",
          placement: "dashboard-command-bar",
          active: false,
        });
      } finally {
        restoreFetch();
      }
    },
  );

  await withEnvAsync(
    {
      K2_API_KEY: undefined,
      K2_THINK_API_KEY: undefined,
      K2THINK_API_KEY: "k2think_test",
      K2_BASE_URL: undefined,
      K2_THINK_BASE_URL: undefined,
      K2THINK_BASE_URL: undefined,
      K2_MODEL: undefined,
      K2_THINK_MODEL: undefined,
      K2THINK_MODEL: undefined,
      OPENAI_API_KEY: undefined,
      AI_GATEWAY_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    },
    async () => {
      const restoreFetch = installFetchStub(async (input, init) => {
        assert.equal(input, "https://api.k2think.ai/v1/chat/completions");
        const payload = JSON.parse(String(init?.body)) as {
          model?: string;
          chat_template_kwargs?: { reasoning_effort?: string };
        };
        assert.equal(payload.model, "MBZUAI-IFM/K2-Think-v2");
        assert.equal(payload.chat_template_kwargs?.reasoning_effort, "high");

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "summarize",
                    answer: "The board has a clear top role.",
                    filters: [],
                    reorder: null,
                    explanations: [],
                    suggestedChips: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      try {
        const json = await assertJsonResponse(
          await postDashboardCommand(
            jsonRequest({
              prompt: "summarize the board",
              context: {
                jobs: [{ jobId: "job_1", company: "Acme", title: "AI Engineer", score: 88 }],
              },
            }),
          ),
          200,
          { ok: true },
        );

        assert.deepEqual(json.model, {
          provider: "k2",
          modelId: "MBZUAI-IFM/K2-Think-v2",
          fallbackUsed: false,
        });
      } finally {
        restoreFetch();
      }
    },
  );

  await withEnvAsync(
    {
      K2_API_KEY: "k2_test",
      K2_BASE_URL: "https://k2.test/v1",
      K2_MODEL: "k2-think-v2",
      K2_THINK_API_KEY: undefined,
      K2THINK_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      AI_GATEWAY_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    },
    async () => {
      let calls = 0;
      const restoreFetch = installFetchStub(async () => {
        calls += 1;
        const content = calls === 1
          ? "I should reorder this board without JSON."
          : JSON.stringify({
              intent: "reorder",
              answer: "Recovered valid JSON.",
              filters: [],
              reorder: { jobIds: ["job_1"], reason: "Only visible role." },
              explanations: [],
              suggestedChips: [],
            });

        return new Response(
          JSON.stringify({ choices: [{ message: { content } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      try {
        const json = await assertJsonResponse(
          await postDashboardCommand(
            jsonRequest({
              prompt: "rank this board",
              context: {
                jobs: [{ jobId: "job_1", company: "Acme", title: "AI Engineer", score: 88 }],
              },
            }),
          ),
          200,
          { ok: true },
        );

        assert.equal(calls, 2);
        assert.equal((json.command as { answer?: string }).answer, "Recovered valid JSON.");
      } finally {
        restoreFetch();
      }
    },
  );

  console.log("Dashboard command tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
