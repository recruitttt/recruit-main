import {
  blockedSubmissionEvidence,
  buildAshbyProfileAnswers,
  buildAshbyQuestionNodes,
  buildAshbyResolutionPlan,
  buildProfilePreflightIssues,
  buildRunGrade,
  classifySubmissionSnapshot,
  detectConfirmationTexts,
  detectUnexpectedVerificationGate,
  evaluateSubmitReadiness,
  normalizeAshbyText,
  profilePreflightBlockers,
  validateDirectAshbyApplicationUrl,
} from "./core";
import { draftAshbyAnswersWithOpenAI } from "./llm";
import type {
  AshbyApprovedAnswer,
  AshbyBlocker,
  AshbyControlKind,
  AshbyFieldObservation,
  AshbyFillOperation,
  AshbyFillTarget,
  AshbyFormSnapshot,
  AshbyPromptAlias,
  AshbyPreflightMode,
  AshbyProfilePreflightIssue,
  AshbyQuestionNode,
  AshbyResolutionPlan,
  AshbySubmissionEvidence,
} from "./types";

export type AshbyPageLike = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForSelector(selector: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForTimeout?(timeoutMs: number): Promise<void>;
  setViewport?(viewport: { width: number; height: number }): Promise<void>;
  evaluate<TArg, TResult>(
    pageFunction: (arg: TArg) => TResult | Promise<TResult>,
    arg: TArg
  ): Promise<TResult>;
  $?(selector: string): Promise<AshbyElementLike | null>;
  screenshot?(options?: Record<string, unknown>): Promise<Uint8Array | Buffer | string>;
  keyboard?: {
    press(key: string, options?: Record<string, unknown>): Promise<void>;
  };
  url(): string;
};

export type AshbyElementLike = {
  uploadFile?(...paths: string[]): Promise<void>;
  click?(options?: Record<string, unknown>): Promise<void>;
  type?(text: string, options?: Record<string, unknown>): Promise<void>;
  dispose?(): Promise<void>;
};

export type AshbyFormFillResult = {
  provider: "ashby";
  targetUrl: string;
  finalUrl: string | null;
  organizationSlug: string;
  submitAttempted: boolean;
  submitCompleted: boolean;
  outcome: AshbySubmissionEvidence["outcome"];
  submissionEvidence: AshbySubmissionEvidence;
  plan: AshbyResolutionPlan;
  fillOperations: AshbyFillOperation[];
  blockers: AshbyBlocker[];
  needsUserAnswers: AshbyProfilePreflightIssue[];
  preUploadSnapshot: AshbyFormSnapshot;
  postUploadSnapshot: AshbyFormSnapshot;
  finalSnapshot: AshbyFormSnapshot;
  runGrade: ReturnType<typeof buildRunGrade>;
  screenshots: Array<{ label: string; captured: boolean; byteLength?: number; error?: string }>;
  notes: string[];
  errors: Array<{ where: string; message: string }>;
};

export async function runAshbyFormFillOnPage(
  page: AshbyPageLike,
  args: {
    targetUrl: string;
    profile: unknown;
    aliases?: AshbyPromptAlias[];
    approvedAnswers?: AshbyApprovedAnswer[];
    openAiApiKey?: string | null;
    openAiModel?: string;
    openAiBestEffort?: boolean;
    draftAnswerMode?: "review_only" | "fill";
    preflightMode?: AshbyPreflightMode;
    submit?: boolean;
  }
): Promise<AshbyFormFillResult> {
  const { normalizedUrl, organizationSlug } = validateDirectAshbyApplicationUrl(args.targetUrl);
  const notes: string[] = [];
  const errors: Array<{ where: string; message: string }> = [];
  const screenshots: AshbyFormFillResult["screenshots"] = [];
  const profileAnswers = buildAshbyProfileAnswers(args.profile);

  await page.setViewport?.({ width: 1365, height: 900 });
  try {
    await page.goto(normalizedUrl, { waitUntil: "networkidle2", timeout: 45_000 });
  } catch (error) {
    notes.push(`goto_networkidle_failed=${safeMessage(error)}`);
    await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  }

  await waitForAshbyHydration(page, notes);
  const preUploadSnapshot = await inspectAshbyPage(page);
  screenshots.push(await screenshotMetadata(page, "pre-upload"));

  const preUploadPlan = buildAshbyResolutionPlan({
    snapshot: preUploadSnapshot,
    profileAnswers,
    aliases: args.aliases,
    approvedAnswers: args.approvedAnswers,
    organizationSlug,
  });
  const preUploadFileOperations: AshbyFillOperation[] = [];
  for (const target of preUploadPlan.fill_targets.filter((item) => item.answer_kind === "file")) {
    const operation = await fillAshbyTarget(page, target);
    preUploadFileOperations.push(operation);
  }

  if (preUploadFileOperations.length > 0) {
    await waitForTimeout(page, 2500);
    notes.push("post_resume_upload_rediscovery=true");
  }

  const postUploadSnapshot = await inspectAshbyPage(page);
  let draftAnswers: Awaited<ReturnType<typeof draftAshbyAnswersWithOpenAI>>["answers"] = [];
  if (args.openAiBestEffort && args.openAiApiKey) {
    const initialPlan = buildAshbyResolutionPlan({
      snapshot: postUploadSnapshot,
      profileAnswers,
      aliases: args.aliases,
      approvedAnswers: args.approvedAnswers,
      organizationSlug,
    });
    const draftResult = await draftAshbyAnswersWithOpenAI({
      apiKey: args.openAiApiKey,
      model: args.openAiModel,
      profile: args.profile,
      organizationSlug,
      questions: postUploadSnapshot.questions.filter((question) =>
        initialPlan.pending_review.some((item) => item.prompt_hash === question.prompt_hash) ||
        initialPlan.missing_required.some((item) => item.key === question.prompt_hash)
      ),
    });
    draftAnswers = draftResult.answers;
    if (draftAnswers.length > 0) notes.push(`openai_draft_answers=${draftAnswers.length}`);
    for (const error of draftResult.errors) {
      errors.push({ where: "openai_draft_answers", message: error });
    }
  } else if (args.openAiBestEffort && !args.openAiApiKey) {
    notes.push("openai_draft_answers_skipped=no_api_key");
  }

  const plan = buildAshbyResolutionPlan({
    snapshot: postUploadSnapshot,
    profileAnswers,
    aliases: args.aliases,
    approvedAnswers: args.approvedAnswers,
    draftAnswers,
    draftAnswerMode: args.draftAnswerMode ?? "review_only",
    organizationSlug,
  });
  const needsUserAnswers = buildProfilePreflightIssues(plan.missing_required);
  const preflightMode = args.preflightMode ?? "block_before_fill";
  const submitAllowedByPreflight = needsUserAnswers.length === 0;

  if (args.submit === true && needsUserAnswers.length > 0 && preflightMode === "block_before_fill") {
    const evidence = blockedSubmissionEvidence(postUploadSnapshot);
    const blockers = profilePreflightBlockers(needsUserAnswers);
    const runGrade = buildRunGrade({
      snapshot: postUploadSnapshot,
      plan,
      fillOperations: preUploadFileOperations,
      submitReady: false,
    });
    return {
      provider: "ashby",
      targetUrl: normalizedUrl,
      finalUrl: page.url(),
      organizationSlug,
      submitAttempted: false,
      submitCompleted: false,
      outcome: evidence.outcome,
      submissionEvidence: evidence,
      plan,
      fillOperations: preUploadFileOperations,
      blockers,
      needsUserAnswers,
      preUploadSnapshot,
      postUploadSnapshot,
      finalSnapshot: postUploadSnapshot,
      runGrade,
      screenshots,
      notes: [...notes, `profile_preflight_missing=${needsUserAnswers.length}`],
      errors,
    };
  } else if (args.submit === true && needsUserAnswers.length > 0) {
    notes.push(`profile_preflight_submit_disabled=${needsUserAnswers.length}`);
  }

  const fillOperations: AshbyFillOperation[] = [...preUploadFileOperations];
  for (const target of plan.fill_targets) {
    if (
      target.answer_kind === "file" &&
      preUploadFileOperations.some((operation) => operation.key === target.canonical_key && operation.verified)
    ) {
      continue;
    }
    fillOperations.push(await fillAshbyTarget(page, target));
  }

  await waitForTimeout(page, 900);
  const finalSnapshotBeforeSubmit = await inspectAshbyPage(page);
  screenshots.push(await screenshotMetadata(page, "pre-submit"));
  const readiness = evaluateSubmitReadiness(
    fillOperations,
    plan.missing_required,
    plan.unsupported_required,
    plan.pending_review,
    finalSnapshotBeforeSubmit
  );
  const runGrade = buildRunGrade({
    snapshot: finalSnapshotBeforeSubmit,
    plan,
    fillOperations,
    submitReady: readiness.allowed,
  });

  if (!readiness.allowed || args.submit === false || !submitAllowedByPreflight) {
    const evidence = blockedSubmissionEvidence(finalSnapshotBeforeSubmit);
    return {
      provider: "ashby",
      targetUrl: normalizedUrl,
      finalUrl: page.url(),
      organizationSlug,
      submitAttempted: false,
      submitCompleted: false,
      outcome: evidence.outcome,
      submissionEvidence: evidence,
      plan,
      fillOperations,
      blockers: readiness.blockers,
      needsUserAnswers,
      preUploadSnapshot,
      postUploadSnapshot,
      finalSnapshot: finalSnapshotBeforeSubmit,
      runGrade,
      screenshots,
      notes,
      errors,
    };
  }

  let submitResult = await submitAshbyApplication(page);
  if (submitResult.evidence.outcome === "rejected_validation") {
    const repairResult = await repairValidationAndResubmit(page, {
      validationSnapshot: submitResult.snapshot,
      profileAnswers,
      aliases: args.aliases,
      approvedAnswers: args.approvedAnswers,
      draftAnswers,
      draftAnswerMode: args.draftAnswerMode ?? "review_only",
      organizationSlug,
    });
    if (repairResult.operations.length > 0) {
      fillOperations.push(...repairResult.operations);
      notes.push(`validation_repair_targets=${repairResult.operations.length}`);
      notes.push(`validation_repair_missing_labels=${repairResult.missingLabels.join(";")}`);
      submitResult = repairResult.submitResult;
    }
  }
  screenshots.push(await screenshotMetadata(page, "post-submit"));
  return {
    provider: "ashby",
    targetUrl: normalizedUrl,
    finalUrl: page.url(),
    organizationSlug,
    submitAttempted: submitResult.attempted,
    submitCompleted: submitResult.evidence.outcome === "confirmed",
    outcome: submitResult.evidence.outcome,
    submissionEvidence: submitResult.evidence,
    plan,
    fillOperations,
    blockers: submitResult.blockers,
    needsUserAnswers,
    preUploadSnapshot,
    postUploadSnapshot,
    finalSnapshot: submitResult.snapshot,
    runGrade,
    screenshots,
    notes,
    errors,
  };
}

