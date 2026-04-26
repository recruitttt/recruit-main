import {
  blockedSubmissionEvidence,
  buildAshbyProfileAnswers,
  buildAshbyResolutionPlan,
  buildRunGrade,
  classifySubmissionSnapshot,
  detectConfirmationTexts,
  detectUnexpectedVerificationGate,
  evaluateSubmitReadiness,
  normalizeAshbyText,
  outcomeFromSubmitAttempt,
  profilePreflightBlockers,
} from "../ashby-fill/core";
import { draftAshbyAnswersWithOpenAI } from "../ashby-fill/llm";
import {
  fillAshbyTarget,
  type AshbyPageLike,
} from "../ashby-fill/browser";
import type {
  AshbyApprovedAnswer,
  AshbyBlocker,
  AshbyControlKind,
  AshbyFieldObservation,
  AshbyFillOperation,
  AshbyFillTarget,
  AshbyMappingDecision,
  AshbyPromptAlias,
  AshbyProfilePreflightIssue,
  AshbyQuestionNode,
  AshbyResolutionPlan,
  AshbyReviewItem,
} from "../ashby-fill/types";
import {
  buildLeverQuestionNodes,
  validateDirectLeverApplicationUrl,
} from "./core";
import type {
  LeverFieldObservation,
  LeverFormFillResult,
  LeverCaptchaGate,
  LeverCaptchaKind,
  LeverFormSnapshot,
} from "./types";

export type LeverPageLike = AshbyPageLike;

type BrowserbaseConsoleMessage = {
  text(): string;
};

type BrowserbaseConsolePage = LeverPageLike & {
  on?(event: "console", handler: (message: BrowserbaseConsoleMessage) => void): void;
  off?(event: "console", handler: (message: BrowserbaseConsoleMessage) => void): void;
  removeListener?(event: "console", handler: (message: BrowserbaseConsoleMessage) => void): void;
};

