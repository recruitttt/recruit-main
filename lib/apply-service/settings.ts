import type { ApplyMode, ApplyServiceSettings, ComputerUseModel } from "./types";

export const MAX_APPLICATIONS_PER_RUN = 20;
export const MAX_CONCURRENT_APPLICATIONS = 20;

export const DEFAULT_APPLY_SERVICE_SETTINGS: ApplyServiceSettings = {
  maxApplicationsPerRun: 20,
  maxConcurrentApplications: 10,
  maxConcurrentPerDomain: 20,
  mode: "auto-strict",
  computerUseModel: "gpt-5.4-nano",
  devSkipRealSubmit: true,
};

export function normalizeApplyMode(value: unknown): ApplyMode | null {
  if (value === "manual") return "manual";
  if (value === "auto" || value === "auto-strict" || value === "auto-passive") {
    return "auto-strict";
  }
  if (value === "auto-aggressive") return "auto-aggressive";
  if (value === "hands-free" || value === "hands_free" || value === "autonomous") {
    return "hands-free";
  }
  return null;
}

export function normalizeComputerUseModel(value: unknown): ComputerUseModel | null {
  if (value === "gpt-5.4-nano" || value === "nano") return "gpt-5.4-nano";
  if (value === "gpt-5.4-mini" || value === "mini" || value === "gpt-5.4") {
    return "gpt-5.4-mini";
  }
  if (
    value === "claude-sonnet-4-6" ||
    value === "sonnet" ||
    value === "sonnet-4.6" ||
    value === "sonic-4.6"
  ) {
    return "claude-sonnet-4-6";
  }
  return null;
}

export function readApplyServiceSettings(raw: unknown, modeRaw?: unknown): ApplyServiceSettings {
  const obj = isRecord(raw) ? raw : {};
  const requestedMode = modeRaw ?? obj.mode ?? obj.defaultMode;
  const mode = normalizeApplyMode(requestedMode) ?? DEFAULT_APPLY_SERVICE_SETTINGS.mode;
  const maxApplicationsPerRun = clampInt(
    obj.maxApplicationsPerRun,
    1,
    MAX_APPLICATIONS_PER_RUN,
    DEFAULT_APPLY_SERVICE_SETTINGS.maxApplicationsPerRun,
  );
  const maxConcurrentApplications = clampInt(
    obj.maxConcurrentApplications,
    1,
    MAX_CONCURRENT_APPLICATIONS,
    DEFAULT_APPLY_SERVICE_SETTINGS.maxConcurrentApplications,
  );
  const maxConcurrentPerDomain = clampInt(
    obj.maxConcurrentPerDomain,
    1,
    MAX_CONCURRENT_APPLICATIONS,
    Math.max(maxConcurrentApplications, DEFAULT_APPLY_SERVICE_SETTINGS.maxConcurrentPerDomain),
  );
  return {
    maxApplicationsPerRun,
    maxConcurrentApplications,
    maxConcurrentPerDomain: Math.max(maxConcurrentApplications, maxConcurrentPerDomain),
    mode,
    computerUseModel:
      normalizeComputerUseModel(obj.computerUseModel ?? obj.fillerModel) ??
      DEFAULT_APPLY_SERVICE_SETTINGS.computerUseModel,
    devSkipRealSubmit:
      typeof obj.devSkipRealSubmit === "boolean"
        ? obj.devSkipRealSubmit
        : parseBooleanEnv(process.env.DEV_SKIP_REAL_SUBMIT, DEFAULT_APPLY_SERVICE_SETTINGS.devSkipRealSubmit),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return !/^(0|false|off|no)$/i.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