function waitForTimeout(page: AshbyPageLike, timeoutMs: number): Promise<void> {
  return page.waitForTimeout?.(timeoutMs) ?? new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export async function inspectAshbyPage(page: AshbyPageLike): Promise<AshbyFormSnapshot> {
  await installEvaluateNameHelper(page);
  const snapshot = await page.evaluate(
    ({ confirmationPatterns, verificationPatterns }) => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const clean = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim();
      const isFileInput = (element: Element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && element.type === "file";
      const isChoiceInput = (element: Element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox");
      const isVisible = (element: Element | null | undefined): boolean => {
        if (!(element instanceof HTMLElement)) return false;
        if (isFileInput(element)) return true;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const unique = (values: Array<string | null | undefined>) => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const value of values) {
          const normalized = normalize(value);
          if (!normalized || seen.has(normalized)) continue;
          seen.add(normalized);
          result.push(clean(value));
        }
        return result;
      };
      const optionSignature = (values: string[]) => {
        const normalized = unique(values).map(normalize).filter(Boolean);
        return normalized.length > 0 ? normalized.join("|") : null;
      };
      const promptHash = (value: string | null | undefined) => {
        const normalized = normalize(value);
        if (!normalized) return null;
        let hash = 0;
        for (let index = 0; index < normalized.length; index += 1) {
          hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
        }
        return hash.toString(16).padStart(8, "0");
      };
      const cssEscape = (value: string) =>
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(value)
          : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
      const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      const selectorFor = (element: Element | null | undefined): string | null => {
        if (!(element instanceof HTMLElement)) return null;
        if (element.id) return `#${cssEscape(element.id)}`;
        const name = element.getAttribute("name");
        if (name) {
          const type = element.getAttribute("type");
          const typePart = type ? `[type=${quote(type)}]` : "";
          return `${element.tagName.toLowerCase()}${typePart}[name=${quote(name)}]`;
        }
        const dataTestId = element.getAttribute("data-testid");
        if (dataTestId) return `${element.tagName.toLowerCase()}[data-testid=${quote(dataTestId)}]`;
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label=${quote(ariaLabel)}]`;
        const placeholder = element.getAttribute("placeholder");
        if (placeholder) return `${element.tagName.toLowerCase()}[placeholder=${quote(placeholder)}]`;

        const parts: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body && parts.length < 6) {
          const tag = current.tagName.toLowerCase();
          const siblings = current.parentElement
            ? Array.from(current.parentElement.children).filter((candidate) => candidate.tagName === current!.tagName)
            : [];
          const index = siblings.indexOf(current) + 1;
          parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
          current = current.parentElement;
        }
        return parts.length > 0 ? parts.join(" > ") : null;
      };
      const controlKindFor = (element: Element): string => {
        if (element instanceof HTMLTextAreaElement) return "textarea";
        if (element instanceof HTMLSelectElement) return "select";
        if (element instanceof HTMLInputElement) {
          if (element.type === "email") return "email";
          if (element.type === "tel") return "tel";
          if (element.type === "radio") return "radio";
          if (element.type === "checkbox") return "checkbox";
          if (element.type === "file") return "file";
          if (["hidden", "submit", "button"].includes(element.type)) return "unsupported";
          return "text";
        }
        const role = element.getAttribute("role");
        if (role === "combobox" || role === "listbox") return "combobox";
        if (
          element instanceof HTMLButtonElement &&
          (element.getAttribute("aria-haspopup") === "listbox" || element.getAttribute("aria-expanded") !== null)
        ) {
          return "combobox";
        }
        return "unsupported";
      };
      const associatedLabel = (element: Element): string | null => {
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          if (element.labels && element.labels.length > 0) {
            return unique(Array.from(element.labels).map((label) => label.textContent))[0] ?? null;
          }
          if (element.id) {
            const label = document.querySelector(`label[for="${cssEscape(element.id)}"]`);
            if (label) return clean(label.textContent);
          }
        }
        const closestLabel = element.closest("label");
        return closestLabel ? clean(closestLabel.textContent) : null;
      };
      const promptFromContainer = (element: Element): string | null => {
        const fieldset = element.closest("fieldset");
        const legend = fieldset?.querySelector("legend");
        if (legend && isVisible(legend)) return clean(legend.textContent);

        const labelledBy = element.getAttribute("aria-labelledby");
        if (labelledBy) {
          const text = unique(labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent))[0];
          if (text) return text;
        }

        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) return clean(ariaLabel);

        const group =
          element.closest("[role='radiogroup'], [role='group'], fieldset, [data-testid*='field'], section") ??
          element.parentElement;
        if (group && isVisible(group)) {
          const candidates = Array.from(group.querySelectorAll("legend, label, h1, h2, h3, h4, p, strong, span, div"))
            .filter(isVisible)
            .map((node) => clean(node.textContent))
            .filter((text) => text.length > 0 && text.length < 240);
          const promptLike =
            candidates.find((text) => /[?*:]\s*$/.test(text)) ??
            candidates.find((text) =>
              /(authorized|sponsor|relocat|commute|consent|accept|linkedin|github|portfolio|resume|email|phone)/i.test(text)
            );
          if (promptLike) return promptLike;
        }

        const wrapper = element.closest("label, li, div");
        const previous = wrapper?.previousElementSibling;
        if (previous && isVisible(previous)) {
          const previousText = clean(previous.textContent);
          if (previousText && previousText.length < 240) return previousText;
        }
        return null;
      };
      const labelFor = (element: Element, controlKind: string): string | null => {
        if (controlKind === "radio" || controlKind === "checkbox") {
          return promptFromContainer(element) ?? associatedLabel(element);
        }
        return associatedLabel(element) ?? promptFromContainer(element);
      };
      const hasVisibleChoiceLabel = (element: Element) => {
        const label = associatedLabel(element);
        if (label) return true;
        const closestLabel = element.closest("label");
        if (closestLabel && isVisible(closestLabel)) return true;
        const group = element.closest("[role='radiogroup'], [role='group'], fieldset, [data-testid*='field'], section, div");
        return Boolean(group && isVisible(group));
      };
      const optionsFor = (element: Element, controlKind: string): string[] => {
        if (element instanceof HTMLSelectElement) {
          return unique(Array.from(element.options).map((option) => option.textContent));
        }
        if (element instanceof HTMLInputElement && (controlKind === "radio" || controlKind === "checkbox")) {
          const inputs = element.name
            ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="${element.type}"][name="${element.name.replace(/"/g, '\\"')}"]`))
            : [element];
          return unique(inputs.flatMap((input) => {
            const labels = input.labels ? Array.from(input.labels).map((label) => label.textContent) : [];
            return labels.length > 0 ? labels : [input.closest("label")?.textContent ?? input.value];
          }));
        }
        if (controlKind === "combobox") {
          const root = element.closest("[role='group'], fieldset, section, div") ?? element.parentElement;
          if (!root) return [];
          return unique(
            Array.from(root.querySelectorAll("label, button, li, option, span, div"))
              .filter(isVisible)
              .map((node) => clean(node.textContent))
              .filter((text) => text.length > 0 && text.length < 100)
          ).slice(0, 20);
        }
        return [];
      };
      const sectionFor = (element: Element): string | null => {
        const section = element.closest("fieldset, section, form, [role='group']");
        const heading = section?.querySelector("legend, h1, h2, h3, h4");
        return heading && isVisible(heading) ? clean(heading.textContent) : null;
      };
      const validationStateFor = (element: Element): "valid" | "invalid" | "unknown" => {
        if (element.getAttribute("aria-invalid") === "true" || element.closest("[aria-invalid='true']")) {
          return "invalid";
        }
        return "unknown";
      };
      const controls = Array.from(
        document.querySelectorAll("input, textarea, select, button, [role='combobox'], [role='listbox']")
      ).filter((element) => isVisible(element) || isFileInput(element) || (isChoiceInput(element) && hasVisibleChoiceLabel(element)));
      const seenGroups = new Set<string>();
      const fields: Array<Omit<AshbyFieldObservation, "control_kind"> & { control_kind: string }> = [];
      for (const element of controls) {
        const controlKind = controlKindFor(element);
        if (controlKind === "unsupported") continue;
        if (element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox")) {
          const label = labelFor(element, controlKind);
          const key = `${element.type}:${element.name || label || selectorFor(element) || "group"}`;
          if (seenGroups.has(key)) continue;
          seenGroups.add(key);
        }
        const label = labelFor(element, controlKind);
        const options = optionsFor(element, controlKind);
        const requiredText = [label, element.closest("[aria-required='true']")?.textContent].join(" ");
        fields.push({
          label,
          question_text: label,
          normalized_prompt: normalize(label),
          prompt_hash: promptHash(label),
          required:
            element.hasAttribute("required") ||
            element.getAttribute("aria-required") === "true" ||
            /\*/.test(label ?? "") ||
            /\brequired\b/i.test(requiredText),
          control_kind: controlKind,
          selector_hint: selectorFor(element),
          options,
          option_signature: optionSignature(options),
          section: sectionFor(element),
          supported: true,
          validation_state: validationStateFor(element),
          tag: element.tagName.toLowerCase(),
          input_type: element instanceof HTMLInputElement ? element.type : null,
          name:
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement
              ? element.name || null
              : null,
          id: element instanceof HTMLElement ? element.id || null : null,
          placeholder:
            element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
              ? element.placeholder || null
              : null,
          multiple:
            element instanceof HTMLSelectElement
              ? element.multiple
              : element instanceof HTMLInputElement
                ? Boolean(element.multiple)
                : false,
        });
      }
      const bodyText = clean(document.body?.innerText).slice(0, 2000);
      const normalizedBody = normalize(bodyText);
      const confirmationTexts = confirmationPatterns.filter((pattern) => normalizedBody.includes(normalize(pattern)));
      const unexpectedVerificationGate = verificationPatterns.some((pattern) => normalizedBody.includes(normalize(pattern)));
      const looksLikeConfirmation = (value: string) =>
        confirmationPatterns.some((pattern) => normalize(value).includes(normalize(pattern)));
      const validationErrors = unique([
        ...Array.from(
          document.querySelectorAll("[role='alert'], [aria-live], [data-testid*='error'], .error, .errors, .field-error")
        )
          .filter(isVisible)
          .map((node) => clean(node.textContent))
          .filter((text) => text && !looksLikeConfirmation(text)),
        ...bodyText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => /required|invalid|must be|enter a valid|spam/i.test(line))
          .filter((line) => !looksLikeConfirmation(line)),
      ]).slice(0, 20);
      const submitControls = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']"))
        .filter(isVisible)
        .filter((element) => /submit/i.test(element instanceof HTMLInputElement ? element.value : element.textContent ?? ""))
        .length;
      return {
        url: location.href,
        title: document.title || null,
        body_text_sample: bodyText,
        fields,
        validation_errors: validationErrors,
        confirmation_texts: confirmationTexts,
        submit_controls: submitControls,
        unexpected_verification_gate: unexpectedVerificationGate,
        notes: [`field_count=${fields.length}`],
      };
    },
    {
      confirmationPatterns: [
        "thank you for applying",
        "application submitted",
        "successfully submitted",
        "your application was successfully submitted",
        "we've received your application",
        "we have received your application",
        "your application has been submitted",
        "thanks for applying",
      ],
      verificationPatterns: [
        "verification code",
        "security code",
        "enter the code",
        "confirm you're a human",
        "captcha",
        "verify your email",
      ],
    }
  );

  const fields = snapshot.fields.map((field) => ({
    ...field,
    control_kind: coerceControlKind(field.control_kind),
    confirmation_texts: undefined,
  })) as AshbyFieldObservation[];
  const bodyText = snapshot.body_text_sample ?? "";
  return {
    ...snapshot,
    fields,
    confirmation_texts: snapshot.confirmation_texts.length > 0
      ? snapshot.confirmation_texts
      : detectConfirmationTexts(bodyText),
    unexpected_verification_gate:
      snapshot.unexpected_verification_gate || detectUnexpectedVerificationGate(bodyText),
    questions: buildAshbyQuestionNodes(fields),
  };
}

