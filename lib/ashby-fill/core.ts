import type {
  AshbyApprovedAnswer,
  AshbyBlocker,
  AshbyControlKind,
  AshbyDraftAnswer,
  AshbyDraftAnswerMode,
  AshbyFieldObservation,
  AshbyFillOperation,
  AshbyFillTarget,
  AshbyFormSnapshot,
  AshbyMappingDecision,
  AshbyOutcomeClass,
  AshbyPromptAlias,
  AshbyProfilePreflightIssue,
  AshbyQuestionClass,
  AshbyQuestionNode,
  AshbyResolutionPlan,
  AshbyResolvedAnswer,
  AshbyReviewItem,
  AshbyRunGrade,
  AshbySubmissionEvidence,
  AshbyValidationState,
  AshbyWidgetFamily,
} from "./types";

const GLOBAL_SCOPE_VALUE = "__global__";

const HARD_TRUTH_REQUIRED_KEYS = new Set([
  "resume_file",
  "phone",
  "work_authorized_us",
  "visa_sponsorship_required",
  "commute_or_relocate",
  "current_location_display",
  "preferred_working_location",
  "earliest_start_date",
  "notice_period",
  "salary_expectations",
]);

const CONFIRMATION_PATTERNS = [
  "thank you for applying",
  "application submitted",
  "successfully submitted",
  "your application was successfully submitted",
  "we've received your application",
  "we have received your application",
  "your application has been submitted",
  "thanks for applying",
];

const VERIFICATION_PATTERNS = [
  "verification code",
  "security code",
  "enter the code",
  "confirm you're a human",
  "captcha",
  "verify your email",
];

const SPAM_PATTERNS = [
  "marked as spam",
  "possible spam",
  "identified as spam",
  "detected as spam",
  "unable to accept your application",
];

type CanonicalSpec = {
  canonicalKey: string;
  answerKind: "text" | "choice" | "file";
  fillOrder: number;
  labels: string[];
  prompts: string[];
  requiredByDefault: boolean;
  questionClass: AshbyQuestionClass;
  answerabilityClass:
    | "safe_known"
    | "derived_profile"
    | "organization_scoped"
    | "user_truth_required"
    | "custom_bespoke";
  optionMappings?: Record<string, string[]>;
  defaultValue?: string | null;
};

const CANONICAL_LIBRARY: CanonicalSpec[] = [
  spec("resume_file", "file", 10, "document", "safe_known", true, [
    "resume",
    "resume/cv",
    "upload resume",
    "cv",
  ]),
  spec("cover_letter_file", "file", 15, "document", "safe_known", false, [
    "cover letter",
    "upload cover letter",
  ]),
  spec("full_name", "text", 20, "identity", "derived_profile", true, [
    "full name",
    "name",
  ]),
  spec("first_name", "text", 30, "identity", "derived_profile", false, [
    "first name",
    "legal first name",
    "preferred first name",
  ]),
  spec("last_name", "text", 40, "identity", "derived_profile", false, [
    "last name",
    "legal last name",
    "surname",
    "family name",
  ]),
  spec("email", "text", 50, "contact", "safe_known", true, [
    "email",
    "email address",
  ]),
  spec("phone", "text", 60, "contact", "safe_known", true, [
    "phone",
    "phone number",
    "mobile phone",
    "contact number",
  ]),
  spec("current_location_display", "text", 70, "location", "derived_profile", true, [
    "current location",
    "location",
    "where are you physically based",
    "where are you currently located",
  ]),
  spec("linkedin_url", "text", 80, "link", "safe_known", false, [
    "linkedin",
    "linkedin profile",
    "linkedin url",
  ]),
  spec("github_url", "text", 82, "link", "safe_known", false, [
    "github",
    "github profile",
    "github url",
  ]),
  spec("portfolio_url", "text", 84, "link", "safe_known", false, [
    "portfolio",
    "website",
    "portfolio website",
    "personal website",
  ]),
  spec("project_demo_url", "text", 85, "link", "safe_known", false, [
    "demo link to the personal project you are most proud of",
    "demo link to your proudest project",
    "personal project you are most proud of",
    "project demo link",
  ]),
  spec(
    "work_authorized_us",
    "choice",
    90,
    "work_auth",
    "user_truth_required",
    false,
    [
      "legally authorized to work in the united states",
      "authorized to work in the u.s",
      "authorized to work in the us",
      "authorized to work in the united states",
      "right to work in the location",
      "right to work in the location in which you have applied",
      "right to work in the location you have applied",
    ],
    {
      yes: ["Yes", "Yes, I have ongoing right to work"],
      no: ["No"],
    }
  ),
  spec(
    "visa_sponsorship_required",
    "choice",
    100,
    "work_auth",
    "user_truth_required",
    false,
    ["require sponsorship", "visa sponsorship", "immigration sponsorship"],
    { yes: ["Yes"], no: ["No"] }
  ),
  spec(
    "commute_or_relocate",
    "choice",
    105,
    "location",
    "derived_profile",
    false,
    ["able to commute", "willing to relocate", "relocate", "office location", "50% of the time", "onsite"],
    { yes: ["Yes"], no: ["No"] }
  ),
  spec(
    "data_processing_consent",
    "choice",
    110,
    "consent",
    "safe_known",
    false,
    [
      "give your consent",
      "collection and use of your information",
      "i accept",
      "data processing",
      "privacy notice",
      "attio privacy notice",
      "i have read, understand and accept",
      "consent to the processing of my data",
      "i agree",
      "agree to allow",
      "allow aleph alpha to contact you",
    ],
    { i_accept: ["I Accept.", "I Accept", "Accept", "Yes", "I agree"] },
    "I Accept."
  ),
  spec("earliest_start_date", "text", 112, "contact", "user_truth_required", false, [
    "pick date",
    "pick date...",
    "earliest start date",
    "available start date",
    "start date",
  ]),
  spec("notice_period", "text", 114, "contact", "user_truth_required", false, [
    "notice period",
    "what is your notice period",
  ]),
  spec("salary_expectations", "text", 116, "contact", "user_truth_required", false, [
    "salary expectations",
    "expected salary",
    "compensation expectations",
  ]),
  spec(
    "how_did_you_hear_about_us",
    "choice",
    120,
    "contact",
    "safe_known",
    false,
    ["how did you hear about", "how did you hear"],
    {
      linkedin: ["LinkedIn"],
      company_website: ["Company Website", "Website", "Careers page", "Career page", "Careers Page"],
      referral: ["Referral", "Employee Referral"],
      recruiter: ["Recruiter"],
    },
    "Company Website"
  ),
  spec(
    "preferred_working_location",
    "choice",
    122,
    "location",
    "derived_profile",
    true,
    [
      "preferred working location",
      "prefered working location",
      "working location",
      "based in one of these countries",
      "candidates to be based",
    ],
    {
      remote: ["Remote", "UK [Remote]", "United States [Remote]", "Canada [Remote]"],
      hybrid: ["Hybrid", "London [Hybrid]"],
      london: ["London [Hybrid]"],
      uk_remote: ["UK [Remote]"],
    }
  ),
  spec(
    "main_development_language",
    "choice",
    124,
    "long_form",
    "derived_profile",
    false,
    [
      "main development language",
      "primary development language",
      "primary programming language",
    ],
    {
      typescript: ["Javascript/Typescript", "TypeScript", "Javascript", "JavaScript"],
      javascript: ["Javascript/Typescript", "Javascript", "JavaScript", "TypeScript"],
      python: ["Python"],
      "c++": ["C++"],
      cpp: ["C++"],
      java: ["Java"],
      other: ["Other"],
    }
  ),
  spec("primary_tech_stack", "text", 125, "long_form", "derived_profile", false, [
    "primary tech stack",
    "programming languages",
    "libraries/frameworks",
  ]),
  spec("rust_skill_rating", "text", 126, "long_form", "user_truth_required", false, [
    "scale of beginner",
    "advanced(10)",
    "regarding rust",
    "rust skill",
  ]),
  spec("why_this_company", "text", 130, "long_form", "organization_scoped", false, [
    "why are you interested",
    "why do you want to work",
    "what interests you",
  ]),
  spec(
    "gender_identity",
    "choice",
    900,
    "demographic",
    "safe_known",
    false,
    ["gender"],
    { decline: declineDemographicOptions() },
    "Prefer not to answer"
  ),
  spec(
    "veteran_status",
    "choice",
    910,
    "demographic",
    "safe_known",
    false,
    ["veteran status"],
    { decline: declineDemographicOptions() },
    "Prefer not to answer"
  ),
  spec(
    "disability_status",
    "choice",
    920,
    "demographic",
    "safe_known",
    false,
    ["disability status"],
    { decline: declineDemographicOptions() },
    "Prefer not to answer"
  ),
];

