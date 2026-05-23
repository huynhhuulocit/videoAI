type AiHandoffStatus =
  | "created"
  | "sent_to_extension"
  | "target_opened"
  | "prompt_filled"
  | "generate_clicked"
  | "failed"
  | "completed_manually";

type AiHandoffPayload = {
  handoffId: string;
  provider: string;
  targetUrl: string;
  promptText: string;
  promptSelector: string;
  shotId: string;
};

type AiHandoffResponse =
  | {
      ok: true;
      handoffId: string;
      status: AiHandoffStatus;
      message?: string;
    }
  | {
      ok: false;
      handoffId?: string;
      status?: AiHandoffStatus;
      errorMessage: string;
      debug?: Record<string, unknown>;
    };

type RuntimeMessage =
  | {
      type: "VIDEOAI_AI_HANDOFF_RUN";
      payload: AiHandoffPayload;
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_CONTENT_PING";
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_BEGIN_CAPTURE";
      payload: { provider: string };
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_TEST_FILL";
      payload: { provider: string; promptSelector: string; testText: string };
    };

type AdapterConfig = {
  provider: string;
  allowedOrigins: string[];
  generateButtonSelector: string;
  loginRequiredSelector: string;
};

type DomSelectorReport = {
  provider: string;
  url: string;
  origin: string;
  promptSelector: string;
  classPath: string;
  tagClassPath: string;
  tagName: string;
  id: string;
  role: string;
  ariaLabel: string;
  placeholder: string;
  isContentEditable: boolean;
  capturedAt: string;
  clipboardStatus?: "copied" | "failed" | "unsupported";
  clipboardError?: string;
};