export async function fillAshbyTarget(
  page: AshbyPageLike,
  target: AshbyFillTarget
): Promise<AshbyFillOperation> {
  const blocking = Boolean(target.answer.blocking_if_missing || target.question.required);
  const selector = target.field.selector_hint ?? target.question.primary_selector;
  if (!target.value) {
    return operation(target.canonical_key, blocking ? "missing" : "skipped", selector, "missing_value", false, blocking);
  }
  if (!target.field.supported || target.field.control_kind === "unsupported") {
    return operation(target.canonical_key, blocking ? "blocked" : "skipped", selector, `unsupported_control:${target.field.control_kind}`, false, blocking);
  }
  if (!selector && target.answer_kind !== "file") {
    return operation(target.canonical_key, blocking ? "failed" : "skipped", null, "selector_not_found", false, blocking);
  }

  try {
    if (target.answer_kind === "file" || target.field.control_kind === "file") {
      return await fillFile(page, target, selector, blocking);
    }
    if (["text", "email", "tel", "textarea"].includes(target.field.control_kind)) {
      return await fillTextLike(page, target, selector!, blocking);
    }
    if (target.field.control_kind === "radio" || target.field.control_kind === "checkbox") {
      return await fillChoice(page, target, selector, blocking);
    }
    if (target.field.control_kind === "select" || target.field.control_kind === "combobox") {
      return await fillSelectLike(page, target, selector!, blocking);
    }
    return operation(target.canonical_key, blocking ? "blocked" : "skipped", selector, `unsupported_control:${target.field.control_kind}`, false, blocking);
  } catch (error) {
    return operation(target.canonical_key, "failed", selector, safeMessage(error), false, blocking);
  }
}