function spec(
  canonicalKey: string,
  answerKind: CanonicalSpec["answerKind"],
  fillOrder: number,
  questionClass: AshbyQuestionClass,
  answerabilityClass: CanonicalSpec["answerabilityClass"],
  requiredByDefault: boolean,
  prompts: string[],
  optionMappings?: Record<string, string[]>,
  defaultValue?: string | null
): CanonicalSpec {
  return {
    canonicalKey,
    answerKind,
    fillOrder,
    labels: prompts,
    prompts,
    requiredByDefault,
    questionClass,
    answerabilityClass,
    optionMappings,
    defaultValue,
  };
}

export function normalizeAshbyText(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function hashAshbyPrompt(input: string | null | undefined): string | null {
  const normalized = normalizeAshbyText(input);
  if (!normalized) return null;

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function buildAshbyOptionSignature(options: string[]): string | null {
  const normalized = uniqueNormalized(options);
  return normalized.length > 0 ? normalized.join("|") : null;
}

export function extractAshbyOrganizationSlug(targetUrl: string): string | null {
  try {
    const url = new URL(targetUrl);
    const [slug] = url.pathname.split("/").filter(Boolean);
    return slug ? slug.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function validateDirectAshbyApplicationUrl(targetUrl: string): {
  normalizedUrl: string;
  organizationSlug: string;
} {
  const url = new URL(targetUrl);
  if (url.hostname.toLowerCase() !== "jobs.ashbyhq.com") {
    throw new Error("ashby_url_host_not_supported");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length < 2) {
    throw new Error("ashby_direct_application_url_required");
  }

  if (pathParts.length === 2) {
    url.pathname = `/${pathParts[0]}/${pathParts[1]}/application`;
  }

  return {
    normalizedUrl: url.toString(),
    organizationSlug: pathParts[0].toLowerCase(),
  };
}

export function detectConfirmationTexts(bodyText: string): string[] {
  const normalized = normalizeAshbyText(bodyText);
  return CONFIRMATION_PATTERNS.filter((pattern) => normalized.includes(pattern));
}

export function detectUnexpectedVerificationGate(bodyText: string): boolean {
  const normalized = normalizeAshbyText(bodyText);
  return VERIFICATION_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function buildAshbyQuestionNodes(
  fields: AshbyFieldObservation[]
): AshbyQuestionNode[] {
  const grouped = new Map<
    string,
    {
      representative_field: AshbyFieldObservation;
      options: string[];
      section_path: string[];
      helper_copy: string[];
      source_controls: AshbyQuestionNode["source_controls"];
      required: boolean;
      validation_state: AshbyValidationState;
    }
  >();

  for (const field of fields) {
    const questionText =
      field.question_text ?? field.label ?? field.placeholder ?? field.selector_hint ?? "unknown";
    const normalizedPrompt = field.normalized_prompt ?? normalizeAshbyText(questionText);
    const promptHash = field.prompt_hash ?? hashAshbyPrompt(questionText) ?? normalizedPrompt;
    const key = [
      promptHash,
      widgetFamilyForControl(field.control_kind),
      normalizeAshbyText(field.section),
    ].join("|");
    const sourceControl = {
      selector: field.selector_hint,
      control_kind: field.control_kind,
      label: field.label,
      name: field.name,
      id: field.id,
    };
    const helperCopy = uniqueOriginalStrings([
      field.placeholder && normalizeAshbyText(field.placeholder) !== normalizedPrompt
        ? field.placeholder
        : null,
    ]);

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        representative_field: field,
        options: uniqueOriginalStrings(field.options),
        section_path: uniqueOriginalStrings([field.section]),
        helper_copy: helperCopy,
        source_controls: [sourceControl],
        required: field.required,
        validation_state: field.validation_state,
      });
      continue;
    }

    existing.options = uniqueOriginalStrings([...existing.options, ...field.options]);
    existing.section_path = uniqueOriginalStrings([...existing.section_path, field.section]);
    existing.helper_copy = uniqueOriginalStrings([...existing.helper_copy, ...helperCopy]);
    existing.source_controls = dedupeSourceControls([...existing.source_controls, sourceControl]);
    existing.required = existing.required || field.required;
    existing.validation_state = mergeValidationState(existing.validation_state, field.validation_state);
    existing.representative_field = betterRepresentativeField(existing.representative_field, field);
  }

  return [...grouped.values()]
    .map((group) => {
      const questionText =
        group.representative_field.question_text ??
        group.representative_field.label ??
        group.representative_field.placeholder ??
        group.representative_field.selector_hint ??
        "unknown";
      const normalizedPrompt =
        group.representative_field.normalized_prompt ?? normalizeAshbyText(questionText);
      const promptHash =
        group.representative_field.prompt_hash ?? hashAshbyPrompt(questionText) ?? normalizedPrompt;

      return {
        question_text: questionText,
        normalized_prompt: normalizedPrompt,
        prompt_hash: promptHash,
        widget_family: widgetFamilyForControl(group.representative_field.control_kind),
        control_kind: group.representative_field.control_kind,
        options: group.options,
        option_signature: buildAshbyOptionSignature(group.options),
        required: group.required,
        section_path: group.section_path,
        helper_copy: group.helper_copy,
        validation_state: group.validation_state,
        source_controls: group.source_controls,
        primary_selector: group.representative_field.selector_hint,
        representative_field: group.representative_field,
      };
    })
    .sort((left, right) => left.question_text.localeCompare(right.question_text));
}

export function buildAshbyProfileAnswers(profile: unknown): Record<string, string | null> {
  const root = asRecord(profile) ?? {};
  const links = asRecord(root.links) ?? asRecord(getPath(root, ["profile", "links"])) ?? {};
  const prefs = asRecord(root.prefs) ?? {};
  const files = asRecord(root.files) ?? asRecord(getPath(root, ["profile", "files"])) ?? {};
  const application =
    asRecord(root.application) ?? asRecord(getPath(root, ["profile", "application"])) ?? {};
  const identity = asRecord(root.identity) ?? {};
  const contact = asRecord(root.contact) ?? {};
  const workAuth = asRecord(root.workAuth) ?? {};
  const essays = asRecord(root.essays) ?? {};

  const fullName =
    stringValue(root.name) ??
    stringValue(identity.fullName) ??
    joinName(stringValue(identity.firstName), stringValue(identity.lastName));
  const firstName =
    stringValue(application.firstName) ?? stringValue(identity.firstName) ?? splitName(fullName).first;
  const lastName =
    stringValue(application.lastName) ?? stringValue(identity.lastName) ?? splitName(fullName).last;
  const location =
    stringValue(root.location) ??
    stringValue(contact.city) ??
    stringValue(application.city) ??
    stringValue(contact.state);

  const resumePath =
    absolutePathValue(files.resumePath) ??
    absolutePathValue(root.resumePath) ??
    absolutePathValue(getPath(root, ["resume", "path"]));
  const coverLetterPath =
    absolutePathValue(files.coverLetterPath) ?? absolutePathValue(root.coverLetterPath);

  const workAuthSignal =
    yesNoValue(workAuth.authorizedUS) ??
    yesNoValue(application.usWorkAuthorized) ??
    yesNoFromText(stringValue(prefs.workAuth));
  const sponsorshipSignal =
    yesNoValue(workAuth.needsSponsorshipNow) ??
    yesNoValue(application.visaSponsorship);

  return {
    resume_file: resumePath,
    cover_letter_file: coverLetterPath,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    email: stringValue(root.email) ?? stringValue(contact.email) ?? stringValue(getPath(root, ["user", "email"])),
    phone:
      stringValue(root.phone) ??
      stringValue(contact.phone) ??
      stringValue(contact.mobile) ??
      stringValue(contact.contactNumber) ??
      stringValue(application.phone) ??
      stringValue(application.contactNumber),
    current_location_display: location,
    linkedin_url: stringValue(links.linkedin),
    github_url: stringValue(links.github),
    portfolio_url: stringValue(links.portfolio) ?? stringValue(links.website),
    project_demo_url:
      stringValue(root.projectDemoUrl) ??
      stringValue(root.project_demo_url) ??
      stringValue(links.github) ??
      stringValue(links.portfolio) ??
      stringValue(links.website),
    work_authorized_us: workAuthSignal,
    visa_sponsorship_required: sponsorshipSignal,
    commute_or_relocate:
      yesNoValue(getPath(root, ["custom", "willingToRelocate"])) ??
      yesNoValue(application.onsitePreference) ??
      yesNoFromText(stringValue(application.workLocationPreference)),
    data_processing_consent: "I Accept.",
    earliest_start_date:
      stringValue(application.earliestStartDate) ??
      stringValue(application.availableStartDate) ??
      stringValue(application.startDate) ??
      stringValue(getPath(root, ["availability", "earliestStartDate"])),
    notice_period:
      stringValue(application.noticePeriod) ??
      stringValue(getPath(root, ["availability", "noticePeriod"])),
    salary_expectations:
      stringValue(application.salaryExpectations) ??
      stringValue(application.expectedSalary) ??
      stringValue(getPath(root, ["compensation", "salaryExpectations"])),
    how_did_you_hear_about_us:
      stringValue(getPath(root, ["referral", "howHeard"])) ??
      stringValue(application.howHeard) ??
      "Company Website",
    preferred_working_location:
      stringValue(application.preferredWorkingLocation) ??
      stringValue(getPath(root, ["preferences", "preferredWorkingLocation"])) ??
      preferredWorkingLocation(root),
    main_development_language:
      stringValue(application.mainDevelopmentLanguage) ??
      stringValue(application.primaryDevelopmentLanguage) ??
      mainDevelopmentLanguage(root),
    primary_tech_stack: primaryTechStack(root),
    rust_skill_rating:
      stringValue(application.rustSkillRating) ??
      stringValue(application.rustSkillSelfRating) ??
      stringValue(getPath(root, ["skillsRatings", "rust"])) ??
      stringValue(getPath(root, ["skillRatings", "rust"])),
    why_this_company:
      stringValue(application.whyCompany) ??
      stringValue(essays["Why are you interested in this role?"]) ??
      stringValue(essays["Why are you interested?"]) ??
      null,
    gender_identity: stringValue(getPath(root, ["eeo", "gender"])) ?? "Prefer not to answer",
    veteran_status: stringValue(getPath(root, ["eeo", "veteranStatus"])) ?? "Prefer not to answer",
    disability_status: stringValue(getPath(root, ["eeo", "disabilityStatus"])) ?? "Prefer not to answer",
  };
}

export function buildAshbyResolutionPlan(args: {
  snapshot: AshbyFormSnapshot;
  profileAnswers: Record<string, string | null>;
  aliases?: AshbyPromptAlias[];
  approvedAnswers?: AshbyApprovedAnswer[];
  draftAnswers?: AshbyDraftAnswer[];
  draftAnswerMode?: AshbyDraftAnswerMode;
  organizationSlug?: string | null;
}): AshbyResolutionPlan {
  const aliases = args.aliases ?? [];
  const approvedAnswers = args.approvedAnswers ?? [];
  const draftAnswers = args.draftAnswers ?? [];
  const draftAnswerMode = args.draftAnswerMode ?? "review_only";
  const organizationSlug = args.organizationSlug ?? null;
  const resolved_answers: AshbyResolvedAnswer[] = [];
  const mapping_decisions: AshbyMappingDecision[] = [];
  const fill_targets: AshbyFillTarget[] = [];
  const missing_required: AshbyBlocker[] = [];
  const unsupported_required: AshbyBlocker[] = [];
  const pending_review: AshbyReviewItem[] = [];
  let cached_alias_hits = 0;
  let cached_answer_hits = 0;

  for (const question of args.snapshot.questions) {
    const match = findAshbyQuestionMatch(question, aliases, organizationSlug);
    const draftAnswer = pickDraftAnswer(draftAnswers, question);
    if (match.source === "cache") cached_alias_hits++;

    mapping_decisions.push({
      prompt_hash: question.prompt_hash,
      question_text: question.question_text,
      canonical_key: match.spec?.canonicalKey ?? (draftAnswer ? `custom:${question.prompt_hash}` : null),
      confidence: draftAnswer ? draftAnswer.confidence : match.confidence,
      source: draftAnswer && !match.spec ? "llm" : match.source,
      question_class: match.spec?.questionClass ?? "custom_bespoke",
      answerability_class: match.spec?.answerabilityClass ?? "custom_bespoke",
      auto_accepted: draftAnswer
        ? draftAnswer.reviewStatus === "post_submit_review"
        : match.confidence === "exact" || match.confidence === "strong",
      rationale: draftAnswer?.rationale ?? match.rationale,
    });

    if (!question.representative_field.supported || question.control_kind === "unsupported") {
      if (question.required) {
        pushUniqueBlocker(unsupported_required, {
          kind: "unsupported_required_field",
          key: match.spec?.canonicalKey ?? question.prompt_hash,
          label: question.question_text,
          detail: `unsupported control: ${question.control_kind}`,
          selector: question.primary_selector,
        });
      }
      continue;
    }

    if (!match.spec) {
      if (draftAnswer && isDraftFillSupported(question)) {
        const customKey = `custom:${question.prompt_hash}`;
        resolved_answers.push(draftResolvedAnswer(question, organizationSlug, customKey, draftAnswer));
        const draftFillAllowed = draftAnswerMode === "fill";
        if (question.required && (draftAnswerMode !== "fill" || !draftFillAllowed)) {
          pushUniqueReviewItem(
            pending_review,
            reviewItem(
              question,
              organizationSlug,
              customKey,
              draftAnswer.answerValue,
              "draft answer requires review"
            )
          );
        }
        if (draftAnswerMode === "fill" && draftFillAllowed) {
          const fillableDraft = draftAnswerForFill(draftAnswer);
          const answer = draftResolvedAnswer(question, organizationSlug, customKey, fillableDraft);
          fill_targets.push({
            question,
            field: question.representative_field,
            canonical_key: customKey,
            answer,
            value: fillableDraft.answerValue,
            option_candidates: fillableDraft.answerKind === "choice"
              ? [fillableDraft.answerValue, ...question.options]
              : [],
            fill_order: 500,
            answer_kind: fillableDraft.answerKind,
          });
        }
        continue;
      }
      if (question.required) {
        pushUniqueReviewItem(pending_review, reviewItem(question, organizationSlug, null, null, "required prompt is unmapped"));
        pushUniqueBlocker(missing_required, {
          kind: "missing_required_answer",
          key: question.prompt_hash,
          label: question.question_text,
          detail: "required prompt is unmapped",
          selector: question.primary_selector,
        });
      }
      continue;
    }

    const answer = resolveAnswerForSpec({
      spec: match.spec,
      question,
      profileAnswers: args.profileAnswers,
      approvedAnswers,
      organizationSlug,
    });
    if (answer.source === "approved_answer" || answer.source === "cache") cached_answer_hits++;
    resolved_answers.push(answer);

    if (!answer.value) {
      if (draftAnswer && isDraftFillSupported(question) && match.spec.answerKind !== "file") {
        const draftFillAllowed = isDraftAllowedForCanonicalFill(match.spec.canonicalKey, draftAnswer);
        const draftResolved = draftResolvedAnswer(
          question,
          organizationSlug,
          match.spec.canonicalKey,
          draftAnswer
        );
        resolved_answers.push(draftResolved);
        if (draftAnswerMode !== "fill" || !draftFillAllowed) {
          pushUniqueReviewItem(
            pending_review,
            reviewItem(
              question,
              organizationSlug,
              match.spec.canonicalKey,
              draftAnswer.answerValue,
              "draft answer requires review"
            )
          );
        }
        if (draftAnswerMode === "fill" && draftFillAllowed) {
          const fillableDraft = draftAnswerForFill(draftAnswer);
          const draftResolvedForFill = draftResolvedAnswer(
            question,
            organizationSlug,
            match.spec.canonicalKey,
            fillableDraft
          );
          const value =
            match.spec.answerKind === "choice"
              ? resolveChoiceValue(match.spec, fillableDraft.answerValue, question.options)
              : normalizeDraftFillValue(match.spec.canonicalKey, fillableDraft.answerValue);
          if (!value) {
            pushUniqueReviewItem(
              pending_review,
              reviewItem(
                question,
                organizationSlug,
                match.spec.canonicalKey,
                fillableDraft.answerValue,
                "choice answer does not safely match available options"
              )
            );
            if (question.required || match.spec.requiredByDefault) {
              pushUniqueBlocker(missing_required, {
                kind: "missing_required_answer",
                key: match.spec.canonicalKey,
                label: question.question_text,
                detail: "choice answer does not safely match available options",
                selector: question.primary_selector,
              });
            }
            continue;
          }
          fill_targets.push({
            question,
            field: question.representative_field,
            canonical_key: match.spec.canonicalKey,
            answer: draftResolvedForFill,
            value,
            option_candidates: resolveOptionCandidates(match.spec, value, question.options),
            fill_order: match.spec.fillOrder,
            answer_kind: match.spec.answerKind,
          });
        }
        continue;
      }
      if (question.required || match.spec.requiredByDefault) {
        pushUniqueReviewItem(
          pending_review,
          reviewItem(question, organizationSlug, match.spec.canonicalKey, null, "required answer is missing")
        );
        pushUniqueBlocker(missing_required, {
          kind: "missing_required_answer",
          key: match.spec.canonicalKey,
          label: question.question_text,
          detail: "required answer is missing",
          selector: question.primary_selector,
        });
      }
      continue;
    }

    const value =
      match.spec.answerKind === "choice"
        ? resolveChoiceValue(match.spec, answer.value, question.options)
        : answer.value;
    if (!value) {
      pushUniqueReviewItem(
        pending_review,
        reviewItem(
          question,
          organizationSlug,
          match.spec.canonicalKey,
          answer.value,
          "choice answer does not safely match available options"
        )
      );
      if (question.required || match.spec.requiredByDefault) {
        pushUniqueBlocker(missing_required, {
          kind: "missing_required_answer",
          key: match.spec.canonicalKey,
          label: question.question_text,
          detail: "choice answer does not safely match available options",
          selector: question.primary_selector,
        });
      }
      continue;
    }
    const optionCandidates = resolveOptionCandidates(match.spec, answer.value, question.options);

    pushUniqueFillTarget(fill_targets, {
      question,
      field: question.representative_field,
      canonical_key: match.spec.canonicalKey,
      answer,
      value,
      option_candidates: optionCandidates,
      fill_order: match.spec.fillOrder,
      answer_kind: match.spec.answerKind,
    });
  }

  fill_targets.sort((left, right) => left.fill_order - right.fill_order);

  return {
    resolved_answers,
    mapping_decisions,
    fill_targets,
    missing_required,
    unsupported_required,
    pending_review,
    needs_user_answers: buildProfilePreflightIssues(missing_required),
    cached_alias_hits,
    cached_answer_hits,
  };
}

export function buildProfilePreflightIssues(
  missingRequired: AshbyBlocker[]
): AshbyProfilePreflightIssue[] {
  return missingRequired
    .filter((blocker) => HARD_TRUTH_REQUIRED_KEYS.has(blocker.key))
    .map((blocker) => ({
      canonicalKey: blocker.key,
      label: blocker.label,
      reason: blocker.detail,
      selector: blocker.selector,
    }));
}

export function profilePreflightBlockers(
  issues: AshbyProfilePreflightIssue[]
): AshbyBlocker[] {
  return issues.map((issue) => ({
    kind: "profile_preflight_missing" as const,
    key: issue.canonicalKey,
    label: issue.label,
    detail: `profile preflight requires user answer: ${issue.reason}`,
    selector: issue.selector,
  }));
}

export function evaluateSubmitReadiness(
  fillOperations: AshbyFillOperation[],
  missingRequired: AshbyBlocker[],
  unsupportedRequired: AshbyBlocker[],
  pendingReview: AshbyReviewItem[] = [],
  snapshot?: AshbyFormSnapshot | null
): { allowed: boolean; blockers: AshbyBlocker[] } {
  const failedOperations = fillOperations
    .filter((operation) => operation.blocking && operation.status !== "filled")
    .map((operation) => ({
      kind: "fill_verification_failed" as const,
      key: operation.key,
      label: null,
      detail: operation.detail ?? "fill verification failed",
      selector: operation.selector,
    }));

  const reviewBlockers = pendingReview.map((item) => ({
    kind: "missing_required_answer" as const,
    key: item.canonical_key_candidate ?? item.prompt_hash,
    label: item.question_text,
    detail: `pending review: ${item.reason}`,
    selector: item.selector,
  }));

  const gateBlockers: AshbyBlocker[] = snapshot?.unexpected_verification_gate
    ? [{
        kind: "unexpected_verification_gate",
        key: "verification_gate",
        label: null,
        detail: "unexpected verification gate detected",
        selector: null,
      }]
    : [];
  const submitControlBlockers: AshbyBlocker[] = snapshot && snapshot.submit_controls < 1
    ? [{
        kind: "submit_control_missing",
        key: "submit",
        label: null,
        detail: "submit control missing before submit",
        selector: null,
      }]
    : [];

  const blockers = [
    ...missingRequired,
    ...unsupportedRequired,
    ...failedOperations,
    ...reviewBlockers,
    ...gateBlockers,
    ...submitControlBlockers,
  ];

  return { allowed: blockers.length === 0, blockers };
}

function pushUniqueFillTarget(targets: AshbyFillTarget[], target: AshbyFillTarget): void {
  const existingIndex = targets.findIndex(
    (item) => item.canonical_key === target.canonical_key && item.answer_kind === target.answer_kind
  );
  if (existingIndex === -1 || target.answer_kind !== "file") {
    targets.push(target);
    return;
  }

  if (isBetterBlockerLabel(target.question.question_text, targets[existingIndex]?.question.question_text)) {
    targets[existingIndex] = target;
  }
}

function pushUniqueBlocker(blockers: AshbyBlocker[], blocker: AshbyBlocker): void {
  const existingIndex = blockers.findIndex(
    (item) => item.kind === blocker.kind && item.key === blocker.key && item.detail === blocker.detail
  );
  if (existingIndex === -1) {
    blockers.push(blocker);
    return;
  }

  if (isBetterBlockerLabel(blocker.label, blockers[existingIndex]?.label)) {
    blockers[existingIndex] = blocker;
  }
}

function pushUniqueReviewItem(items: AshbyReviewItem[], item: AshbyReviewItem): void {
  const existingIndex = items.findIndex(
    (candidate) =>
      candidate.canonical_key_candidate === item.canonical_key_candidate &&
      candidate.reason === item.reason
  );
  if (existingIndex === -1) {
    items.push(item);
    return;
  }

  if (isBetterBlockerLabel(item.question_text, items[existingIndex]?.question_text)) {
    items[existingIndex] = item;
  }
}

function isBetterBlockerLabel(candidate: string | null, current: string | null | undefined): boolean {
  if (!candidate) return false;
  if (!current) return true;
  const candidateNormalized = normalizeAshbyText(candidate);
  const currentNormalized = normalizeAshbyText(current);
  if (candidateNormalized === currentNormalized) return false;
  if (candidateNormalized === "resume") return true;
  return candidate.length < current.length && !candidateNormalized.includes("autofill from resume");
}

export function classifySubmissionSnapshot(snapshot: AshbyFormSnapshot): AshbySubmissionEvidence {
  const detailText = [
    ...snapshot.validation_errors,
    ...snapshot.confirmation_texts,
    snapshot.body_text_sample,
  ].join(" ");

  if (snapshot.unexpected_verification_gate) {
    return {
      outcome: "unsupported_gate",
      details: ["unexpected verification gate detected"],
      url: snapshot.url,
    };
  }

  if (containsAny(detailText, SPAM_PATTERNS)) {
    return {
      outcome: "rejected_spam",
      details: snapshot.validation_errors.length > 0 ? snapshot.validation_errors : ["provider rejected as spam"],
      url: snapshot.url,
    };
  }

  if (snapshot.confirmation_texts.length > 0 && snapshot.validation_errors.length === 0) {
    return {
      outcome: "confirmed",
      details: snapshot.confirmation_texts,
      url: snapshot.url,
    };
  }

  if (snapshot.validation_errors.length > 0) {
    return {
      outcome: "rejected_validation",
      details: snapshot.validation_errors,
      url: snapshot.url,
    };
  }

  return {
    outcome: "ambiguous",
    details: [
      snapshot.submit_controls > 0
        ? "submit controls still visible after submit"
        : "no explicit confirmation evidence found",
    ],
    url: snapshot.url,
  };
}

export function buildRunGrade(args: {
  snapshot: AshbyFormSnapshot;
  plan: AshbyResolutionPlan;
  fillOperations: AshbyFillOperation[];
  submitReady: boolean;
}): AshbyRunGrade {
  return {
    discovered_question_count: args.snapshot.questions.length,
    required_question_count: args.snapshot.questions.filter((question) => question.required).length,
    mapped_question_count: args.plan.mapping_decisions.filter((decision) => decision.canonical_key).length,
    deterministic_match_count: args.plan.mapping_decisions.filter((decision) =>
      decision.source === "library" || decision.source === "heuristic"
    ).length,
    cache_hit_count: args.plan.cached_alias_hits + args.plan.cached_answer_hits,
    llm_match_count: args.plan.mapping_decisions.filter((decision) => decision.source === "llm").length,
    auto_accepted_count: args.plan.mapping_decisions.filter((decision) => decision.auto_accepted).length,
    unresolved_blocking_count:
      args.plan.missing_required.length +
      args.plan.unsupported_required.length +
      args.plan.pending_review.length,
    verification_failure_count: args.fillOperations.filter((operation) => operation.blocking && !operation.verified).length,
    submit_ready: args.submitReady,
  };
}

export function blockedSubmissionEvidence(snapshot: AshbyFormSnapshot): AshbySubmissionEvidence {
  return {
    outcome: "blocked_before_submit",
    details: ["submit blocked by required blockers"],
    url: snapshot.url,
  };
}

export function outcomeFromSubmitAttempt(
  attempted: boolean,
  evidence: AshbySubmissionEvidence
): AshbyOutcomeClass {
  return attempted ? evidence.outcome : "blocked_before_submit";
}

export function declineDemographicOptions(): string[] {
  return [
    "I do not wish to answer",
    "Decline to identify",
    "Decline to self-identify",
    "Prefer not to answer",
    "Choose not to disclose",
    "No Answer",
    "Not specified",
  ];
}

function findAshbyQuestionMatch(
  question: AshbyQuestionNode,
  aliases: AshbyPromptAlias[],
  organizationSlug: string | null
) {
  const alias = aliases.find((entry) => {
    if (!entry.approved) return false;
    if (entry.promptHash !== question.prompt_hash) return false;
    if (entry.controlKind !== question.control_kind) return false;
    if (entry.optionSignature && entry.optionSignature !== question.option_signature) return false;
    if (entry.scopeKind === "global") return true;
    return normalizeAshbyText(entry.scopeValue) === normalizeAshbyText(organizationSlug);
  });

  if (alias) {
    const aliasSpec = CANONICAL_LIBRARY.find((entry) => entry.canonicalKey === alias.canonicalKey);
    if (aliasSpec) {
      return {
        spec: aliasSpec,
        confidence: alias.confidence,
        source: "cache" as const,
        rationale: `approved prompt alias: ${alias.source}`,
      };
    }
  }

  const haystack = normalizeAshbyText([
    question.question_text,
    question.normalized_prompt,
    ...question.options,
    ...question.helper_copy,
  ].join(" "));

  let best:
    | {
        spec: CanonicalSpec;
        confidence: "exact" | "strong" | "weak";
        source: "library" | "heuristic";
        rationale: string;
      }
    | null = null;

  for (const entry of CANONICAL_LIBRARY) {
    if (!isSpecControlCompatible(entry, question)) continue;
    const candidates = [...entry.labels, ...entry.prompts].map(normalizeAshbyText);
    const exact = candidates.some((candidate) => question.normalized_prompt === candidate);
    const strong = candidates.some((candidate) => haystack.includes(candidate) && candidate.length >= 5);
    const weak = candidates.some((candidate) => fuzzyPromptMatch(haystack, candidate));
    const confidence = exact ? "exact" : strong ? "strong" : weak ? "weak" : null;
    if (!confidence) continue;
    if (!best || confidenceRank(confidence) > confidenceRank(best.confidence)) {
      best = {
        spec: entry,
        confidence,
        source: "library",
        rationale: `matched canonical prompt for ${entry.canonicalKey}`,
      };
    }
  }

  if (best) return best;

  return {
    spec: null,
    confidence: "none" as const,
    source: "none" as const,
    rationale: null,
  };
}

function isSpecControlCompatible(entry: CanonicalSpec, question: AshbyQuestionNode): boolean {
  if (entry.answerKind === "file") return question.widget_family === "file_upload";
  if (entry.answerKind === "choice") return question.widget_family === "choice_group" || question.widget_family === "select_like";
  if (entry.answerKind === "text") return question.widget_family === "text_like" || question.widget_family === "select_like";
  return true;
}

function resolveAnswerForSpec(args: {
  spec: CanonicalSpec;
  question: AshbyQuestionNode;
  profileAnswers: Record<string, string | null>;
  approvedAnswers: AshbyApprovedAnswer[];
  organizationSlug: string | null;
}): AshbyResolvedAnswer {
  const cached = pickApprovedAnswer(args.approvedAnswers, args.spec.canonicalKey, args.question, args.organizationSlug);
  const profileValue = args.profileAnswers[args.spec.canonicalKey] ?? null;
  const value = cached?.answerValue ?? profileValue ?? args.spec.defaultValue ?? null;
  const source: AshbyResolvedAnswer["source"] = cached
    ? "approved_answer"
    : profileValue
      ? "profile"
      : args.spec.defaultValue
        ? "default"
        : "missing";

  return {
    canonical_key: args.spec.canonicalKey,
    source,
    source_detail: cached?.source ?? null,
    value,
    present: Boolean(value),
    blocking_if_missing: args.question.required || args.spec.requiredByDefault,
    field_label: args.question.question_text,
    selector: args.question.primary_selector,
    confidence: "strong" as const,
    scope_kind: cached?.scopeKind ?? null,
    scope_value: cached?.scopeValue ?? null,
    approved: source !== "missing",
  };
}

function pickApprovedAnswer(
  approvedAnswers: AshbyApprovedAnswer[],
  canonicalKey: string,
  question: AshbyQuestionNode,
  organizationSlug: string | null
): AshbyApprovedAnswer | null {
  const candidates = approvedAnswers.filter((entry) => {
    if (!entry.approved || entry.canonicalKey !== canonicalKey) return false;
    if (entry.promptHash && entry.promptHash !== question.prompt_hash) return false;
    if (entry.scopeKind === "global") return true;
    return normalizeAshbyText(entry.scopeValue) === normalizeAshbyText(organizationSlug);
  });

  return candidates.sort((left, right) => answerPriority(right, question) - answerPriority(left, question))[0] ?? null;
}

function answerPriority(answer: AshbyApprovedAnswer, question: AshbyQuestionNode): number {
  return (answer.scopeKind === "organization" ? 4 : 0) + (answer.promptHash === question.prompt_hash ? 2 : 0);
}

function pickDraftAnswer(draftAnswers: AshbyDraftAnswer[], question: AshbyQuestionNode): AshbyDraftAnswer | null {
  return draftAnswers.find((entry) => entry.promptHash === question.prompt_hash && entry.answerValue.trim()) ?? null;
}

function isDraftFillSupported(question: AshbyQuestionNode): boolean {
  return ["text", "email", "tel", "textarea", "radio", "checkbox", "select", "combobox"].includes(question.control_kind);
}

function isDraftAllowedForCanonicalFill(canonicalKey: string, draftAnswer: AshbyDraftAnswer): boolean {
  if (!draftAnswer.requiresReview) return true;
  return canonicalKey === "rust_skill_rating" && draftAnswer.answerValue.trim().length > 0;
}

function draftAnswerForFill(draftAnswer: AshbyDraftAnswer): AshbyDraftAnswer {
  if (!draftAnswer.requiresReview) return draftAnswer;
  return {
    ...draftAnswer,
    requiresReview: false,
    reviewStatus: "post_submit_review",
  };
}

function normalizeDraftFillValue(canonicalKey: string, value: string): string {
  if (canonicalKey !== "rust_skill_rating") return value;
  const rating = value.match(/\b(?:10|[0-9])\b/)?.[0];
  return rating ?? value;
}

function draftResolvedAnswer(
  question: AshbyQuestionNode,
  organizationSlug: string | null,
  canonicalKey: string,
  draftAnswer: AshbyDraftAnswer
): AshbyResolvedAnswer {
  return {
    canonical_key: canonicalKey,
    source: draftAnswer.requiresReview ? "review" : "llm_best_attempt",
    source_detail: draftAnswer.sourceDetail,
    value: draftAnswer.answerValue,
    present: true,
    blocking_if_missing: question.required,
    field_label: question.question_text,
    selector: question.primary_selector,
    confidence: draftAnswer.confidence,
    scope_kind: organizationSlug ? "organization" : "global",
    scope_value: organizationSlug ?? GLOBAL_SCOPE_VALUE,
    approved: false,
    review_status: draftAnswer.reviewStatus,
  };
}

function resolveChoiceValue(specification: CanonicalSpec, value: string, options: string[]): string | null {
  if (specification.canonicalKey === "preferred_working_location") {
    return resolvePreferredWorkingLocationChoice(value, options);
  }

  const normalizedValue = normalizeAshbyText(value);
  const exactOption = options.find((option) => normalizeAshbyText(option) === normalizedValue);
  if (exactOption) return exactOption;

  const mapped = specification.optionMappings?.[normalizedValue] ?? [];
  for (const candidate of mapped) {
    const option = options.find((item) => normalizeAshbyText(item) === normalizeAshbyText(candidate));
    if (option) return option;
  }

  for (const candidate of Object.values(specification.optionMappings ?? {}).flat()) {
    if (normalizeAshbyText(candidate) === normalizedValue) {
      const mappedGroup = Object.values(specification.optionMappings ?? {})
        .find((items) => items.some((item) => normalizeAshbyText(item) === normalizedValue)) ?? [];
      const option = mappedGroup
        .map((item) => options.find((optionCandidate) => normalizeAshbyText(optionCandidate) === normalizeAshbyText(item)))
        .find((item): item is string => Boolean(item));
      if (option) return option;
    }
  }

  return value;
}

function resolvePreferredWorkingLocationChoice(value: string, options: string[]): string | null {
  const normalizedValue = normalizeAshbyText(value);
  if (!normalizedValue) return null;
  if (options.length === 0) return value;

  const exactOption = options.find((option) => normalizeAshbyText(option) === normalizedValue);
  if (exactOption) return exactOption;

  const generic = new Set(["remote", "hybrid", "onsite", "on site", "in office"]);
  if (generic.has(normalizedValue)) return null;

  return options.find((option) => {
    const normalizedOption = normalizeAshbyText(option);
    return normalizedOption.includes(normalizedValue) || normalizedValue.includes(normalizedOption);
  }) ?? null;
}

function resolveOptionCandidates(specification: CanonicalSpec, value: string, options: string[]): string[] {
  const normalizedValue = normalizeAshbyText(value);
  const directMapped = specification.optionMappings?.[normalizedValue] ?? [];
  const mappedByAlias = Object.values(specification.optionMappings ?? {})
    .find((items) => items.some((item) => normalizeAshbyText(item) === normalizedValue)) ?? [];
  const mapped = uniqueOriginalStrings([...directMapped, ...mappedByAlias]);
  const exactOption = options.find((option) => normalizeAshbyText(option) === normalizedValue);
  return uniqueOriginalStrings([value, exactOption, ...mapped]);
}

function reviewItem(
  question: AshbyQuestionNode,
  organizationSlug: string | null,
  canonicalKeyCandidate: string | null,
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
    question_class: canonicalKeyCandidate ? "custom_bespoke" : "custom_bespoke",
    answerability_class: canonicalKeyCandidate ? "organization_scoped" : "custom_bespoke",
    options: question.options,
    helper_copy: question.helper_copy,
    section_path: question.section_path,
    canonical_key_candidate: canonicalKeyCandidate,
    answer_candidate: answerCandidate,
    confidence: canonicalKeyCandidate ? "weak" : "none",
    source: "matcher",
    reason,
    selector: question.primary_selector,
    scope_kind: organizationSlug ? "organization" : "global",
    scope_value: organizationSlug,
  };
}

function widgetFamilyForControl(controlKind: AshbyControlKind): AshbyWidgetFamily {
  switch (controlKind) {
    case "text":
    case "email":
    case "tel":
    case "textarea":
      return "text_like";
    case "radio":
    case "checkbox":
      return "choice_group";
    case "select":
    case "combobox":
      return "select_like";
    case "file":
      return "file_upload";
    default:
      return "unsupported";
  }
}

function uniqueNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeAshbyText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
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

function dedupeSourceControls(
  controls: AshbyQuestionNode["source_controls"]
): AshbyQuestionNode["source_controls"] {
  const seen = new Set<string>();
  const result: AshbyQuestionNode["source_controls"] = [];
  for (const control of controls) {
    const key = [
      control.selector ?? "",
      control.control_kind,
      normalizeAshbyText(control.label),
      control.name ?? "",
      control.id ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(control);
  }
  return result;
}

function mergeValidationState(
  left: AshbyValidationState,
  right: AshbyValidationState
): AshbyValidationState {
  if (left === "invalid" || right === "invalid") return "invalid";
  if (left === "valid" || right === "valid") return "valid";
  return "unknown";
}

function betterRepresentativeField(
  current: AshbyFieldObservation,
  candidate: AshbyFieldObservation
): AshbyFieldObservation {
  const score = (field: AshbyFieldObservation) =>
    (field.required ? 8 : 0) +
    (field.selector_hint ? 4 : 0) +
    (field.question_text ? 2 : 0) +
    (field.label ? 1 : 0);
  return score(candidate) > score(current) ? candidate : current;
}

function fuzzyPromptMatch(haystack: string, candidate: string): boolean {
  const tokens = candidate.split(/\W+/).filter((token) => token.length > 4);
  if (tokens.length === 0) return false;
  return tokens.filter((token) => haystack.includes(token)).length >= Math.min(2, tokens.length);
}

function confidenceRank(value: "exact" | "strong" | "weak") {
  if (value === "exact") return 3;
  if (value === "strong") return 2;
  return 1;
}

function containsAny(text: string, patterns: string[]): boolean {
  const normalized = normalizeAshbyText(text);
  return patterns.some((pattern) => normalized.includes(pattern));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getPath(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringValue).filter((item): item is string => Boolean(item)) : [];
}

function primaryTechStack(root: Record<string, unknown>): string | null {
  const skills = [
    ...stringArrayValue(root.skills),
    ...stringArrayValue(getPath(root, ["profile", "skills"])),
    ...stringArrayValue(getPath(root, ["application", "primaryTechStack"])),
  ];
  return uniqueOriginalStrings(skills).slice(0, 10).join(", ") || null;
}

function mainDevelopmentLanguage(root: Record<string, unknown>): string | null {
  const explicit =
    stringValue(getPath(root, ["application", "mainDevelopmentLanguage"])) ??
    stringValue(getPath(root, ["application", "primaryDevelopmentLanguage"]));
  if (explicit) return explicit;

  const skills = uniqueOriginalStrings([
    ...stringArrayValue(root.skills),
    ...stringArrayValue(getPath(root, ["profile", "skills"])),
    ...stringArrayValue(getPath(root, ["application", "primaryTechStack"])),
  ]).map(normalizeAshbyText);
  const has = (patterns: string[]) => skills.some((skill) => patterns.some((pattern) => skill.includes(pattern)));

  if (has(["typescript", "javascript", "node", "react", "next.js", "nextjs"])) return "TypeScript";
  if (has(["python", "django", "fastapi"])) return "Python";
  if (has(["c++", "cpp"])) return "C++";
  if (has(["java", "spring"])) return "Java";
  return null;
}

function preferredWorkingLocation(root: Record<string, unknown>): string | null {
  const application = asRecord(root.application) ?? {};
  const prefs = asRecord(root.prefs) ?? asRecord(root.preferences) ?? {};
  const candidates = [
    stringValue(application.workLocationPreference),
    stringValue(application.locationPreference),
    stringValue(root.location),
    stringValue(getPath(root, ["contact", "city"])),
    stringValue(application.city),
    stringValue(prefs.workLocation),
    stringValue(prefs.location),
    ...stringArrayValue(prefs.locations),
    ...stringArrayValue(getPath(root, ["preferences", "locations"])),
  ].filter((item): item is string => Boolean(item));
  const normalized = candidates.map(normalizeAshbyText).join(" ");

  if ((normalized.includes("canada") || normalized.includes("vancouver") || normalized.includes("toronto") || normalized.includes("montreal")) && normalized.includes("remote")) {
    return "Canada [Remote]";
  }
  if ((normalized.includes("united states") || normalized.includes("usa") || normalized.includes("san francisco") || normalized.includes("new york") || normalized.includes("seattle")) && normalized.includes("remote")) {
    return "United States [Remote]";
  }
  if (normalized.includes("uk") && normalized.includes("remote")) return "UK [Remote]";
  if (normalized.includes("london") && normalized.includes("hybrid")) return "London [Hybrid]";
  if (normalized.includes("remote")) return "Remote";
  if (normalized.includes("hybrid")) return "Hybrid";
  if (normalized.includes("london")) return "London [Hybrid]";
  return null;
}

function absolutePathValue(value: unknown): string | null {
  const path = stringValue(value);
  return path && path.startsWith("/") ? path : null;
}

function joinName(first: string | null, last: string | null): string | null {
  return [first, last].filter(Boolean).join(" ") || null;
}

function splitName(fullName: string | null): { first: string | null; last: string | null } {
  if (!fullName) return { first: null, last: null };
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    first: parts[0] ?? null,
    last: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function yesNoValue(value: unknown): string | null {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = stringValue(value);
  if (!text) return null;
  const normalized = normalizeAshbyText(text);
  if (["yes", "y", "true", "authorized"].includes(normalized)) return "Yes";
  if (["no", "n", "false", "not authorized"].includes(normalized)) return "No";
  return text;
}

function yesNoFromText(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeAshbyText(value);
  if (normalized.includes("authorized") || normalized.includes("citizen")) return "Yes";
  if (normalized.includes("sponsor") || normalized.includes("not authorized")) return "No";
  return null;
}

export { GLOBAL_SCOPE_VALUE };