(() => {
const adapters: Record<string, AdapterConfig> = {
  "google-flow-veo": {
    provider: "google-flow-veo",
    allowedOrigins: [
      "https://labs.google",
      "https://flow.google",
      "https://aitestkitchen.withgoogle.com",
    ],
    generateButtonSelector: "button[aria-label='Generate']",
    loginRequiredSelector: "a[href*='accounts.google.com']",
  },
};

const captureOverlayId = "videoai-ai-handoff-capture-overlay";
const resultToastId = "videoai-ai-handoff-result-toast";

function getAdapter(provider: string) {
  return adapters[provider];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return isRecord(value) && typeof value.type === "string";
}

function fail(
  payload: AiHandoffPayload | undefined,
  errorMessage: string,
  debug?: Record<string, unknown>,
): AiHandoffResponse {
  return {
    ok: false,
    ...(payload ? { handoffId: payload.handoffId } : {}),
    status: "failed",
    errorMessage,
    ...(debug ? { debug } : {}),
  };
}

function assertAllowedOrigin(provider: string) {
  const adapter = getAdapter(provider);
  if (!adapter) {
    throw new Error(`Provider adapter is not configured: ${provider}`);
  }
  if (!adapter.allowedOrigins.includes(window.location.origin)) {
    throw new Error(
      `This page is not allowlisted for ${provider}: ${window.location.origin}`,
    );
  }
  return adapter;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  console.log("[VideoAI AI Handoff][content] setNativeValue", {
    tagName: element.tagName.toLowerCase(),
    type: element instanceof HTMLInputElement ? element.type : "textarea",
    valueLength: value.length,
  });
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement | HTMLTextAreaElement;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (!descriptor?.set) {
    throw new Error("Target input does not expose a writable value setter.");
  }
  descriptor.set.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function resolvePromptEditable(element: Element) {
  if (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLInputElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  ) {
    return element;
  }

  const editableParent = element.closest(
    'textarea,input,[contenteditable="true"]',
  );
  if (
    editableParent instanceof HTMLTextAreaElement ||
    editableParent instanceof HTMLInputElement ||
    (editableParent instanceof HTMLElement && editableParent.isContentEditable)
  ) {
    return editableParent;
  }

  return null;
}

function setContentEditableValue(element: HTMLElement, value: string) {
  console.log("[VideoAI AI Handoff][content] setContentEditableValue", {
    tagName: element.tagName.toLowerCase(),
    role: element.getAttribute("role") || "",
    isSlateEditor: element.getAttribute("data-slate-editor") === "true",
    valueLength: value.length,
    code:
      'document.querySelector(promptSelector)?.focus(); document.execCommand("insertText", false, value);',
  });
  element.focus();

  const selection = window.getSelection();
  if (!selection) {
    throw new Error("Cannot access the page selection for the prompt editor.");
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);

  const inserted = document.execCommand("insertText", false, value);
  console.log("[VideoAI AI Handoff][content] execCommand insertText result", {
    inserted,
    currentText: element.textContent || "",
  });
  if (!inserted) {
    throw new Error(
      "The target prompt editor rejected text insertion. Run Check DOM again and select the visible prompt input.",
    );
  }

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value,
    }),
  );
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setPromptValue(element: Element, value: string) {
  console.log("[VideoAI AI Handoff][content] setPromptValue input", {
    selectorMatchedTag: element.tagName.toLowerCase(),
    selectorMatchedRole: element.getAttribute("role") || "",
    selectorMatchedContentEditable:
      element instanceof HTMLElement ? element.isContentEditable : false,
    selectorMatchedSlateString:
      element.getAttribute("data-slate-string") === "true",
    valueLength: value.length,
  });
  const promptEditable = resolvePromptEditable(element);
  if (!promptEditable) {
    throw new Error(
      "Configured prompt selector did not resolve to an editable input.",
    );
  }

  console.log("[VideoAI AI Handoff][content] resolved editable element", {
    tagName: promptEditable.tagName.toLowerCase(),
    role: promptEditable.getAttribute("role") || "",
    isContentEditable:
      promptEditable instanceof HTMLElement ? promptEditable.isContentEditable : false,
    isSlateEditor: promptEditable.getAttribute("data-slate-editor") === "true",
  });

  if (
    promptEditable instanceof HTMLTextAreaElement ||
    promptEditable instanceof HTMLInputElement
  ) {
    promptEditable.focus();
    setNativeValue(promptEditable, value);
    return;
  }

  if (promptEditable instanceof HTMLElement && promptEditable.isContentEditable) {
    setContentEditableValue(promptEditable, value);
    return;
  }

  throw new Error(
    "Configured prompt selector did not resolve to an editable input.",
  );
}

function isEditableElement(element: Element) {
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLInputElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

function isGenerateDisabled(button: Element) {
  if (button instanceof HTMLButtonElement) {
    return button.disabled || button.getAttribute("aria-disabled") === "true";
  }
  return button.getAttribute("aria-disabled") === "true";
}

function waitForElement(selector: string, timeoutMs: number) {
  return new Promise<Element | null>((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) {
        return;
      }
      globalThis.clearTimeout(timeout);
      observer.disconnect();
      resolve(element);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
}

function cssEscape(value: string) {
  return CSS.escape(value);
}

function uniqueSelector(selector: string) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function simpleSelector(element: Element) {
  const tag = element.tagName.toLowerCase();
  if (element.id) {
    return `${tag}#${cssEscape(element.id)}`;
  }

  for (const attr of [
    "data-testid",
    "data-test",
    "data-qa",
    "aria-label",
    "placeholder",
    "name",
    "role",
    "type",
  ]) {
    const value = element.getAttribute(attr);
    if (!value) {
      continue;
    }
    const selector = `${tag}[${attr}="${cssEscape(value)}"]`;
    if (uniqueSelector(selector)) {
      return selector;
    }
  }

  const classes = Array.from(element.classList).filter(Boolean).slice(0, 4);
  if (classes.length) {
    return `${tag}.${classes.map(cssEscape).join(".")}`;
  }
  return tag;
}

function selectorPath(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    const simple = simpleSelector(current);
    parts.unshift(simple);
    const selector = parts.join(" > ");
    if (uniqueSelector(selector)) {
      return selector;
    }
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function classPath(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    const classes = Array.from(current.classList).filter(Boolean).slice(0, 4);
    if (classes.length) {
      parts.unshift(`.${classes.map(cssEscape).join(".")}`);
    }
    current = current.parentElement;
  }
  return parts.join(" ");
}

function tagClassPath(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const classes = Array.from(current.classList).filter(Boolean).slice(0, 3);
    parts.unshift(classes.length ? `${tag}.${classes.map(cssEscape).join(".")}` : tag);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function buildSelectorReport(provider: string, element: Element): DomSelectorReport {
  return {
    provider,
    url: window.location.href,
    origin: window.location.origin,
    promptSelector: selectorPath(element),
    classPath: classPath(element),
    tagClassPath: tagClassPath(element),
    tagName: element.tagName.toLowerCase(),
    id: element.id || "",
    role: element.getAttribute("role") || "",
    ariaLabel: element.getAttribute("aria-label") || "",
    placeholder: element.getAttribute("placeholder") || "",
    isContentEditable:
      element instanceof HTMLElement ? element.isContentEditable : false,
    capturedAt: new Date().toISOString(),
  };
}

async function copySelectorToClipboard(selector: string) {
  if (!navigator.clipboard?.writeText) {
    return {
      clipboardStatus: "unsupported" as const,
      clipboardError: "Clipboard API is not available on this page.",
    };
  }

  try {
    await navigator.clipboard.writeText(selector);
    return { clipboardStatus: "copied" as const, clipboardError: "" };
  } catch (error) {
    return {
      clipboardStatus: "failed" as const,
      clipboardError:
        error instanceof Error ? error.message : "Browser blocked clipboard write.",
    };
  }
}

function removeElement(id: string) {
  document.getElementById(id)?.remove();
}

function showPageMessage(message: string, tone: "info" | "success" | "error") {
  removeElement(resultToastId);
  const toast = document.createElement("div");
  toast.id = resultToastId;
  toast.textContent = message;
  toast.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "right:20px",
    "bottom:20px",
    "max-width:420px",
    "border-radius:10px",
    "padding:12px 14px",
    "font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 16px 40px rgba(15,23,42,.22)",
    tone === "error"
      ? "background:#fee2e2;color:#991b1b;border:1px solid #fecaca"
      : tone === "success"
        ? "background:#dcfce7;color:#166534;border:1px solid #bbf7d0"
        : "background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe",
  ].join(";");
  document.documentElement.appendChild(toast);
  globalThis.setTimeout(() => toast.remove(), 5000);
}

function showCaptureOverlay() {
  removeElement(captureOverlayId);
  const overlay = document.createElement("div");
  overlay.id = captureOverlayId;
  overlay.textContent = "VideoAI: click the Flow prompt input to capture DOM selector.";
  overlay.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "left:50%",
    "top:20px",
    "transform:translateX(-50%)",
    "border-radius:999px",
    "padding:10px 16px",
    "background:#0f172a",
    "color:white",
    "font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 18px 50px rgba(15,23,42,.35)",
    "pointer-events:none",
  ].join(";");
  document.documentElement.appendChild(overlay);
}

function sendSelectorReport(provider: string, report: DomSelectorReport) {
  chrome.runtime.sendMessage(
    {
      type: "VIDEOAI_AI_HANDOFF_SELECTOR_CAPTURED",
      payload: { provider, report },
    },
    (response) => {
      if (chrome.runtime.lastError) {
        showPageMessage(
          chrome.runtime.lastError.message ||
            "Selector captured, but the extension could not save it.",
          "error",
        );
        return;
      }
      if (isRecord(response) && response.ok === true) {
        showPageMessage(
          report.clipboardStatus === "copied"
            ? "VideoAI selector saved to Admin config and copied to clipboard."
            : "VideoAI selector saved to Admin config. Copy from the extension popup if needed.",
          "success",
        );
        return;
      }
      const errorMessage =
        isRecord(response) && typeof response.errorMessage === "string"
          ? response.errorMessage
          : "Selector captured, but Admin config save failed.";
      showPageMessage(errorMessage, "error");
    },
  );
}

function beginCapture(provider: string) {
  assertAllowedOrigin(provider);
  showCaptureOverlay();

  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    removeElement(captureOverlayId);
    document.removeEventListener("click", onClick, true);

    void (async () => {
      const target = event.target;
      if (!(target instanceof Element)) {
        showPageMessage("The clicked target is not a DOM element.", "error");
        return;
      }
      if (!isEditableElement(target)) {
        showPageMessage("Clicked element is not an editable prompt input.", "error");
        return;
      }

      const report = buildSelectorReport(provider, target);
      const clipboardResult = await copySelectorToClipboard(report.promptSelector);
      sendSelectorReport(provider, { ...report, ...clipboardResult });
    })();
  };

  document.addEventListener("click", onClick, true);
  showPageMessage("Capture mode is ready. Click the Flow prompt input.", "info");
}

async function testFill(provider: string, promptSelector: string, testText: string) {
  console.log("[VideoAI AI Handoff][content] Test input prompt received", {
    provider,
    promptSelector,
    testText,
    url: window.location.href,
  });
  assertAllowedOrigin(provider);
  const promptInput = await waitForElement(promptSelector, 10000);
  if (!promptInput) {
    console.error("[VideoAI AI Handoff][content] Prompt selector not found", {
      promptSelector,
    });
    throw new Error(
      "Prompt selector was not found on this page. Run Check DOM again.",
    );
  }
  console.log("[VideoAI AI Handoff][content] Prompt selector matched", {
    tagName: promptInput.tagName.toLowerCase(),
    role: promptInput.getAttribute("role") || "",
    isContentEditable:
      promptInput instanceof HTMLElement ? promptInput.isContentEditable : false,
    text: promptInput.textContent || "",
    outerHTML: promptInput.outerHTML.slice(0, 600),
  });
  setPromptValue(promptInput, testText);
  console.log("[VideoAI AI Handoff][content] Test input prompt completed", {
    promptSelector,
    testText,
  });
  showPageMessage("VideoAI test prompt filled successfully.", "success");
}

async function runHandoff(
  payload: AiHandoffPayload,
): Promise<AiHandoffResponse> {
  const adapter = getAdapter(payload.provider);
  if (!adapter) {
    return fail(
      payload,
      `Provider adapter is not configured: ${payload.provider}`,
    );
  }

  if (!adapter.allowedOrigins.includes(window.location.origin)) {
    return fail(payload, "Target origin is not allowlisted for this adapter.", {
      origin: window.location.origin,
      allowedOrigins: adapter.allowedOrigins,
    });
  }

  const promptSelector = payload.promptSelector.trim();
  if (!promptSelector) {
    return fail(
      payload,
      "AI Handoff prompt selector is not configured. Open Flow, run Check DOM, then try again.",
    );
  }

  const loginLink = await waitForElement(adapter.loginRequiredSelector, 2000);
  if (loginLink) {
    return fail(
      payload,
      "Target page appears to require login. Log in manually, then try AI Handoff again.",
      {
        loginRequiredSelector: adapter.loginRequiredSelector,
      },
    );
  }

  const promptInput = await waitForElement(promptSelector, 20000);
  if (!promptInput) {
    return fail(
      payload,
      "Target page layout changed or is still loading: prompt input selector was not found within 20 seconds.",
      {
        promptSelector,
      },
    );
  }

  try {
    setPromptValue(promptInput, payload.promptText);
  } catch (error) {
    return fail(
      payload,
      error instanceof Error ? error.message : "Cannot fill prompt input.",
      {
        promptSelector,
      },
    );
  }

  const generateButton = await waitForElement(
    adapter.generateButtonSelector,
    20000,
  );
  if (!generateButton) {
    return fail(
      payload,
      "Target page layout changed or is still loading: generate button selector was not found within 20 seconds.",
      {
        generateButtonSelector: adapter.generateButtonSelector,
      },
    );
  }

  if (isGenerateDisabled(generateButton)) {
    return fail(payload, "Generate button is disabled on the target page.", {
      generateButtonSelector: adapter.generateButtonSelector,
    });
  }

  if (!(generateButton instanceof HTMLElement)) {
    return fail(
      payload,
      "Configured generate selector did not resolve to a clickable element.",
      {
        generateButtonSelector: adapter.generateButtonSelector,
      },
    );
  }

  generateButton.click();
  showPageMessage("Prompt filled and Generate clicked.", "success");
  return {
    ok: true,
    handoffId: payload.handoffId,
    status: "generate_clicked",
    message: "Prompt filled and Generate clicked.",
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) {
    return false;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_CONTENT_PING") {
    sendResponse({
      ok: true,
      status: "ready",
      message: "AI Handoff content script is ready.",
    });
    return false;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_RUN") {
    void runHandoff(message.payload).then(sendResponse);
    return true;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_BEGIN_CAPTURE") {
    try {
      beginCapture(message.payload.provider);
      sendResponse({ ok: true, status: "capture_started" });
    } catch (error) {
      sendResponse({
        ok: false,
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Cannot start DOM capture.",
      });
    }
    return false;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_TEST_FILL") {
    void testFill(
      message.payload.provider,
      message.payload.promptSelector,
      message.payload.testText,
    )
      .then(() =>
        sendResponse({
          ok: true,
          status: "prompt_filled",
          message: "Test prompt filled successfully.",
        }),
      )
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          status: "failed",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Cannot fill test prompt.",
        }),
      );
    return true;
  }

  return false;
});
})();
