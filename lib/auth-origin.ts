type EnvLike = Pick<NodeJS.ProcessEnv, string>;

export function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function splitCsv(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

export function originFromRequest(request?: Request | null) {
  if (!request) return null;

  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ||
    firstHeaderValue(request.headers.get("host"));
  if (!host || /[\/\\]/.test(host)) return null;

  const forwardedProto = firstHeaderValue(
    request.headers.get("x-forwarded-proto")
  );
  const requestProto = (() => {
    try {
      return new URL(request.url).protocol.replace(/:$/, "");
    } catch {
      return "";
    }
  })();
  const proto = /^(https?|HTTPS?)$/.test(forwardedProto)
    ? forwardedProto.toLowerCase()
    : /^(https?|HTTPS?)$/.test(requestProto)
      ? requestProto.toLowerCase()
      : "https";

  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

export function hostPatternFromOriginPattern(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim();
  }
}

export function buildTrustedOrigins(
  defaultAppOrigin: string,
  request?: Request | null,
  env: EnvLike = process.env
) {
  return unique([
    stripTrailingSlash(defaultAppOrigin),
    originFromRequest(request),
    "http://localhost:3000",
    "http://localhost:3020",
    ...splitCsv(env.ADDITIONAL_TRUSTED_ORIGINS).map(stripTrailingSlash),
  ]);
}

export function buildAllowedHosts(
  defaultAppOrigin: string,
  env: EnvLike = process.env
) {
  return unique([
    "localhost:*",
    "127.0.0.1:*",
    ...buildTrustedOrigins(defaultAppOrigin, null, env).map(
      hostPatternFromOriginPattern
    ),
    ...splitCsv(env.AUTH_ALLOWED_HOSTS),
  ]);
}