export async function runLeverFormFillOnPage(
  page: LeverPageLike,
  args: {
    targetUrl: string;
    profile: unknown;
    aliases?: AshbyPromptAlias[];
    approvedAnswers?: AshbyApprovedAnswer[];
    openAiApiKey?: string | null;
    openAiModel?: string;
    openAiBestEffort?: boolean;
    draftAnswerMode?: "review_only" | "fill";
    browserbaseCaptchaSolving?: boolean;
    submit?: boolean;
  }
): Promise<LeverFormFillResult> {
  const { normalizedUrl, companySlug, postingId } = validateDirectLeverApplicationUrl(args.targetUrl);
  const notes: string[] = [];
  const errors: Array<{ where: string; message: string }> = [];
  const screenshots: LeverFormFillResult["screenshots"] = [];
  const profileAnswers = {
    ...buildAshbyProfileAnswers(args.profile),
    ...buildLeverProfileAnswers(args.profile),
  };
  const captchaObserver = args.browserbaseCaptchaSolving
    ? createBrowserbaseCaptchaObserver(page, notes)
    : null;
  if (args.browserbaseCaptchaSolving) {
    notes.push("captcha_solver=browserbase");
  }

  await page.setViewport?.({ width: 1365, height: 900 });
  try {
    await page.goto(normalizedUrl, { waitUntil: "networkidle2", timeout: 45_000 });
  } catch (error) {
    notes.push(`goto_networkidle_failed=${safeMessage(error)}`);
    await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  }
  await waitForLeverHydration(page, notes);

  const preUploadSnapshot = await inspectLeverPage(page, {
    companySlug,
    postingId,
    browserbaseCaptchaSolving: args.browserbaseCaptchaSolving,
  });
  screenshots.push(await screenshotMetadata(page, "pre-upload"));
  const preUploadPlan = buildAshbyResolutionPlan({
    snapshot: preUploadSnapshot,
    profileAnswers,
    aliases: args.aliases ?? [],
    approvedAnswers: args.approvedAnswers ?? [],
    organizationSlug: companySlug,
  });
  const preUploadFileOperations: AshbyFillOperation[] = [];
  for (const target of preUploadPlan.fill_targets.filter((item) => item.answer_kind === "file")) {
    preUploadFileOperations.push(await fillAshbyTarget(page, target));
  }
  if (preUploadFileOperations.length > 0) {
    await waitForTimeout(page, 2500);
    notes.push("post_resume_upload_rediscovery=true");
  }

  const postUploadSnapshot = await inspectLeverPage(page, {
    companySlug,
    postingId,
    browserbaseCaptchaSolving: args.browserbaseCaptchaSolving,
  });
  let draftAnswers: Awaited<ReturnType<typeof draftAshbyAnswersWithOpenAI>>["answers"] = [];
  if (args.openAiBestEffort && args.openAiApiKey) {
    const initialPlan = augmentLeverResolutionPlan(buildAshbyResolutionPlan({
      snapshot: postUploadSnapshot,
      profileAnswers,
      aliases: args.aliases ?? [],
      approvedAnswers: args.approvedAnswers ?? [],
      organizationSlug: companySlug,
    }), { snapshot: postUploadSnapshot, profileAnswers, organizationSlug: companySlug });
    const draftResult = await draftAshbyAnswersWithOpenAI({
      apiKey: args.openAiApiKey,
      model: args.openAiModel,
      profile: args.profile,
      organizationSlug: companySlug,
      questions: postUploadSnapshot.questions.filter((question) =>
        isLeverOpenAiDraftCandidate(question) &&
        (
          initialPlan.pending_review.some((item) => item.prompt_hash === question.prompt_hash) ||
          initialPlan.missing_required.some((item) => item.key === question.prompt_hash)
        )
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

  const plan = augmentLeverResolutionPlan(buildAshbyResolutionPlan({
    snapshot: postUploadSnapshot,
    profileAnswers,
    aliases: args.aliases ?? [],
    approvedAnswers: args.approvedAnswers ?? [],
    draftAnswers,
    draftAnswerMode: args.draftAnswerMode ?? "review_only",
    organizationSlug: companySlug,
  }), { snapshot: postUploadSnapshot, profileAnswers, organizationSlug: companySlug });
  const needsUserAnswers = buildLeverProfilePreflightIssues(plan.missing_required);

  if (args.submit === true && needsUserAnswers.length > 0) {
    const evidence = blockedSubmissionEvidence(postUploadSnapshot);
    const blockers = profilePreflightBlockers(needsUserAnswers);
    const runGrade = buildRunGrade({
      snapshot: postUploadSnapshot,
      plan,
      fillOperations: preUploadFileOperations,
      submitReady: false,
    });
    captchaObserver?.dispose();
    return {
      provider: "lever",
      targetUrl: normalizedUrl,
      finalUrl: page.url(),
      companySlug,
      postingId,
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
  }

  const fillOperations: AshbyFillOperation[] = [...preUploadFileOperations];
  for (const target of plan.fill_targets) {
    if (
      target.answer_kind === "file" &&
      preUploadFileOperations.some((operation) => operation.key === target.canonical_key && operation.verified)
    ) {
      continue;
    }
    let operation = target.canonical_key === "current_location_display"
      ? await fillLeverLocationTarget(page, target, {
          key: target.canonical_key,
          status: "failed",
          selector: target.field.selector_hint ?? target.question.primary_selector,
          detail: "lever_location_repair_not_attempted",
          verified: false,
          blocking: Boolean(target.answer.blocking_if_missing || target.question.required),
        })
      : await fillAshbyTarget(page, target);
    if (operation.status === "failed" && isLeverChoiceRepairCandidate(target)) {
      operation = await fillLeverChoiceTarget(page, target, operation);
    }
    if (operation.status === "failed" && target.canonical_key === "current_location_display") {
      operation = await fillLeverLocationTarget(page, target, operation);
    }
    fillOperations.push(operation);
  }

  await waitForTimeout(page, 900);
  if (args.browserbaseCaptchaSolving && postUploadSnapshot.hcaptcha_present) {
    notes.push("captcha_pre_submit_wait_skipped=invisible_hcaptcha");
  }
  const finalSnapshotBeforeSubmit = await inspectLeverPage(page, {
    companySlug,
    postingId,
    browserbaseCaptchaSolving: args.browserbaseCaptchaSolving,
  });
  screenshots.push(await screenshotMetadata(page, "pre-submit"));
  const readiness = evaluateSubmitReadiness(
    fillOperations,
    plan.missing_required,
    plan.unsupported_required,
    plan.pending_review,
    finalSnapshotBeforeSubmit
  );
  if (readiness.allowed) {
    notes.push("form_fill_ready=true");
  }
  const captchaGateBlocker = captchaGateBlockerFor(finalSnapshotBeforeSubmit, args.browserbaseCaptchaSolving === true);
  if (captchaGateBlocker) {
    notes.push(`captcha_gate_blocker=${captchaGateBlocker.key}`);
  }
  const runGrade = buildRunGrade({
    snapshot: finalSnapshotBeforeSubmit,
    plan,
    fillOperations,
    submitReady: readiness.allowed && !captchaGateBlocker,
  });

  if (!readiness.allowed || captchaGateBlocker || args.submit !== true) {
    const evidence = captchaGateBlocker
      ? unsupportedCaptchaEvidence(finalSnapshotBeforeSubmit, captchaGateBlocker)
      : blockedSubmissionEvidence(finalSnapshotBeforeSubmit);
    captchaObserver?.dispose();
    return {
      provider: "lever",
      targetUrl: normalizedUrl,
      finalUrl: page.url(),
      companySlug,
      postingId,
      submitAttempted: false,
      submitCompleted: false,
      outcome: evidence.outcome,
      submissionEvidence: evidence,
      plan,
      fillOperations,
      blockers: captchaGateBlocker ? [...readiness.blockers, captchaGateBlocker] : readiness.blockers,
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

  const submitResult = await submitLeverApplication(page, {
    companySlug,
    postingId,
    browserbaseCaptchaSolving: args.browserbaseCaptchaSolving,
    captchaObserver,
    notes,
  });
  captchaObserver?.dispose();
  return {
    provider: "lever",
    targetUrl: normalizedUrl,
    finalUrl: page.url(),
    companySlug,
    postingId,
    submitAttempted: submitResult.attempted,
    submitCompleted: submitResult.evidence.outcome === "confirmed",
    outcome: outcomeFromSubmitAttempt(submitResult.attempted, submitResult.evidence),
    submissionEvidence: submitResult.evidence,
    plan,
    fillOperations,
    blockers: [...readiness.blockers, ...submitResult.blockers],
    needsUserAnswers,
    preUploadSnapshot,
    postUploadSnapshot,
    finalSnapshot: submitResult.snapshot,
    runGrade,
    screenshots: [...screenshots, await screenshotMetadata(page, "post-submit")],
    notes,
    errors,
  };
}

export async function inspectLeverPage(
  page: LeverPageLike,
  context: {
    companySlug?: string | null;
    postingId?: string | null;
    browserbaseCaptchaSolving?: boolean;
  } = {}
): Promise<LeverFormSnapshot> {
  await installEvaluateNameHelper(page);
  const snapshot = await page.evaluate(
    ({ companySlug, postingId, browserbaseCaptchaSolving, confirmationPatterns, verificationPatterns }) => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const clean = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim();
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
      const hashPrompt = (value: string | null | undefined) => {
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
      const selectorFor = (element: Element | null | undefined): string | null => {
        if (!(element instanceof HTMLElement)) return null;
        if (element.id) return `#${cssEscape(element.id)}`;
        const dataQa = element.getAttribute("data-qa");
        if (dataQa) return `${element.tagName.toLowerCase()}[data-qa=${quote(dataQa)}]`;
        const name = element.getAttribute("name");
        if (name) {
          const type = element.getAttribute("type");
          const value = element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox")
            ? `[value=${quote(element.value)}]`
            : "";
          return `${element.tagName.toLowerCase()}${type ? `[type=${quote(type)}]` : ""}[name=${quote(name)}]${value}`;
        }
        return null;
      };
      const controlKindFor = (element: Element, schemaType?: string | null): string => {
        const normalizedSchemaType = normalize(schemaType);
        if (element instanceof HTMLTextAreaElement || normalizedSchemaType === "textarea") return "textarea";
        if (element instanceof HTMLSelectElement || normalizedSchemaType === "dropdown") return "select";
        if (element instanceof HTMLInputElement) {
          if (element.type === "email") return "email";
          if (element.type === "tel") return "tel";
          if (element.type === "radio" || normalizedSchemaType === "multiple-choice") return "radio";
          if (element.type === "checkbox" || normalizedSchemaType === "multiple-select") return "checkbox";
          if (element.type === "file") return "file";
          if (element.type === "hidden") return "unsupported";
          return "text";
        }
        return "unsupported";
      };
      type LeverCardFieldSchema = {
        text?: unknown;
        options?: unknown[];
        type?: unknown;
        required?: unknown;
        id?: unknown;
      };
      type LeverCardTemplateSchema = {
        text?: unknown;
        fields?: LeverCardFieldSchema[];
      };
      const isRecordValue = (value: unknown): value is Record<string, unknown> =>
        Boolean(value && typeof value === "object" && !Array.isArray(value));
      const parseTemplate = (raw: string | null | undefined): LeverCardTemplateSchema | null => {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as unknown;
          return isRecordValue(parsed) ? parsed as LeverCardTemplateSchema : null;
        } catch {
          return null;
        }
      };
      const cardTemplates = new Map<string, LeverCardTemplateSchema>();
      for (const input of Array.from(document.querySelectorAll<HTMLInputElement>("input[type='hidden'][name^='cards'][name$='[baseTemplate]']"))) {
        const cardId = input.name.match(/^cards\[([^\]]+)\]\[baseTemplate\]$/)?.[1] ?? null;
        const template = parseTemplate(input.value);
        if (cardId && template) cardTemplates.set(cardId, template);
      }
      const cardFieldFor = (name: string | null | undefined) => {
        const match = (name ?? "").match(/^cards\[([^\]]+)\]\[field(\d+)\]$/);
        if (!match) return null;
        const cardId = match[1];
        const fieldIndex = Number(match[2]);
        const template = cardTemplates.get(cardId);
        const field = Array.isArray(template?.fields) ? template.fields[fieldIndex] : null;
        return { cardId, fieldIndex, template, field };
      };
      const labelFromQuestion = (element: Element, cardInfo: ReturnType<typeof cardFieldFor>) => {
        if (cardInfo?.field?.text) return clean(String(cardInfo.field.text));
        const question = element.closest(".application-question, .custom-question, li");
        const label = question?.querySelector(".application-label .text, .application-label");
        const labelText = clean(label?.textContent);
        if (labelText) return labelText.replace(/\s*✱\s*$/, "").trim();
        const name = element.getAttribute("name") ?? "";
        const urlMatch = name.match(/^urls\[([^\]]+)\]$/);
        if (urlMatch) return `${urlMatch[1]} URL`;
        if (name === "name") return "Full name";
        if (name === "email") return "Email";
        if (name === "phone") return "Phone";
        if (name === "org") return "Current company";
        if (name === "location") return "Current location";
        if (name === "resume") return "Resume/CV";
        if (name === "eeo[veteran]") return "Veteran status";
        if (name === "eeo[disability]") return "Disability status";
        if (name === "eeo[disabilitySignature]") return "Disability signature";
        if (name === "eeo[disabilitySignatureDate]") return "Disability signature date";
        return element.getAttribute("placeholder") || element.getAttribute("data-qa") || name || null;
      };
      const optionsFor = (element: Element, controlKind: string, cardInfo: ReturnType<typeof cardFieldFor>) => {
        const schemaOptions = Array.isArray(cardInfo?.field?.options)
          ? cardInfo.field.options
              .map((option) => clean(typeof option === "string" ? option : isRecordValue(option) ? String(option.text ?? "") : ""))
              .filter(Boolean)
          : [];
        if (element instanceof HTMLSelectElement) {
          return unique([
            ...Array.from(element.options).map((option) => option.textContent || option.value),
            ...schemaOptions,
          ]);
        }
        if (element instanceof HTMLInputElement && (controlKind === "radio" || controlKind === "checkbox")) {
          const inputs = element.name
            ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="${element.type}"][name=${quote(element.name)}]`))
            : [element];
          return unique([
            ...inputs.flatMap((input) => {
              const labels = input.labels ? Array.from(input.labels).map((label) => label.textContent) : [];
              return labels.length > 0 ? labels : [input.closest("label")?.textContent ?? input.value];
            }),
            ...schemaOptions,
          ]);
        }
        return schemaOptions;
      };
      const sectionFor = (element: Element, cardInfo: ReturnType<typeof cardFieldFor>) => {
        if (cardInfo?.template?.text) return clean(String(cardInfo.template.text));
        const form = element.closest(".application-form, form");
        const section = element.closest(".application-question, .application-additional, section, fieldset");
        const heading = section?.querySelector("h3, h4, legend");
        return clean(heading?.textContent) || clean(form?.querySelector("h4")?.textContent) || null;
      };

      const controls = Array.from(document.querySelectorAll("input, textarea, select"))
        .filter((element) => {
          if (isFileInput(element)) return true;
          if (element instanceof HTMLInputElement && element.type === "hidden") return false;
          return isVisible(element) || (isChoiceInput(element) && Boolean(element.closest("label, .application-question")));
        })
        .filter((element) => {
          const name = element.getAttribute("name") ?? "";
          return ![
            "selectedLocation",
            "accountId",
            "linkedInData",
            "origin",
            "referer",
            "timezone",
            "socialReferralKey",
            "socialSource",
            "resumeStorageId",
            "h-captcha-response",
            "source",
          ].includes(name);
        });

      const seenGroups = new Set<string>();
      const fields: Array<Omit<LeverFieldObservation, "control_kind"> & { control_kind: string }> = [];
      for (const element of controls) {
        const name = element.getAttribute("name");
        const cardInfo = cardFieldFor(name);
        const schemaType = typeof cardInfo?.field?.type === "string" ? cardInfo.field.type : null;
        const controlKind = controlKindFor(element, schemaType);
        if (controlKind === "unsupported") continue;
        const label = labelFromQuestion(element, cardInfo);
        if (element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox")) {
          const key = `${element.type}:${element.name || label || selectorFor(element) || "group"}`;
          if (seenGroups.has(key)) continue;
          seenGroups.add(key);
        }
        const options = optionsFor(element, controlKind, cardInfo);
        const question = element.closest(".application-question, .custom-question, li");
        const questionText = label;
        const requiredText = clean(question?.textContent);
        const required = Boolean(
          element.hasAttribute("required") ||
          element.closest(".required-field") ||
          cardInfo?.field?.required === true ||
          /\*/.test(label ?? "") ||
          /✱/.test(requiredText)
        );
        fields.push({
          label,
          question_text: questionText,
          normalized_prompt: normalize(questionText),
          prompt_hash: hashPrompt(questionText),
          required,
          control_kind: controlKind,
          selector_hint: selectorFor(element),
          options,
          option_signature: options.length > 0 ? unique(options).map(normalize).join("|") : null,
          section: sectionFor(element, cardInfo),
          supported: true,
          validation_state: element.getAttribute("aria-invalid") === "true" || element.closest("[aria-invalid='true']")
            ? "invalid"
            : "unknown",
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
          card_id: cardInfo?.cardId ?? null,
          card_field_index: cardInfo?.fieldIndex ?? null,
          provider_key: cardInfo?.field?.id ? String(cardInfo.field.id) : name,
        });
      }

      const bodyText = clean(document.body?.innerText).slice(0, 2500);
      const normalizedBody = normalize(bodyText);
      const hcaptchaPresent = Boolean(
        document.querySelector("#hcaptchaResponseInput, [name='h-captcha-response'], .h-captcha, iframe[src*='hcaptcha']")
      );
      const recaptchaPresent = Boolean(
        document.querySelector("[name='g-recaptcha-response'], .g-recaptcha, iframe[src*='recaptcha']")
      );
      const turnstilePresent = Boolean(
        document.querySelector("[name='cf-turnstile-response'], .cf-turnstile, iframe[src*='challenges.cloudflare.com']")
      );
      const knownCaptchaPresent = hcaptchaPresent || recaptchaPresent || turnstilePresent;
      const unknownCaptchaPresent = !knownCaptchaPresent && /captcha|verify you are human|confirm you're a human/i.test(bodyText);
      const captchaKinds = [
        hcaptchaPresent ? "hcaptcha" : null,
        recaptchaPresent ? "recaptcha" : null,
        turnstilePresent ? "turnstile" : null,
        unknownCaptchaPresent ? "unknown" : null,
      ].filter((kind): kind is string => Boolean(kind));
      const tokenSelectors = [
        hcaptchaPresent ? "#hcaptchaResponseInput" : null,
        hcaptchaPresent ? "[name='h-captcha-response']" : null,
        recaptchaPresent ? "[name='g-recaptcha-response']" : null,
        turnstilePresent ? "[name='cf-turnstile-response']" : null,
      ].filter((selector): selector is string => Boolean(selector));
      const tokenValueLengths = tokenSelectors
        .flatMap((selector) => Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector)))
        .map((element) => element.value.length);
      const captchaFrameCount = Array.from(document.querySelectorAll("iframe"))
        .filter((iframe) => /captcha|recaptcha|turnstile|challenges\.cloudflare/i.test(iframe.src))
        .length;
      const confirmationTexts = confirmationPatterns.filter((pattern) => normalizedBody.includes(normalize(pattern)));
      const verificationGate =
        (!browserbaseCaptchaSolving && knownCaptchaPresent) ||
        verificationPatterns.some((pattern) => normalizedBody.includes(normalize(pattern)));
      const validationErrors = unique([
        ...Array.from(document.querySelectorAll("[role='alert'], .error-message, .application-error, .posting-error, .field-error"))
          .filter(isVisible)
          .map((node) => clean(node.textContent))
          .filter(Boolean),
        ...bodyText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => /required|invalid|must be|enter a valid|file exceeds|couldn't auto-read|captcha/i.test(line)),
      ]).slice(0, 30);
      const submitControls = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button'], #btn-submit, [data-qa='btn-submit']"))
        .filter(isVisible)
        .filter((element) => /submit/i.test(element instanceof HTMLInputElement ? element.value : element.textContent ?? ""))
        .length;

      return {
        provider: "lever",
        company_slug: companySlug,
        posting_id: postingId,
        hcaptcha_present: hcaptchaPresent,
        captcha: {
          present: knownCaptchaPresent || unknownCaptchaPresent,
          kinds: captchaKinds,
          primary: captchaKinds[0] ?? null,
          tokenSelectors,
          tokenValueLengths,
          frameCount: captchaFrameCount,
          supportedByBrowserbase: false,
          unsupportedReason: null,
        },
        url: location.href,
        title: document.title || null,
        body_text_sample: bodyText,
        fields,
        validation_errors: validationErrors,
        confirmation_texts: confirmationTexts,
        submit_controls: submitControls,
        unexpected_verification_gate: verificationGate,
        notes: [`field_count=${fields.length}`, `hcaptcha_present=${hcaptchaPresent}`, `captcha_primary=${captchaKinds[0] ?? "none"}`],
      };
    },
    {
      companySlug: context.companySlug ?? null,
      postingId: context.postingId ?? null,
      browserbaseCaptchaSolving: context.browserbaseCaptchaSolving === true,
      confirmationPatterns: [
        "thank you for applying",
        "application submitted",
        "successfully submitted",
        "your application has been submitted",
        "thanks for applying",
      ],
      verificationPatterns: [
        "captcha",
        "hcaptcha",
        "confirm you're a human",
        "verification code",
        "security code",
      ],
    }
  );

  const fields = snapshot.fields.map((field) => ({
    ...field,
    control_kind: coerceControlKind(field.control_kind),
  })) as LeverFieldObservation[];
  const bodyText = snapshot.body_text_sample ?? "";
  const captcha = normalizeLeverCaptchaGate(snapshot.captcha, context.browserbaseCaptchaSolving === true);
  return {
    ...snapshot,
    provider: "lever" as const,
    fields,
    captcha,
    confirmation_texts: snapshot.confirmation_texts.length > 0
      ? snapshot.confirmation_texts
      : detectConfirmationTexts(bodyText),
    unexpected_verification_gate:
      snapshot.unexpected_verification_gate || detectUnexpectedVerificationGate(bodyText),
    questions: buildLeverQuestionNodes(fields),
  };
}

type LeverCanonicalSpec = {
  canonicalKey: string;
  answerKind: "text" | "choice";
  fillOrder: number;
  questionClass: AshbyMappingDecision["question_class"];
  answerabilityClass: AshbyMappingDecision["answerability_class"];
  requiredPreflight: boolean;
  isMatch(question: AshbyQuestionNode): boolean;
  resolveValue(question: AshbyQuestionNode, profileAnswers: Record<string, string | null>): string | null;
};

type RawLeverCaptchaGate = {
  present?: unknown;
  kinds?: unknown[];
  primary?: unknown;
  tokenSelectors?: unknown[];
  tokenValueLengths?: unknown[];
  frameCount?: unknown;
};

function normalizeLeverCaptchaGate(
  captcha: RawLeverCaptchaGate | null | undefined,
  browserbaseCaptchaSolving: boolean
): LeverCaptchaGate {
  const kinds = uniqueCaptchaKinds((captcha?.kinds ?? []).filter(isLeverCaptchaKind));
  const present = Boolean(captcha?.present || kinds.length > 0);
  const primary = present ? (isLeverCaptchaKind(captcha?.primary) ? captcha.primary : kinds[0] ?? "unknown") : null;
  const supportedByBrowserbase = Boolean(
    browserbaseCaptchaSolving &&
    primary &&
    supportedBrowserbaseCaptchaKinds().has(primary)
  );
  const unsupportedReason = present && !supportedByBrowserbase
    ? browserbaseCaptchaSolving
      ? `captcha type ${primary ?? "unknown"} is not in BROWSERBASE_SUPPORTED_CAPTCHA_KINDS`
      : "Browserbase CAPTCHA solving is not enabled"
    : null;

  return {
    present,
    kinds,
    primary,
    tokenSelectors: uniqueOriginalStrings((captcha?.tokenSelectors ?? []).filter(isNonEmptyString)),
    tokenValueLengths: Array.isArray(captcha?.tokenValueLengths)
      ? captcha.tokenValueLengths.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [],
    frameCount: typeof captcha?.frameCount === "number" && Number.isFinite(captcha.frameCount) ? captcha.frameCount : 0,
    supportedByBrowserbase,
    unsupportedReason,
  };
}

function captchaGateBlockerFor(
  snapshot: LeverFormSnapshot,
  browserbaseCaptchaSolving: boolean
): AshbyBlocker | null {
  if (!snapshot.captcha.present) return null;
  if (snapshot.captcha.supportedByBrowserbase) return null;
  const primary = snapshot.captcha.primary ?? "unknown";
  return {
    kind: "unexpected_verification_gate",
    key: `unsupported_captcha_${primary}`,
    label: null,
    detail: browserbaseCaptchaSolving
      ? `Unsupported CAPTCHA type for automatic submit: ${primary}`
      : "CAPTCHA present but Browserbase CAPTCHA solving is not enabled",
    selector: captchaSelectorFor(primary),
  };
}

function unsupportedCaptchaEvidence(
  snapshot: LeverFormSnapshot,
  blocker: AshbyBlocker
): LeverFormFillResult["submissionEvidence"] {
  return {
    outcome: "unsupported_gate",
    details: [blocker.detail, ...(snapshot.captcha.unsupportedReason ? [snapshot.captcha.unsupportedReason] : [])],
    url: snapshot.url,
  };
}

function supportedBrowserbaseCaptchaKinds(): Set<LeverCaptchaKind> {
  const raw = process.env.BROWSERBASE_SUPPORTED_CAPTCHA_KINDS ?? process.env.BROWSERBASE_SUPPORTED_CAPTCHA_TYPES;
  const values = raw
    ? raw.split(",").map((item) => item.trim().toLowerCase())
    : ["recaptcha", "turnstile"];
  return new Set(values.filter(isLeverCaptchaKind));
}

function isLeverCaptchaKind(value: unknown): value is LeverCaptchaKind {
  return value === "hcaptcha" || value === "recaptcha" || value === "turnstile" || value === "unknown";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function uniqueCaptchaKinds(values: LeverCaptchaKind[]): LeverCaptchaKind[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function captchaSelectorFor(kind: LeverCaptchaKind | string): string | null {
  if (kind === "hcaptcha") return "#h-captcha";
  if (kind === "recaptcha") return ".g-recaptcha";
  if (kind === "turnstile") return ".cf-turnstile";
  return null;
}

const LEVER_HARD_TRUTH_REQUIRED_KEYS = new Set([
  "ai_notetaker_consent",
  "lever_relocation_visa_situation",
  "work_authorized_applied_country",
  "visa_sponsorship_required",
  "university",
  "language_skills",
]);

const LEVER_OPTIONAL_IF_DOM_OPTIONAL_KEYS = new Set([
  "current_location_display",
  "data_processing_consent",
]);

const LEVER_OPENAI_BLOCKED_PATTERNS = [
  "authorized",
  "eligible to work",
  "right to work",
  "visa",
  "sponsorship",
  "salary",
  "compensation",
  "notice period",
  "start date",
  "privacy",
  "consent",
  "notetaker",
  "note taker",
  "gender",
  "veteran",
  "disability",
  "race",
  "ethnicity",
  "criminal",
  "background check",
];

const LEVER_SPECS: LeverCanonicalSpec[] = [
  {
    canonicalKey: "current_company",
    answerKind: "text",
    fillOrder: 65,
    questionClass: "contact",
    answerabilityClass: "derived_profile",
    requiredPreflight: false,
    isMatch: (question) => {
      const prompt = normalizeAshbyText(question.question_text);
      const name = question.representative_field.name ?? "";
      return name === "org" || prompt === "company" || prompt.includes("current company") || prompt === "organization";
    },
    resolveValue: (_question, profileAnswers) => profileAnswers.current_company ?? null,
  },
  {
    canonicalKey: "work_authorized_applied_country",
    answerKind: "choice",
    fillOrder: 88,
    questionClass: "work_auth",
    answerabilityClass: "user_truth_required",
    requiredPreflight: true,
    isMatch: (question) => {
      const prompt = normalizeAshbyText(`${question.question_text} ${question.options.join(" ")}`);
      return (
        prompt.includes("authorized to work") &&
        (prompt.includes("country for which you are applying") || prompt.includes("country you are applying"))
      );
    },
    resolveValue: (question, profileAnswers) =>
      resolveLeverChoiceValue(profileAnswers.work_authorized_applied_country, question.options, {
        yes: ["Yes"],
        no: ["No"],
      }),
  },
  {
    canonicalKey: "visa_sponsorship_required",
    answerKind: "choice",
    fillOrder: 100,
    questionClass: "work_auth",
    answerabilityClass: "user_truth_required",
    requiredPreflight: true,
    isMatch: (question) => {
      const prompt = normalizeAshbyText(question.question_text);
      return prompt.includes("require sponsorship") || prompt.includes("visa sponsorship");
    },
    resolveValue: (question, profileAnswers) =>
      resolveLeverChoiceValue(profileAnswers.visa_sponsorship_required, question.options, {
        yes: ["Yes"],
        no: ["No"],
      }),
  },
  {
    canonicalKey: "lever_relocation_visa_situation",
    answerKind: "text",
    fillOrder: 106,
    questionClass: "work_auth",
    answerabilityClass: "user_truth_required",
    requiredPreflight: true,
    isMatch: (question) => {
      const prompt = normalizeAshbyText(question.question_text);
      return prompt.includes("visa transfers") && prompt.includes("relocation assistance") && prompt.includes("confirm your situation");
    },
    resolveValue: (_question, profileAnswers) => profileAnswers.lever_relocation_visa_situation ?? null,
  },
  {
    canonicalKey: "ai_notetaker_consent",
    answerKind: "choice",
    fillOrder: 111,
    questionClass: "consent",
    answerabilityClass: "user_truth_required",
    requiredPreflight: true,
    isMatch: (question) => {
      const prompt = normalizeAshbyText(question.question_text);
      return prompt.includes("notetaker") && prompt.includes("consent");
    },
    resolveValue: () => null,
  },
  {
    canonicalKey: "university",
    answerKind: "choice",
    fillOrder: 127,
    questionClass: "long_form",
    answerabilityClass: "user_truth_required",
    requiredPreflight: true,
    isMatch: (question) => {
      const prompt = normalizeAshbyText(`${question.question_text} ${question.options.slice(0, 25).join(" ")}`);
      return prompt.includes("university") || prompt.includes("school not listed");
    },
    resolveValue: (question, profileAnswers) =>
      resolveLeverUniversityChoice(profileAnswers.university, question.options),
  },
  {
    canonicalKey: "language_skills",
    answerKind: "choice",
    fillOrder: 128,
    questionClass: "long_form",
    answerabilityClass: "user_truth_required",
    requiredPreflight: true,
    isMatch: (question) => {
      const prompt = normalizeAshbyText(`${question.question_text} ${question.options.join(" ")}`);
      return prompt.includes("language skill") || (prompt.includes("check all that apply") && prompt.includes("english"));
    },
    resolveValue: (question, profileAnswers) =>
      resolveLeverChoiceValue(profileAnswers.language_skills, question.options, {
        english: ["English (ENG)", "English"],
        decline: ["Choose not to disclose"],
      }),
  },
];

function augmentLeverResolutionPlan(
  plan: AshbyResolutionPlan,
  args: {
    snapshot: LeverFormSnapshot;
    profileAnswers: Record<string, string | null>;
    organizationSlug: string | null;
  }
): AshbyResolutionPlan {
  let next = plan;
  for (const question of args.snapshot.questions) {
    const spec = LEVER_SPECS.find((candidate) => candidate.isMatch(question));
    if (!spec) continue;
    const value = spec.resolveValue(question, args.profileAnswers);
    next = applyLeverResolvedQuestion(next, {
      question,
      spec,
      value,
      organizationSlug: args.organizationSlug,
    });
  }

  const relaxed = relaxOptionalLeverBlocking(next);
  return {
    ...relaxed,
    fill_targets: [...relaxed.fill_targets].sort((left, right) => left.fill_order - right.fill_order),
    needs_user_answers: buildLeverProfilePreflightIssues(relaxed.missing_required),
  };
}

function relaxOptionalLeverBlocking(plan: AshbyResolutionPlan): AshbyResolutionPlan {
  const shouldRelax = (target: AshbyFillTarget) =>
    LEVER_OPTIONAL_IF_DOM_OPTIONAL_KEYS.has(target.canonical_key) && !target.question.required;
  return {
    ...plan,
    fill_targets: plan.fill_targets.map((target) => {
      if (!shouldRelax(target)) return target;
      return {
        ...target,
        answer: {
          ...target.answer,
          blocking_if_missing: false,
        },
      };
    }),
    resolved_answers: plan.resolved_answers.map((answer) => {
      if (!LEVER_OPTIONAL_IF_DOM_OPTIONAL_KEYS.has(answer.canonical_key)) return answer;
      return {
        ...answer,
        blocking_if_missing: false,
      };
    }),
  };
}

function applyLeverResolvedQuestion(
  plan: AshbyResolutionPlan,
  args: {
    question: AshbyQuestionNode;
    spec: LeverCanonicalSpec;
    value: string | null;
    organizationSlug: string | null;
  }
): AshbyResolutionPlan {
  const hasValue = Boolean(args.value?.trim());
  const resolved = {
    canonical_key: args.spec.canonicalKey,
    source: hasValue ? "profile" : "missing",
    source_detail: "lever_provider_mapping",
    value: args.value,
    present: hasValue,
    blocking_if_missing: args.question.required || args.spec.requiredPreflight,
    field_label: args.question.question_text,
    selector: args.question.primary_selector,
    confidence: hasValue ? "strong" : "none",
    scope_kind: args.organizationSlug ? "organization" : "global",
    scope_value: args.organizationSlug ?? "__global__",
    approved: hasValue,
  } as const;

  const mappingDecision: AshbyMappingDecision = {
    prompt_hash: args.question.prompt_hash,
    question_text: args.question.question_text,
    canonical_key: args.spec.canonicalKey,
    confidence: hasValue ? "strong" : "weak",
    source: "heuristic",
    question_class: args.spec.questionClass,
    answerability_class: args.spec.answerabilityClass,
    auto_accepted: hasValue,
    rationale: "lever provider mapping",
  };

  const missingRequired = plan.missing_required.filter(
    (blocker) => blocker.key !== args.question.prompt_hash && blocker.key !== args.spec.canonicalKey
  );
  const pendingReview = plan.pending_review.filter(
    (item) => item.prompt_hash !== args.question.prompt_hash && item.canonical_key_candidate !== args.spec.canonicalKey
  );
  const fillTargets = plan.fill_targets.filter(
    (target) => target.question.prompt_hash !== args.question.prompt_hash && target.canonical_key !== args.spec.canonicalKey
  );

  if (!hasValue && (args.question.required || args.spec.requiredPreflight)) {
    missingRequired.push({
      kind: "missing_required_answer",
      key: args.spec.canonicalKey,
      label: args.question.question_text,
      detail: "required Lever profile answer is missing",
      selector: args.question.primary_selector,
    });
    pendingReview.push(leverReviewItem(args.question, args.spec, args.organizationSlug, null, "required Lever profile answer is missing"));
  }

  if (hasValue && args.value) {
    const field = fieldForLeverTarget(args.question, args.value);
    fillTargets.push({
      question: args.question,
      field,
      canonical_key: args.spec.canonicalKey,
      answer: resolved,
      value: args.value,
      option_candidates: leverOptionCandidates(args.value, args.question.options),
      fill_order: args.spec.fillOrder,
      answer_kind: args.spec.answerKind,
    } satisfies AshbyFillTarget);
  }

  return {
    ...plan,
    resolved_answers: [
      ...plan.resolved_answers.filter(
        (answer) => answer.canonical_key !== args.spec.canonicalKey || answer.selector !== args.question.primary_selector
      ),
      resolved,
    ],
    mapping_decisions: [
      ...plan.mapping_decisions.filter((decision) => decision.prompt_hash !== args.question.prompt_hash),
      mappingDecision,
    ],
    fill_targets: fillTargets,
    missing_required: missingRequired,
    pending_review: pendingReview,
  };
}

function leverReviewItem(
  question: AshbyQuestionNode,
  spec: LeverCanonicalSpec,
  organizationSlug: string | null,
  answerCandidate: string | null,
  reason: string
): AshbyReviewItem {
  return {
    organization_slug: organizationSlug,
    prompt_hash: question.prompt_hash,
    question_text: question.question_text,
    normalized_prompt: question.normalized_prompt,
    control_kind: question.control_kind,
    widget_family: question.widget_family,
    question_class: spec.questionClass,
    answerability_class: spec.answerabilityClass,
    options: question.options,
    helper_copy: question.helper_copy,
    section_path: question.section_path,
    canonical_key_candidate: spec.canonicalKey,
    answer_candidate: answerCandidate,
    confidence: "weak",
    source: "matcher",
    reason,
    selector: question.primary_selector,
    scope_kind: organizationSlug ? "organization" : "global",
    scope_value: organizationSlug,
  };
}

function buildLeverProfilePreflightIssues(
  missingRequired: AshbyBlocker[]
): AshbyProfilePreflightIssue[] {
  return missingRequired
    .filter((blocker) => LEVER_HARD_TRUTH_REQUIRED_KEYS.has(blocker.key))
    .map((blocker) => ({
      canonicalKey: blocker.key,
      label: blocker.label,
      reason: blocker.detail,
      selector: blocker.selector,
    }));
}

function buildLeverProfileAnswers(profile: unknown): Record<string, string | null> {
  const root = asRecord(profile) ?? {};
  const workAuth = asRecord(root.workAuth) ?? asRecord(root.workAuthorization) ?? {};
  const application = asRecord(root.application) ?? {};
  return {
    current_company: currentCompany(root),
    work_authorized_applied_country:
      yesNoValue(workAuth.authorizedToWorkInAppliedCountry) ??
      yesNoValue(workAuth.authorizedToWorkInCountry) ??
      yesNoValue(application.authorizedToWorkInAppliedCountry) ??
      yesNoValue(application.workAuthorizedInAppliedCountry),
    visa_sponsorship_required:
      yesNoValue(workAuth.needsSponsorshipNow) ??
      yesNoValue(workAuth.requiresSponsorship) ??
      yesNoValue(workAuth.needsVisaSponsorship) ??
      yesNoValue(application.needsSponsorshipNow) ??
      yesNoValue(application.requiresSponsorship) ??
      yesNoValue(application.needsVisaSponsorship),
    lever_relocation_visa_situation: relocationVisaSituation(root, workAuth, application),
    university: university(root),
    language_skills: languageSkills(root),
  };
}

function isLeverOpenAiDraftCandidate(question: AshbyQuestionNode): boolean {
  const prompt = normalizeAshbyText(`${question.question_text} ${question.options.join(" ")}`);
  return !LEVER_OPENAI_BLOCKED_PATTERNS.some((pattern) => prompt.includes(pattern));
}

function resolveLeverChoiceValue(
  value: string | null | undefined,
  options: string[],
  mappings: Record<string, string[]>
): string | null {
  const normalizedValue = normalizeAshbyText(value);
  if (!normalizedValue) return null;
  const exact = options.find((option) => normalizeAshbyText(option) === normalizedValue);
  if (exact) return exact;
  const mapped = mappings[normalizedValue] ?? [];
  for (const candidate of mapped) {
    const option = options.find((item) => normalizeAshbyText(item) === normalizeAshbyText(candidate));
    if (option) return option;
  }
  if (options.length === 0) return value ?? null;
  return null;
}

function resolveLeverUniversityChoice(value: string | null | undefined, options: string[]): string | null {
  const normalizedValue = normalizeAshbyText(value);
  if (!normalizedValue) return null;
  const exact = options.find((option) => normalizeAshbyText(option) === normalizedValue);
  if (exact) return exact;
  const schoolNotListed = options.find((option) => {
    const normalized = normalizeAshbyText(option);
    return normalized.includes("school not listed") || normalized === "other";
  });
  return schoolNotListed ?? (options.length === 0 ? value ?? null : null);
}

function leverOptionCandidates(value: string, options: string[]): string[] {
  const normalizedValue = normalizeAshbyText(value);
  const exact = options.find((option) => normalizeAshbyText(option) === normalizedValue);
  return uniqueOriginalStrings([value, exact]);
}

function fieldForLeverTarget(question: AshbyQuestionNode, value: string): AshbyFieldObservation {
  if (question.control_kind !== "radio" && question.control_kind !== "checkbox") {
    return question.representative_field;
  }
  const expected = normalizeAshbyText(value);
  const control = question.source_controls.find((candidate) => {
    const text = normalizeAshbyText(`${candidate.label ?? ""} ${candidate.selector ?? ""}`);
    return text.includes(`value="${expected}"`) || text.includes(`value='${expected}'`) || text.includes(`[value=${expected}]`) || text.includes(expected);
  });
  if (!control?.selector) return question.representative_field;
  return {
    ...question.representative_field,
    selector_hint: control.selector,
    label: control.label ?? question.representative_field.label,
    name: control.name ?? question.representative_field.name,
    id: control.id ?? question.representative_field.id,
  };
}

function isLeverChoiceRepairCandidate(target: AshbyFillTarget): boolean {
  return target.field.control_kind === "radio" || target.field.control_kind === "checkbox";
}

async function fillLeverChoiceTarget(
  page: LeverPageLike,
  target: AshbyFillTarget,
  previous: AshbyFillOperation
): Promise<AshbyFillOperation> {
  await installEvaluateNameHelper(page);
  const result = await page.evaluate(
    ({ selector, value, optionCandidates }) => {
      const normalize = (input: string | null | undefined) =>
        (input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const labelFor = (input: HTMLInputElement) => {
        const labels = input.labels ? Array.from(input.labels).map((label) => label.textContent ?? "") : [];
        return [
          ...labels,
          input.closest("label")?.textContent ?? "",
          input.value,
        ].join(" ");
      };
      const selected = selector ? document.querySelector(selector) : null;
      const selectedInput = selected instanceof HTMLInputElement ? selected : null;
      const group = selectedInput?.name
        ? Array.from(document.querySelectorAll<HTMLInputElement>(
            `input[type="${selectedInput.type}"][name="${selectedInput.name.replace(/"/g, '\\"')}"]`
          ))
        : Array.from(document.querySelectorAll<HTMLInputElement>("input[type='radio'], input[type='checkbox']"));
      const expected = [value, ...optionCandidates].map(normalize).filter(Boolean);
      const match = group.find((input) => {
        const haystack = normalize(labelFor(input));
        const inputValue = normalize(input.value);
        return expected.some((candidate) => inputValue === candidate || haystack.includes(candidate));
      }) ?? selectedInput;
      if (!match) return { ok: false, selected: null, reason: "lever_choice_input_not_found" };

      if (match.type === "radio") {
        match.checked = true;
      } else {
        const wantsFalse = expected.some((candidate) => ["no", "false", "unchecked"].includes(candidate));
        match.checked = !wantsFalse;
      }
      match.dispatchEvent(new Event("input", { bubbles: true }));
      match.dispatchEvent(new Event("change", { bubbles: true }));
      const verified = match.type === "checkbox"
        ? match.checked === !expected.some((candidate) => ["no", "false", "unchecked"].includes(candidate))
        : match.checked;
      return {
        ok: verified,
        selected: labelFor(match).replace(/\s+/g, " ").trim() || match.value,
        reason: verified ? null : "lever_choice_repair_not_verified",
      };
    },
    {
      selector: target.field.selector_hint ?? target.question.primary_selector,
      value: target.value,
      optionCandidates: target.option_candidates,
    }
  );

  if (!result.ok) {
    return {
      ...previous,
      detail: `lever_choice_repair_failed:${result.reason ?? "unknown"}:${result.selected ?? ""}`,
    };
  }
  return {
    key: target.canonical_key,
    status: "filled",
    selector: target.field.selector_hint ?? target.question.primary_selector,
    detail: `lever_choice_repair:${result.selected}`,
    verified: true,
    blocking: Boolean(target.answer.blocking_if_missing || target.question.required),
  };
}

async function fillLeverLocationTarget(
  page: LeverPageLike,
  target: AshbyFillTarget,
  previous: AshbyFillOperation
): Promise<AshbyFillOperation> {
  await installEvaluateNameHelper(page);
  const result = await page.evaluate(
    ({ selector, value }) => {
      const element = selector ? document.querySelector(selector) : document.querySelector("input[name='location']");
      if (!(element instanceof HTMLInputElement)) {
        return { ok: false, observed: null, reason: "lever_location_input_not_found" };
      }
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      element.focus();
      if (valueSetter) valueSetter.call(element, value);
      else element.value = value;
      element.setAttribute("value", value);
      const hidden = document.querySelector("input[name='selectedLocation']");
      if (hidden instanceof HTMLInputElement) {
        if (valueSetter) valueSetter.call(hidden, value);
        else hidden.value = value;
        hidden.setAttribute("value", value);
        hidden.dispatchEvent(new Event("input", { bubbles: true }));
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
      }
      element.blur();
      const observed = element.value || element.getAttribute("value") || (hidden instanceof HTMLInputElement ? hidden.value : "");
      return { ok: observed.trim().length > 0, observed, reason: null };
    },
    {
      selector: target.field.selector_hint ?? target.question.primary_selector,
      value: target.value,
    }
  );

  if (!result.ok) {
    return {
      ...previous,
      detail: `lever_location_repair_failed:${result.reason ?? "unknown"}:${result.observed ?? ""}`,
    };
  }
  return {
    key: target.canonical_key,
    status: "filled",
    selector: target.field.selector_hint ?? target.question.primary_selector,
    detail: `lever_location_repair:${result.observed}`,
    verified: true,
    blocking: Boolean(target.answer.blocking_if_missing || target.question.required),
  };
}

function currentCompany(root: Record<string, unknown>): string | null {
  const explicit =
    stringValue(getPath(root, ["application", "currentCompany"])) ??
    stringValue(getPath(root, ["contact", "company"])) ??
    stringValue(getPath(root, ["profile", "currentCompany"]));
  if (explicit) return explicit;

  const experience = Array.isArray(root.experience)
    ? root.experience
    : Array.isArray(getPath(root, ["profile", "experience"]))
      ? getPath(root, ["profile", "experience"]) as unknown[]
      : [];
  const current = experience
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .find((item) => !stringValue(item.endDate) && !stringValue(item.end));
  const first = current ?? (asRecord(experience[0]) ?? null);
  return first ? stringValue(first.company) ?? stringValue(first.organization) : null;
}

function university(root: Record<string, unknown>): string | null {
  const explicit =
    stringValue(getPath(root, ["application", "university"])) ??
    stringValue(getPath(root, ["education", "school"])) ??
    stringValue(getPath(root, ["profile", "education", "school"]));
  if (explicit) return explicit;
  const education = Array.isArray(root.education)
    ? root.education
    : Array.isArray(getPath(root, ["profile", "education"]))
      ? getPath(root, ["profile", "education"]) as unknown[]
      : [];
  const first = asRecord(education[0]);
  return first ? stringValue(first.school) ?? stringValue(first.university) ?? stringValue(first.institution) : null;
}

function languageSkills(root: Record<string, unknown>): string | null {
  const explicit =
    stringValue(getPath(root, ["application", "languageSkills"])) ??
    stringValue(getPath(root, ["application", "languages"]));
  if (explicit) return explicit;
  const languages = uniqueOriginalStrings([
    ...stringArrayValue(root.languages),
    ...stringArrayValue(getPath(root, ["profile", "languages"])),
    ...stringArrayValue(getPath(root, ["application", "languageSkills"])),
  ]);
  if (languages.length === 0) return null;
  const normalized = languages.map(normalizeAshbyText);
  if (normalized.some((item) => item.includes("english"))) return "English (ENG)";
  return languages[0] ?? null;
}

function relocationVisaSituation(
  root: Record<string, unknown>,
  workAuth: Record<string, unknown>,
  application: Record<string, unknown>
): string | null {
  const explicit =
    stringValue(application.relocationVisaSituation) ??
    stringValue(application.visaRelocationSituation) ??
    stringValue(workAuth.relocationVisaSituation) ??
    stringValue(workAuth.visaRelocationSituation) ??
    stringValue(application.immigrationStatus) ??
    stringValue(workAuth.immigrationStatus);
  if (explicit) return explicit;

  const citizenship =
    stringValue(application.citizenship) ??
    stringValue(workAuth.citizenship) ??
    stringValue(root.citizenship) ??
    stringValue(application.nationality) ??
    stringValue(workAuth.nationality) ??
    stringValue(root.nationality);
  return citizenship ? `I am a ${citizenship} citizen.` : null;
}

function yesNoValue(value: unknown): string | null {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = stringValue(value);
  if (!text) return null;
  const normalized = normalizeAshbyText(text);
  if (["yes", "true", "y"].includes(normalized)) return "Yes";
  if (["no", "false", "n"].includes(normalized)) return "No";
  return text;
}

function getPath(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringValue).filter((item): item is string => Boolean(item)) : [];
}

function uniqueOriginalStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeAshbyText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push((value ?? "").replace(/\s+/g, " ").trim());
  }
  return result;
}

async function submitLeverApplication(
  page: LeverPageLike,
  context: {
    companySlug: string;
    postingId: string;
    browserbaseCaptchaSolving?: boolean;
    captchaObserver?: ReturnType<typeof createBrowserbaseCaptchaObserver> | null;
    notes?: string[];
  }
): Promise<{
  attempted: boolean;
  evidence: LeverFormFillResult["submissionEvidence"];
  snapshot: LeverFormSnapshot;
  blockers: AshbyBlocker[];
}> {
  await installEvaluateNameHelper(page);
  const submitSelector = await page.evaluate(() => {
    const isVisible = (element: Element | null | undefined): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const submit = Array.from(document.querySelectorAll<HTMLElement>("#btn-submit, [data-qa='btn-submit'], button, input[type='submit'], input[type='button']"))
      .filter(isVisible)
      .find((element) => /submit/i.test(element instanceof HTMLInputElement ? element.value : element.textContent ?? ""));
    if (!submit) return null;
    submit.setAttribute("data-recruit-lever-submit", "true");
    submit.scrollIntoView({ block: "center", inline: "center" });
    return "[data-recruit-lever-submit='true']";
  }, undefined);

  if (!submitSelector) {
    const snapshot = await inspectLeverPage(page, context);
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

  await clickLeverSubmitControl(page, submitSelector);
  await waitForTimeout(page, 3000);
  const tokenAfterFirstClick = context.browserbaseCaptchaSolving
    ? await waitForBrowserbaseCaptchaProgress(page, context.captchaObserver, context.notes ?? [], "post-submit", 90_000)
    : false;
  if (tokenAfterFirstClick) {
    await clickLeverSubmitControl(page, submitSelector);
    await waitForTimeout(page, 8000);
  } else {
    await waitForTimeout(page, 4000);
  }
  let snapshot = await inspectLeverPage(page, context);
  let evidence = classifySubmissionSnapshot(snapshot);

  if (
    context.browserbaseCaptchaSolving &&
    evidence.outcome === "ambiguous" &&
    snapshot.hcaptcha_present &&
    snapshot.submit_controls > 0
  ) {
    const tokenPresent = await waitForCaptchaToken(page, "post-submit-retry", context.notes ?? [], 30_000);
    if (tokenPresent) {
      await clickLeverSubmitControl(page, submitSelector);
      await waitForTimeout(page, 10_000);
      await context.captchaObserver?.waitForSettled("post-submit-retry", 30_000);
      snapshot = await inspectLeverPage(page, context);
      evidence = classifySubmissionSnapshot(snapshot);
    }
  }

  if (
    context.browserbaseCaptchaSolving &&
    evidence.outcome === "ambiguous" &&
    snapshot.hcaptcha_present &&
    snapshot.submit_controls > 0 &&
    !hasCaptchaTokenSolveSuccess(context.notes ?? [])
  ) {
    return {
      attempted: true,
      evidence: {
        outcome: "unsupported_gate",
        details: ["Browserbase hCaptcha solving started but did not finish; no CAPTCHA token was produced"],
        url: snapshot.url,
      },
      snapshot,
      blockers: [{
        kind: "unexpected_verification_gate",
        key: "browserbase_hcaptcha_timeout",
        label: null,
        detail: "Browserbase hCaptcha solving started but did not finish; no CAPTCHA token was produced",
        selector: "#h-captcha",
      }],
    };
  }

  return {
    attempted: true,
    evidence,
    snapshot,
    blockers: [],
  };
}

function hasCaptchaTokenSolveSuccess(notes: string[]): boolean {
  return notes.some((note) =>
    note === "browserbase_captcha_solving_finished=true" ||
    note.startsWith("captcha_token_present_phase=")
  );
}

function createBrowserbaseCaptchaObserver(page: LeverPageLike, notes: string[]) {
  const consolePage = page as BrowserbaseConsolePage;
  let started = false;
  let finished = false;
  let finishedResolve: (() => void) | null = null;
  const finishedPromise = new Promise<void>((resolve) => {
    finishedResolve = resolve;
  });
  const handler = (message: BrowserbaseConsoleMessage) => {
    const text = message.text();
    if (text === "browserbase-solving-started") {
      started = true;
      finished = false;
      notes.push("browserbase_captcha_solving_started=true");
    }
    if (text === "browserbase-solving-finished") {
      finished = true;
      notes.push("browserbase_captcha_solving_finished=true");
      finishedResolve?.();
    }
  };
  consolePage.on?.("console", handler);
  return {
    async waitForSettled(phase: string, timeoutMs = 35_000) {
      if (!consolePage.on) return;
      await waitForTimeout(page, 1500);
      if (!started || finished) return;
      notes.push(`browserbase_captcha_wait_phase=${phase}`);
      await Promise.race([
        finishedPromise,
        waitForTimeout(page, timeoutMs).then(() => {
          notes.push(`browserbase_captcha_wait_timeout_phase=${phase}`);
        }),
      ]);
    },
    dispose() {
      consolePage.off?.("console", handler);
      consolePage.removeListener?.("console", handler);
    },
  };
}

async function clickLeverSubmitControl(page: LeverPageLike, submitSelector: string): Promise<void> {
  const handle = await page.$?.(submitSelector);
  if (handle?.click) {
    await handle.click();
    await handle.dispose?.();
    return;
  }
  await page.evaluate(() => {
    const submit = document.querySelector("[data-recruit-lever-submit='true']");
    if (submit instanceof HTMLElement) submit.click();
  }, undefined);
}

async function waitForBrowserbaseCaptchaProgress(
  page: LeverPageLike,
  observer: ReturnType<typeof createBrowserbaseCaptchaObserver> | null | undefined,
  notes: string[],
  phase: string,
  timeoutMs: number
): Promise<boolean> {
  const settleWait = observer?.waitForSettled(phase, timeoutMs).catch(() => undefined);
  const tokenPresent = await waitForCaptchaToken(page, phase, notes, timeoutMs);
  if (tokenPresent) return true;
  await settleWait;
  return tokenPresent;
}

async function waitForCaptchaToken(
  page: LeverPageLike,
  phase: string,
  notes: string[],
  timeoutMs: number
): Promise<boolean> {
  const selector = [
    "#hcaptchaResponseInput",
    "[name='h-captcha-response']",
    "[name='g-recaptcha-response']",
    "input[name='cf-turnstile-response']",
  ].join(",");
  const hasCaptchaTokenField = await page.evaluate(
    ({ selector }) => Boolean(document.querySelector(selector)),
    { selector }
  ).catch(() => false);
  if (!hasCaptchaTokenField) return false;

  notes.push(`captcha_token_wait_phase=${phase}`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tokenPresent = await page.evaluate(
      ({ selector }) =>
        Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector))
          .some((element) => element.value.trim().length > 0),
      { selector }
    ).catch(() => false);
    if (tokenPresent) {
      notes.push(`captcha_token_present_phase=${phase}`);
      return true;
    }
    await waitForTimeout(page, 1000);
  }
  notes.push(`captcha_token_wait_timeout_phase=${phase}`);
  return false;
}

async function waitForLeverHydration(page: LeverPageLike, notes: string[]): Promise<void> {
  try {
    await page.waitForSelector("input[name='resume'], [data-qa='name-input'], .application-form", { timeout: 20_000 });
  } catch (error) {
    notes.push(`lever_hydration_wait_failed=${safeMessage(error)}`);
    await waitForTimeout(page, 1500);
  }
}

async function waitForTimeout(page: LeverPageLike, timeoutMs: number): Promise<void> {
  return page.waitForTimeout?.(timeoutMs) ?? new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

async function screenshotMetadata(
  page: LeverPageLike,
  label: string
): Promise<{ label: string; captured: boolean; byteLength?: number; error?: string }> {
  if (!page.screenshot) return { label, captured: false, error: "screenshot_not_available" };
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

async function installEvaluateNameHelper(page: LeverPageLike): Promise<void> {
  const stringEvaluate = page as unknown as {
    evaluate(pageFunction: string): Promise<unknown>;
  };
  await stringEvaluate.evaluate(`
    globalThis.__name = globalThis.__name || ((fn) => fn);
    globalThis.n = globalThis.n || ((fn) => fn);
  `);
}

export type {
  AshbyFieldObservation as LeverCompatibleFieldObservation,
};