async function fillFile(
  page: AshbyPageLike,
  target: AshbyFillTarget,
  selector: string | null,
  blocking: boolean
): Promise<AshbyFillOperation> {
  if (!target.value.startsWith("/")) {
    return operation(target.canonical_key, blocking ? "missing" : "skipped", selector, "file_path_not_available", false, blocking);
  }
  const candidates = [selector, 'input[type="file"]'].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const handle = await page.$?.(candidate);
    if (!handle?.uploadFile) {
      await handle?.dispose?.();
      continue;
    }
    try {
      await handle.uploadFile(target.value);
      await handle.dispose?.();
      const verified = await verifyFile(page, candidate);
      return operation(target.canonical_key, verified ? "filled" : "failed", candidate, verified ? "uploaded" : "upload_not_visible", verified, blocking);
    } catch (error) {
      await handle.dispose?.();
      if (candidate === candidates[candidates.length - 1]) throw error;
    }
  }
  return operation(target.canonical_key, blocking ? "failed" : "skipped", selector, "file_input_not_found", false, blocking);
}

async function fillTextLike(
  page: AshbyPageLike,
  target: AshbyFillTarget,
  selector: string,
  blocking: boolean
): Promise<AshbyFillOperation> {
  await installEvaluateNameHelper(page);
  const fillValue =
    target.canonical_key === "salary_expectations"
      ? target.value.replace(/\D/g, "") || target.value
      : target.canonical_key === "earliest_start_date"
        ? formatDateForTextInput(target.value)
        : target.value;
  const result = await page.evaluate(
    ({ selector, value, rawValue }) => {
      const element = document.querySelector(selector);
      if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement)
      ) {
        return { ok: false, value: null, reason: "text_control_not_found" };
      }
      const nextValue =
        element instanceof HTMLInputElement && element.type === "date"
          ? rawValue
          : value;
      element.focus();
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      valueSetter?.call(element, nextValue);
      element.dispatchEvent(new Event("beforeinput", { bubbles: true }));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.blur();
      return { ok: element.value.trim().length > 0, value: element.value, reason: null };
    },
    {
      selector,
      value: target.canonical_key === "current_location_display" ? locationQueryValue(target.value) : fillValue,
      rawValue: target.value,
    }
  );
  if (result.ok && target.canonical_key === "current_location_display") {
    await typeAndCommitAutocompleteChoice(page, selector, locationQueryValue(target.value));
  }
  if (result.ok && target.canonical_key === "earliest_start_date") {
    await waitForTimeout(page, 250);
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
      document.body?.click();
    }, undefined);
  }
  const finalValue = await page.evaluate(
    ({ selector }) => {
      const element = document.querySelector(selector);
      return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? element.value
        : null;
    },
    { selector }
  );
  const actualValue = finalValue ?? result.value;
  const verified = Boolean(
    result.ok &&
    (target.canonical_key === "current_location_display"
      ? locationValueMatches(actualValue, target.value)
      : textValueMatches(actualValue, target.value))
  );
  return operation(
    target.canonical_key,
    verified ? "filled" : "failed",
    selector,
    verified ? "filled" : result.reason ?? `value_verification_failed:${actualValue ?? ""}`,
    verified,
    blocking
  );
}

