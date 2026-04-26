import { handler } from "@/lib/auth-server";

export const GET = handler.GET;

function friendlyAuthFailure(request: Request) {
  const pathname = new URL(request.url).pathname;

  if (pathname.endsWith("/sign-in/email")) {
    return Response.json(
      {
        error: {
          code: "invalid_credentials",
          message: "No account matched that email and password. Create an account first or try again.",
        },
      },
      { status: 401 },
    );
  }

  if (pathname.endsWith("/sign-up/email")) {
    return Response.json(
      {
        error: {
          code: "signup_failed",
          message: "Unable to create the account. Check the details and try again.",
        },
      },
      { status: 400 },
    );
  }

  return Response.json(
    {
      error: {
        code: "auth_unavailable",
        message: "Authentication is unavailable right now. Try again in a minute.",
      },
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  try {
    return await handler.POST(request);
  } catch (error) {
    console.error("Auth route failed", error);
    return friendlyAuthFailure(request);
  }
}
