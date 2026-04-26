export const FRIENDLY_ERROR_MESSAGES: Record<string, { title: string; body: string; action: string }> = {
  failed_unsupported_widget: {
    title: "Auto-fill not supported",
    body: "We don't auto-fill this provider yet. We've prepared a guided manual mode with all your answers ready to paste.",
    action: "Open guided mode",
  },
  failed_user_input_required: {
    title: "Manual input needed",
    body: "Some fields require info we don't have. Review and complete them.",
    action: "Review fields",
  },
  failed_auth_required: {
    title: "Sign-in required",
    body: "This application needs you to sign in first. We'll open the page for you.",
    action: "Open page",
  },
  failed_captcha_or_bot_challenge: {
    title: "Captcha challenge",
    body: "The site asked for a human check. We'll resume after you solve it.",
    action: "Solve captcha",
  },
  failed_browser_crash: {
    title: "Browser issue",
    body: "Our browser session crashed. Retry usually resolves this.",
    action: "Retry",
  },
  failed_network: {
    title: "Network issue",
    body: "We couldn't reach the application page. Check the URL and retry.",
    action: "Retry",
  },
  failed_repairable: {
    title: "Fixable error",
    body: "We hit a temporary issue. Retrying with adjustments.",
    action: "Retry",
  },
};

export function friendlyError(category: string): { title: string; body: string; action: string } {
  return (
    FRIENDLY_ERROR_MESSAGES[category] ?? {
      title: "Something went wrong",
      body: "We couldn't complete this application. Try again or use guided manual mode.",
      action: "Try again",
    }
  );
}