async function typeAndCommitAutocompleteChoice(
  page: AshbyPageLike,
  selector: string,
  value: string
): Promise<void> {
  const handle = await page.$?.(selector);
  try {
    await page.evaluate(
      ({ selector }) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false;
        element.focus();
        const prototype = element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        valueSetter?.call(element, "");
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
      { selector }
    );
    await handle?.click?.({ clickCount: 3 });
    await handle?.type?.(value, { delay: 25 });
    await waitForTimeout(page, 1200);
    await commitAutocompleteChoice(page, selector, value);
    await page.keyboard?.press("ArrowDown");
    await waitForTimeout(page, 150);
    await page.keyboard?.press("Enter");
    await waitForTimeout(page, 600);
  } finally {
    await handle?.dispose?.();
  }
}

async function commitAutocompleteChoice(
  page: AshbyPageLike,
  selector: string,
  value: string
): Promise<void> {
  await page.evaluate(
    ({ selector, value }) => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const isVisible = (element: Element | null | undefined): boolean => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const input = document.querySelector(selector);
      const expected = normalize(value);
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        "[role='option'], [role='listbox'] *, [cmdk-item], li, button, div"
      ))
        .filter(isVisible)
        .filter((element) => {
          const text = normalize(element.textContent);
          return Boolean(text) && (text.includes(expected) || expected.includes(text));
        })
        .sort((left, right) => (left.textContent ?? "").length - (right.textContent ?? "").length);
      const match = candidates[0];
      if (match) {
        match.scrollIntoView({ block: "center", inline: "center" });
        match.click();
        return true;
      }
      if (input instanceof HTMLInputElement) {
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
        input.blur();
      }
      return false;
    },
    { selector, value }
  );
}

function textValueMatches(actual: string | null | undefined, expected: string): boolean {
  const normalizedActual = normalizeAshbyText(actual);
  const normalizedExpected = normalizeAshbyText(expected);
  if (normalizedActual.includes(normalizedExpected)) return true;

  const actualDate = dateSignature(actual);
  const expectedDate = dateSignature(expected);
  if (actualDate && expectedDate && actualDate === expectedDate) return true;

  const actualDigits = normalizedActual.replace(/\D/g, "");
  const expectedDigits = normalizedExpected.replace(/\D/g, "");
  return expectedDigits.length >= 3 && actualDigits === expectedDigits;
}

function locationValueMatches(actual: string | null | undefined, expected: string): boolean {
  if (textValueMatches(actual, expected)) return true;
  const normalizedActual = normalizeAshbyText(actual);
  const city = normalizeAshbyText(locationQueryValue(expected));
  return Boolean(city && city.length >= 3 && normalizedActual.includes(city));
}

function locationQueryValue(value: string): string {
  return value.split(",")[0]?.trim() || value;
}

function formatDateForTextInput(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function dateSignature(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!slash) return null;
  return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
}

