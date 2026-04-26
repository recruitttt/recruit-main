# Browserbase hCaptcha Findings

Date: 2026-04-26

## Summary

Lever form filling reaches submit readiness with Owen's normalized profile, but live Lever submission is currently blocked by Browserbase hCaptcha solving not completing.

This is not a field-fill or profile issue:

- Required fields fill and verify.
- The visible Lever submit button is clicked.
- No POST to Lever's `/apply` endpoint occurs after the click.
- Browserbase emits `browserbase-solving-started`.
- Browserbase never emits `browserbase-solving-finished`.
- Lever's hidden `#hcaptchaResponseInput` stays empty.

## Evidence

### Lever Live Attempts

- Mistral index 1: submit attempted, outcome `ambiguous`; hCaptcha still present, submit button still visible.
- Mistral index 2: submit attempted, outcome `ambiguous`; hCaptcha still present, submit button still visible.
- Mistral index 7: submit attempted, outcome `ambiguous`; hCaptcha still present, submit button still visible.
- Mistral index 8: submit attempted, outcome `ambiguous`; token wait timed out.
- Mistral index 9: submit attempted with explicit Browserbase CAPTCHA selectors, outcome `ambiguous`; token wait timed out.

### Browserbase Solver Behavior

Observed Browserbase session logs include repeated calls to:

- `http://127.0.0.1:8080/solve/hcaptcha/create`
- `http://127.0.0.1:8080/solve/hcaptcha/query`

CDP response inspection showed Browserbase creates a solver task and keeps polling it, but responses did not include a solution token during the test window.

### Public CAPTCHA Sanity Checks

- `https://accounts.hcaptcha.com/demo`: Browserbase emitted `browserbase-solving-started`, did not emit `browserbase-solving-finished`, and `h-captcha-response` stayed empty.
- `https://www.google.com/recaptcha/api2/demo`: Browserbase emitted both `browserbase-solving-started` and `browserbase-solving-finished`, and wrote a non-empty `g-recaptcha-response` token.

This indicates Browserbase session setup works generally, but hCaptcha solving is not completing for this Browserbase project/session configuration.

## Lever hCaptcha Wiring

Lever uses invisible hCaptcha:

- Visible application button: `#btn-submit`
- Hidden real submit button: `#hcaptchaSubmitBtn`
- hCaptcha container: `#h-captcha`
- Hidden response input: `#hcaptchaResponseInput`

Lever's inline script calls `hcaptcha.execute(captchaId)` on visible submit. On success, it writes `#hcaptchaResponseInput` and clicks `#hcaptchaSubmitBtn`.

## Code Changes From This Finding

- Removed human CAPTCHA handoff as a normal path.
- Detect CAPTCHA kind before submit.
- Allow submit only when the configured Browserbase capability policy marks that CAPTCHA kind as supported.
- Treat unsupported CAPTCHA kinds as `unsupported_gate` before clicking submit.
- Keep post-click token waiting/retry only for CAPTCHA kinds that are explicitly supported.
- If a supported Browserbase CAPTCHA flow starts but no token appears, classify as `unsupported_gate` with `browserbase_hcaptcha_timeout`.
- Added `npm run lever:captcha-probe` to measure Browserbase CAPTCHA capability without submitting a real application.
- Current default supported CAPTCHA kinds are `recaptcha` and `turnstile`; override with `BROWSERBASE_SUPPORTED_CAPTCHA_KINDS` only after a probe proves another type works for the configured Browserbase project.

Example:

```bash
npm run lever:captcha-probe -- \
  --wait-ms 70000 \
  --lever-url https://jobs.lever.co/mistral/52808932-3aaa-419f-a08d-1fb2a0aed781/apply
```

## Next Step

Escalate to Browserbase with failing session IDs and the hCaptcha demo comparison. Until the probe shows hCaptcha tokens are actually written, Lever hCaptcha is classified as not doable for automatic submit.
