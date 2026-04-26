import assert from "node:assert/strict";

import { GET as completeOAuth } from "../app/api/auth/complete-oauth/route";
import { responseFromAuthUpstream } from "../lib/auth-proxy";
import {
  authErrorMessage,
  authNewUserRedirectPath,
  authSuccessRedirectPath,
  buildOAuthCompletionURL,
  safeRedirectPath,
} from "../lib/auth-flow";
import { installFetchStub, withEnvAsync } from "./helpers";

async function main() {
  assert.equal(
    authErrorMessage("sign-up", {
      message: "User already exists. Use another email.",
      code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    }),
    "An account already exists for that email. Sign in instead."
  );

  assert.equal(safeRedirectPath("/onboarding?step=2"), "/onboarding?step=2");
  assert.equal(safeRedirectPath("https://evil.example/callback"), "/dashboard");
  assert.equal(safeRedirectPath("//evil.example/callback"), "/dashboard");

  assert.equal(
    buildOAuthCompletionURL("http://localhost:3000", "/onboarding?step=2"),
    "http://localhost:3000/api/auth/complete-oauth?redirect=%2Fonboarding%3Fstep%3D2"
  );
  assert.equal(
    buildOAuthCompletionURL("http://localhost:3000", "/onboarding?step=2&auth=github"),
    "http://localhost:3000/api/auth/complete-oauth?redirect=%2Fonboarding%3Fstep%3D2%26auth%3Dgithub"
  );

  assert.equal(authSuccessRedirectPath("sign-in", null), "/dashboard");
  assert.equal(authSuccessRedirectPath("sign-up", null), "/onboarding?step=2");
  assert.equal(
    authSuccessRedirectPath("sign-in", "/onboarding?step=2"),
    "/onboarding?step=2"
  );
  assert.equal(
    authSuccessRedirectPath("sign-in", "https://evil.example/callback"),
    "/dashboard"
  );
  assert.equal(authNewUserRedirectPath("sign-in", null), "/onboarding?step=2");
  assert.equal(authNewUserRedirectPath("sign-up", null), "/onboarding?step=2");
  assert.equal(
    authNewUserRedirectPath("sign-in", "/dashboard"),
    "/dashboard"
  );

  let streamPulled = 0;
  const proxied = await responseFromAuthUpstream(
    new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          streamPulled += 1;
          controller.enqueue(new TextEncoder().encode("proxied-auth-body"));
          controller.close();
        },
      }),
      {
        status: 202,
        statusText: "Accepted",
        headers: {
          "content-type": "application/json",
          "x-auth-test": "kept",
          "set-cookie":
            "better-auth.session_token=session-token.signed; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax",
        },
      }
    ),
    "https"
  );
  assert.equal(streamPulled, 1);
  assert.equal(proxied.status, 202);
  assert.equal(proxied.statusText, "Accepted");
  assert.equal(proxied.headers.get("x-auth-test"), "kept");
  assert.match(
    proxied.headers.get("set-cookie") ?? "",
    /better-auth\.session_token=session-token\.signed/
  );
  assert.equal(await proxied.text(), "proxied-auth-body");

  await withEnvAsync(
    {
      NEXT_PUBLIC_CONVEX_SITE_URL: "https://convex.example",
      NEXT_PUBLIC_CONVEX_URL: undefined,
    },
    async () => {
      const observed: { request?: Request } = {};
      const restoreFetch = installFetchStub(async (request, init) => {
        observed.request =
          request instanceof Request ? request : new Request(request, init);
        return new Response(JSON.stringify({ session: { token: "session-token" } }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie":
              "better-auth.session_token=session-token.signed; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax",
          },
        });
      });

      try {
        const response = await completeOAuth(
          new Request(
            "http://localhost:3000/api/auth/complete-oauth?ott=ott-token&redirect=%2Fonboarding%3Fstep%3D2"
          )
        );

        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), "/onboarding?step=2");
        assert.match(
          response.headers.get("set-cookie") ?? "",
          /better-auth\.session_token=session-token\.signed/
        );
        const observedRequest = observed.request;
        assert.ok(observedRequest);
        assert.equal(
          observedRequest.url,
          "https://convex.example/api/auth/cross-domain/one-time-token/verify"
        );
        assert.equal(observedRequest.headers.get("x-forwarded-host"), "localhost:3000");
        assert.equal(observedRequest.headers.get("x-forwarded-proto"), "http");
        assert.deepEqual(await observedRequest.json(), { token: "ott-token" });
      } finally {
        restoreFetch();
      }
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