async function fillChoice(
  page: AshbyPageLike,
  target: AshbyFillTarget,
  selector: string | null,
  blocking: boolean
): Promise<AshbyFillOperation> {
  await installEvaluateNameHelper(page);
  const nativeClick = await nativeClickChoiceOption(page, target, selector);
  const result = await page.evaluate(
    ({ selector, value, optionCandidates, controlKind, questionText, skipClicks }) => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const isVisible = (element: Element | null | undefined): boolean => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const exactVisibleChoice = () => {
        const expected = [value, ...optionCandidates].map(normalize).filter(Boolean);
        const questionTokens = normalize(questionText).split(/\W+/).filter((token) => token.length > 4);
        const containers = Array.from(document.querySelectorAll<HTMLElement>(
          "fieldset, section, [role='radiogroup'], [role='group'], [data-testid], div"
        ))
          .filter(isVisible)
          .filter((candidate) => {
            const text = normalize(candidate.textContent);
            if (!text) return false;
            if (questionTokens.length === 0) return expected.some((item) => text.includes(item));
            const tokenHits = questionTokens.filter((token) => text.includes(token)).length;
            return tokenHits >= Math.min(2, questionTokens.length);
          })
          .sort((left, right) => (left.textContent ?? "").length - (right.textContent ?? "").length);
        for (const container of containers) {
          const clickables = Array.from(container.querySelectorAll<HTMLElement>(
            "button, label, [role='radio'], [role='checkbox'], input[type='radio'], input[type='checkbox'], span, div"
          ))
            .filter(isVisible)
            .filter((candidate) => candidate !== container)
            .sort((left, right) => (left.textContent ?? "").length - (right.textContent ?? "").length);
          for (const candidate of clickables) {
            const text = normalize(candidate.textContent || (candidate instanceof HTMLInputElement ? candidate.value : ""));
            if (!expected.some((item) => text === item || (item.length > 2 && text === item.replace(/\.$/, "")))) continue;
            const clickTarget =
              candidate.closest("label, button, [role='radio'], [role='checkbox']") instanceof HTMLElement
                ? candidate.closest("label, button, [role='radio'], [role='checkbox']") as HTMLElement
                : candidate;
            clickTarget.scrollIntoView({ block: "center", inline: "center" });
            clickTarget.click();
            return { ok: true, selected: candidate.textContent || (candidate instanceof HTMLInputElement ? candidate.value : "") };
          }
        }
        return null;
      };
      const labelFor = (input: HTMLInputElement) => {
        const nearbyTexts: string[] = [];
        let current: HTMLElement | null = input.parentElement;
        for (let depth = 0; current && depth < 4; depth += 1) {
          const text = current.textContent ?? "";
          if (text.trim()) nearbyTexts.push(text);
          current = current.parentElement;
        }
        const shortestNearby = nearbyTexts
          .map((text) => text.replace(/\s+/g, " ").trim())
          .filter((text) => text.length > 0 && text.length < 120)
          .sort((left, right) => left.length - right.length)[0] ?? "";
        const labels = input.labels ? Array.from(input.labels).map((label) => label.textContent ?? "") : [];
        return [
          ...labels,
          input.closest("label")?.textContent ?? "",
          input.getAttribute("aria-label") ?? "",
          shortestNearby,
          input.value,
        ].join(" ");
      };
      const expected = [value, ...optionCandidates].map(normalize).filter(Boolean);
      const exactChoice = !skipClicks && controlKind === "checkbox" ? exactVisibleChoice() : null;
      if (exactChoice) {
        return { ok: true, reason: null, selected: exactChoice.selected };
      }
      const selected = selector ? document.querySelector(selector) : null;
      const input = selected instanceof HTMLInputElement ? selected : null;
      const group = input
        ? Array.from(document.querySelectorAll("fieldset, [role='radiogroup'], [role='group'], section, div"))
          .filter((candidate) => candidate.contains(input))
          .sort((left, right) => left.textContent!.length - right.textContent!.length)
          .find((candidate) => {
            const text = normalize(candidate.textContent);
            return text.includes("yes") && text.includes("no");
          })
        : null;
      const visibleButton = group
        ? Array.from(group.querySelectorAll("button, label, [role='radio'], [role='checkbox'], span, div"))
          .filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement)
          .filter(isVisible)
          .sort((left, right) => (left.textContent ?? "").length - (right.textContent ?? "").length)
          .find((candidate) => {
            const text = normalize(candidate.textContent);
            return expected.some((item) => text === item || text === item.replace(/\.$/, ""));
          })
        : null;
      if (visibleButton) {
        visibleButton.scrollIntoView({ block: "center", inline: "center" });
        if (!skipClicks) visibleButton.click();
        const selectedText = labelFor(input ?? document.createElement("input")).trim() || (visibleButton.textContent ?? "");
        if (input) {
          const wantsFalse = expected.some((item) => ["no", "false", "unchecked"].includes(item));
          const verified = input.type === "checkbox" ? (wantsFalse ? !input.checked : input.checked) : input.checked;
          if (!verified) {
            return {
              ok: false,
              reason: "choice_click_not_verified",
              selected: selectedText || visibleButton.textContent,
            };
          }
        }
        return {
          ok: true,
          reason: null,
          selected: selectedText || visibleButton.textContent,
        };
      }
      const pool = uniqueInputs([
        ...(input?.name
          ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="${input.type}"][name="${input.name.replace(/"/g, '\\"')}"]`))
          : []),
        ...(group
          ? Array.from(group.querySelectorAll<HTMLInputElement>("input[type='radio'], input[type='checkbox']"))
          : []),
        ...Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="${controlKind}"]`)),
      ]);
      const match = pool
        .filter((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const style = window.getComputedStyle(candidate);
          const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          return visible || candidate.type === "checkbox" || candidate.type === "radio";
        })
        .find((candidate) => {
          const haystack = normalize(labelFor(candidate));
          return expected.some((item) => haystack.includes(item) || normalize(candidate.value) === item);
        }) ?? (pool.length === 0 || controlKind === "checkbox" ? input : null);
      if (!match) return { ok: false, reason: "choice_control_not_found", selected: null };
      if (match.type === "checkbox") {
        const wantsFalse = expected.some((item) => ["no", "false", "unchecked"].includes(item));
        const clickTarget = inputClickTarget(match, labelFor(match));
        if (!skipClicks && wantsFalse && match.checked) clickTarget.click();
        if (!skipClicks && !wantsFalse && !match.checked) clickTarget.click();
        if (wantsFalse ? match.checked : !match.checked) {
          return { ok: false, reason: "choice_click_not_verified", selected: labelFor(match).trim() || match.value };
        }
      } else {
        const clickTarget = inputClickTarget(match, labelFor(match));
        clickTarget.scrollIntoView({ block: "center", inline: "center" });
        if (!skipClicks) clickTarget.click();
        if (!match.checked) return { ok: false, reason: "choice_click_not_verified", selected: labelFor(match).trim() || match.value };
      }
      return { ok: match.checked, reason: null, selected: labelFor(match).trim() || match.value };
      function inputClickTarget(inputElement: HTMLInputElement, inputLabel: string): HTMLElement {
        const directLabel = inputElement.labels?.[0] ?? inputElement.closest("label");
        if (directLabel instanceof HTMLElement) return directLabel;
        const normalizedLabel = normalize(inputLabel);
        let current = inputElement.parentElement;
        for (let depth = 0; current && depth < 4; depth += 1) {
          const text = normalize(current.textContent);
          if (text && text.length < 160 && (normalizedLabel.includes(text) || text.includes(normalizedLabel))) {
            return current;
          }
          current = current.parentElement;
        }
        return inputElement;
      }
      function uniqueInputs(inputs: HTMLInputElement[]) {
        const seen = new Set<HTMLInputElement>();
        const result: HTMLInputElement[] = [];
        for (const item of inputs) {
          if (seen.has(item)) continue;
          seen.add(item);
          result.push(item);
        }
        return result;
      }
    },
    {
      selector,
      value: target.value,
      optionCandidates: target.option_candidates,
      controlKind: target.field.control_kind,
      questionText: target.question.question_text,
      skipClicks: nativeClick.clicked,
    }
  );
  return operation(
    target.canonical_key,
    result.ok ? "filled" : "failed",
    selector,
    result.ok ? `selected:${result.selected}` : result.reason ?? nativeClick.reason,
    Boolean(result.ok),
    blocking
  );
}

async function nativeClickChoiceOption(
  page: AshbyPageLike,
  target: AshbyFillTarget,
  selector: string | null
): Promise<{ clicked: boolean; selected: string | null; reason: string | null }> {
  if (!page.$) return { clicked: false, selected: null, reason: "native_click_unavailable" };

  const marker = "data-recruit-ashby-choice-target";
  const marked = await page.evaluate(
    ({ selector, value, optionCandidates, questionText, marker }) => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const clean = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim();
      const isVisible = (element: Element | null | undefined): boolean => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const candidateText = (element: HTMLElement) =>
        clean(element.textContent || (element instanceof HTMLInputElement ? element.value : "") || element.getAttribute("aria-label"));
      const targetFor = (element: HTMLElement) =>
        element.closest("label, button, [role='radio'], [role='checkbox']") instanceof HTMLElement
          ? element.closest("label, button, [role='radio'], [role='checkbox']") as HTMLElement
          : element;
      const selectedInput = selector ? document.querySelector(selector) : null;
      const expected = Array.from(new Set([value, ...optionCandidates].map(normalize).filter(Boolean)));
      const questionTokens = normalize(questionText).split(/\W+/).filter((token) => token.length > 4);

      document.querySelectorAll(`[${marker}]`).forEach((element) => element.removeAttribute(marker));

      const containers = new Set<HTMLElement>();
      if (selectedInput instanceof HTMLElement) {
        let current: HTMLElement | null = selectedInput;
        for (let depth = 0; current && depth < 7; depth += 1) {
          containers.add(current);
          current = current.parentElement;
        }
      }
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(
        "fieldset, section, form, [role='radiogroup'], [role='group'], [data-testid], div"
      ))) {
        if (!isVisible(element)) continue;
        const text = normalize(element.textContent);
        if (!text) continue;
        const hasQuestion = questionTokens.length === 0
          ? expected.some((item) => text.includes(item))
          : questionTokens.filter((token) => text.includes(token)).length >= Math.min(2, questionTokens.length);
        if (hasQuestion) containers.add(element);
      }

      const scored: Array<{ element: HTMLElement; text: string; score: number }> = [];
      const pushCandidate = (element: HTMLElement, baseScore = 0) => {
        const text = candidateText(element);
        const normalizedText = normalize(text);
        if (!normalizedText) return;
        let score = expected.some((item) => normalizedText === item || normalizedText === item.replace(/\.$/, ""))
          ? 100
          : expected.some((item) => item.length > 2 && normalizedText.includes(item) && normalizedText.length < 90)
            ? 70
            : -1;
        if (score < 0) return;
        if (element.matches("label, button, [role='radio'], [role='checkbox'], input")) score += 20;
        scored.push({ element: targetFor(element), text, score: score + baseScore });
      };

      if (selectedInput instanceof HTMLInputElement) {
        for (const label of Array.from(selectedInput.labels ?? [])) pushCandidate(label, 30);
        const closestLabel = selectedInput.closest("label");
        if (closestLabel instanceof HTMLElement) pushCandidate(closestLabel, 20);
      }

      for (const container of Array.from(containers)
        .filter((element) => element instanceof HTMLElement)
        .sort((left, right) => (left.textContent ?? "").length - (right.textContent ?? "").length)) {
        for (const candidate of Array.from(container.querySelectorAll<HTMLElement>(
          "label, button, [role='radio'], [role='checkbox'], input[type='radio'], input[type='checkbox'], span, div"
        ))) {
          if (!isVisible(candidate) && candidate.tagName !== "INPUT") continue;
          if (candidate === container) continue;
          pushCandidate(candidate);
        }
      }

      const best = scored
        .filter((item, index, all) => all.findIndex((candidate) => candidate.element === item.element) === index)
        .sort((left, right) => right.score - left.score || left.text.length - right.text.length)[0];
      if (!best) return { ok: false, selected: null, reason: "choice_visible_target_not_found" };

      best.element.setAttribute(marker, "true");
      best.element.scrollIntoView({ block: "center", inline: "center" });
      return { ok: true, selected: best.text, reason: null };
    },
    {
      selector,
      value: target.value,
      optionCandidates: target.option_candidates,
      questionText: target.question.question_text,
      marker,
    }
  );
  if (!marked.ok) return { clicked: false, selected: marked.selected, reason: marked.reason };

  const markerSelector = `[${marker}="true"]`;
  const handle = await page.$(markerSelector);
  if (!handle?.click) return { clicked: false, selected: marked.selected, reason: "native_click_handle_not_found" };

  try {
    await handle.click({ delay: 20 });
    await waitForTimeout(page, 250);
    return { clicked: true, selected: marked.selected, reason: null };
  } catch (error) {
    return { clicked: false, selected: marked.selected, reason: safeMessage(error) };
  } finally {
    await handle.dispose?.();
    await page.evaluate(({ marker }) => {
      document.querySelectorAll(`[${marker}]`).forEach((element) => element.removeAttribute(marker));
    }, { marker });
  }
}

async function fillSelectLike(
  page: AshbyPageLike,
  target: AshbyFillTarget,
  selector: string,
  blocking: boolean
): Promise<AshbyFillOperation> {
  await installEvaluateNameHelper(page);
  const result = await page.evaluate(
    ({ selector, value, optionCandidates }) => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const element = document.querySelector(selector);
      const expected = [value, ...optionCandidates].map(normalize).filter(Boolean);
      if (element instanceof HTMLSelectElement) {
        const option = Array.from(element.options).find((candidate) => {
          const label = normalize(candidate.textContent);
          const optionValue = normalize(candidate.value);
          return expected.some((item) => label.includes(item) || optionValue === item || item.includes(label));
        });
        if (!option) return { ok: false, reason: "select_option_not_found", value: null };
        element.value = option.value;
        option.selected = true;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true, reason: null, value: option.textContent ?? option.value };
      }
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.blur();
        return { ok: element.value.trim().length > 0, reason: null, value: element.value };
      }
      if (element instanceof HTMLElement) {
        element.click();
        return { ok: true, reason: null, value: element.textContent };
      }
      return { ok: false, reason: "select_control_not_found", value: null };
    },
    { selector, value: target.value, optionCandidates: target.option_candidates }
  );
  return operation(
    target.canonical_key,
    result.ok ? "filled" : "failed",
    selector,
    result.ok ? `selected:${result.value}` : result.reason,
    Boolean(result.ok),
    blocking
  );
}

async function submitAshbyApplication(page: AshbyPageLike): Promise<{
  attempted: boolean;
  evidence: AshbySubmissionEvidence;
  snapshot: AshbyFormSnapshot;
  blockers: AshbyBlocker[];
}> {
  await installEvaluateNameHelper(page);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
    document.body?.click();
    return true;
  }, undefined);
  await waitForTimeout(page, 250);
  const submitSelector = await page.evaluate(() => {
    const normalize = (input: string | null | undefined) =>
      (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const isVisible = (element: Element | null | undefined): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const candidates = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']"))
      .filter(isVisible);
    const submit =
      candidates.find((element) => normalize(element instanceof HTMLInputElement ? element.value : element.textContent).includes("submit application")) ??
      candidates.find((element) => {
        const text = normalize(element instanceof HTMLInputElement ? element.value : element.textContent);
        return text === "submit" || text.startsWith("submit ");
      }) ??
      null;
    if (!(submit instanceof HTMLElement)) return false;
    submit.setAttribute("data-recruit-ashby-submit", "true");
    submit.scrollIntoView({ block: "center", inline: "center" });
    return "[data-recruit-ashby-submit='true']";
  }, undefined);

  let clicked = false;
  if (submitSelector) {
    const handle = await page.$?.(submitSelector);
    if (handle?.click) {
      await handle.click();
      clicked = true;
      await handle.dispose?.();
    }
  }
  if (!clicked) {
    clicked = await page.evaluate(() => {
      const submit = document.querySelector("[data-recruit-ashby-submit='true']");
      if (!(submit instanceof HTMLElement)) return false;
      submit.scrollIntoView({ block: "center", inline: "center" });
      submit.focus();
      submit.click();
      return true;
    }, undefined);
  }
  if (!clicked) {
    clicked = await page.evaluate(() => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const isVisible = (element: Element | null | undefined): element is HTMLElement => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const candidates = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']"))
        .filter(isVisible);
      const submit =
        candidates.find((element) => normalize(element instanceof HTMLInputElement ? element.value : element.textContent).includes("submit application")) ??
        candidates.find((element) => {
          const text = normalize(element instanceof HTMLInputElement ? element.value : element.textContent);
          return text === "submit" || text.startsWith("submit ");
        }) ??
        null;
      if (!(submit instanceof HTMLElement)) return false;
      submit.scrollIntoView({ block: "center", inline: "center" });
      submit.click();
      return true;
    }, undefined);
  }

  if (!clicked) {
    const snapshot = await inspectAshbyPage(page);
    return {
      attempted: false,
      evidence: {
        outcome: "ambiguous",
        details: ["submit control not found"],
        url: snapshot.url,
      },
      snapshot,
      blockers: [{
        kind: "submit_control_missing",
        key: "submit",
        label: null,
        detail: "submit control not found",
        selector: null,
      }],
    };
  }

  await waitForTimeout(page, 4000);
  const firstSnapshot = await inspectAshbyPage(page);
  const firstEvidence = classifySubmissionSnapshot(firstSnapshot);
  if (
    firstEvidence.outcome === "ambiguous" &&
    firstSnapshot.submit_controls > 0 &&
    firstSnapshot.validation_errors.length === 0 &&
    firstSnapshot.confirmation_texts.length === 0
  ) {
    await page.evaluate(() => {
      const submit = document.querySelector("[data-recruit-ashby-submit='true']");
      if (!(submit instanceof HTMLElement)) return false;
      submit.scrollIntoView({ block: "center", inline: "center" });
      submit.focus();
      if (submit instanceof HTMLButtonElement && submit.form) {
        submit.form.requestSubmit(submit);
        return true;
      }
      const form = submit.closest("form");
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
        return true;
      }
      submit.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      submit.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    }, undefined);
  }

  await waitForTimeout(page, 8000);
  const snapshot = await inspectAshbyPage(page);
  const evidence = classifySubmissionSnapshot(snapshot);
  const blockers: AshbyBlocker[] = evidence.outcome === "confirmed"
    ? []
    : [{
        kind:
          evidence.outcome === "unsupported_gate"
            ? "unexpected_verification_gate"
            : evidence.outcome === "rejected_validation" || evidence.outcome === "rejected_spam"
              ? "validation_error"
              : "submit_confirmation_missing",
        key: "submit",
        label: null,
        detail: evidence.details.join(" | "),
        selector: null,
      }];
  return { attempted: true, evidence, snapshot, blockers };
}

async function repairValidationAndResubmit(
  page: AshbyPageLike,
  args: {
    validationSnapshot: AshbyFormSnapshot;
    profileAnswers: Record<string, string | null>;
    aliases?: AshbyPromptAlias[];
    approvedAnswers?: AshbyApprovedAnswer[];
    draftAnswers?: Awaited<ReturnType<typeof draftAshbyAnswersWithOpenAI>>["answers"];
    draftAnswerMode: "review_only" | "fill";
    organizationSlug: string;
  }
): Promise<{
  operations: AshbyFillOperation[];
  missingLabels: string[];
  submitResult: Awaited<ReturnType<typeof submitAshbyApplication>>;
}> {
  const missingLabels = extractMissingRequiredLabels(args.validationSnapshot.validation_errors);
  if (missingLabels.length === 0) {
    return {
      operations: [],
      missingLabels,
      submitResult: {
        attempted: true,
        evidence: classifySubmissionSnapshot(args.validationSnapshot),
        snapshot: args.validationSnapshot,
        blockers: [],
      },
    };
  }

  const rediscovered = await inspectAshbyPage(page);
  const repairSnapshot: AshbyFormSnapshot = {
    ...rediscovered,
    questions: rediscovered.questions.map((question) =>
      missingLabels.some((label) => validationLabelMatchesQuestion(label, question))
        ? { ...question, required: true }
        : question
    ),
  };
  const plan = buildAshbyResolutionPlan({
    snapshot: repairSnapshot,
    profileAnswers: args.profileAnswers,
    aliases: args.aliases,
    approvedAnswers: args.approvedAnswers,
    draftAnswers: args.draftAnswers,
    draftAnswerMode: args.draftAnswerMode,
    organizationSlug: args.organizationSlug,
  });
  const repairTargets = plan.fill_targets.filter((target) =>
    missingLabels.some((label) => validationLabelMatchesQuestion(label, target.question))
  );
  if (repairTargets.length === 0) {
    const evidence = classifySubmissionSnapshot(args.validationSnapshot);
    return {
      operations: [],
      missingLabels,
      submitResult: {
        attempted: true,
        evidence,
        snapshot: args.validationSnapshot,
        blockers: [{
          kind: "validation_error",
          key: "submit",
          label: null,
          detail: `validation repair found no fillable target: ${missingLabels.join("; ")}`,
          selector: null,
        }],
      },
    };
  }

  const operations: AshbyFillOperation[] = [];
  for (const target of repairTargets) {
    operations.push(await fillAshbyTarget(page, target));
  }
  await waitForTimeout(page, 900);
  return {
    operations,
    missingLabels,
    submitResult: await submitAshbyApplication(page),
  };
}

function extractMissingRequiredLabels(validationErrors: string[]): string[] {
  const labels: string[] = [];
  for (const error of validationErrors) {
    const regex = /Missing entry for required field:\s*([^|]+?)(?=Missing entry for required field:|Personal Information|Application questions|Submit Application|$)/gi;
    for (const match of error.matchAll(regex)) {
      const label = (match[1] ?? "").replace(/\s+/g, " ").trim();
      if (label) labels.push(label);
    }
  }
  const seen = new Set<string>();
  return labels.filter((label) => {
    const normalized = normalizeAshbyText(label);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function validationLabelMatchesQuestion(label: string, question: AshbyQuestionNode): boolean {
  const normalizedLabel = normalizeAshbyText(label);
  const questionText = normalizeAshbyText(question.question_text);
  if (!normalizedLabel || !questionText) return false;
  if (normalizedLabel === questionText) return true;
  if (normalizedLabel.includes(questionText) || questionText.includes(normalizedLabel)) return true;
  const labelTokens = normalizedLabel.split(/\W+/).filter((token) => token.length > 4);
  if (labelTokens.length === 0) return false;
  const hits = labelTokens.filter((token) => questionText.includes(token)).length;
  return hits >= Math.min(2, labelTokens.length);
}

async function waitForAshbyHydration(page: AshbyPageLike, notes: string[]) {
  try {
    await page.waitForSelector("input, textarea, select, button, [role='combobox']", { timeout: 25_000 });
  } catch (error) {
    notes.push(`hydration_wait_failed=${safeMessage(error)}`);
  }
}

async function verifyFile(page: AshbyPageLike, selector: string): Promise<boolean> {
  await installEvaluateNameHelper(page);
  return await page.evaluate(
    ({ selector }) => {
      const input = document.querySelector(selector);
      return input instanceof HTMLInputElement && input.type === "file" && Boolean(input.files?.length || input.value);
    },
    { selector }
  );
}

async function screenshotMetadata(
  page: AshbyPageLike,
  label: string
): Promise<{ label: string; captured: boolean; byteLength?: number; error?: string }> {
  if (!page.screenshot) return { label, captured: false, error: "screenshot_unavailable" };
  try {
    const screenshot = await page.screenshot({ fullPage: true });
    return {
      label,
      captured: true,
      byteLength: typeof screenshot === "string" ? Buffer.byteLength(screenshot) : screenshot.byteLength,
    };
  } catch (error) {
    return { label, captured: false, error: safeMessage(error) };
  }
}

function operation(
  key: string,
  status: AshbyFillOperation["status"],
  selector: string | null,
  detail: string | null,
  verified: boolean,
  blocking: boolean
): AshbyFillOperation {
  return { key, status, selector, detail, verified, blocking };
}

function coerceControlKind(value: string): AshbyControlKind {
  return [
    "text",
    "email",
    "tel",
    "textarea",
    "radio",
    "checkbox",
    "file",
    "select",
    "combobox",
    "unsupported",
  ].includes(value)
    ? value as AshbyControlKind
    : "unsupported";
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function installEvaluateNameHelper(page: AshbyPageLike): Promise<void> {
  const stringEvaluate = page as unknown as {
    evaluate(pageFunction: string): Promise<unknown>;
  };
  await stringEvaluate.evaluate(`
    globalThis.__name = globalThis.__name || ((fn) => fn);
    globalThis.n = globalThis.n || ((fn) => fn);
  `);
}
