import { getAdapter } from "./adapters.js";
import type {
  AiHandoffPayload,
  AiHandoffResponse,
  ChromeMessageSender,
  ChromeTab,
  DomSelectorReport,
  RuntimeMessage,
} from "./types.js";

type StoredAiConfig = {
  aiHandoffProvider?: string;
  aiHandoffTargetUrl?: string | null;
  aiHandoffPromptSelector?: string | null;
};

type ApiSuccess<T> = {
  data: T;
};

const testPromptText = "test input prompt";
const simpleInsertSelector =
  'div[role="textbox"][contenteditable="true"][data-slate-editor="true"] [data-slate-string="true"]';
const simpleInsertText = "Create beautiful house";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPayload(value: unknown): value is AiHandoffPayload {
  return (
    isRecord(value) &&
    typeof value.handoffId === "string" &&
    typeof value.provider === "string" &&
    typeof value.targetUrl === "string" &&
    typeof value.promptText === "string" &&
    typeof value.promptSelector === "string" &&
    typeof value.shotId === "string"
  );
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return isRecord(value) && typeof value.type === "string";
}

function fail(
  payload: AiHandoffPayload | undefined,
  errorMessage: string,
): AiHandoffResponse {
  return {
    ok: false,
    ...(payload ? { handoffId: payload.handoffId } : {}),
    status: "failed",
    errorMessage,
  };
}

function responseError(error: unknown, fallback: string) {
  return {
    ok: false,
    status: "failed",
    errorMessage: error instanceof Error ? error.message : fallback,
  };
}

function storageGet(keys: string[]) {
  return new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function rememberLastHandoff(
  response: AiHandoffResponse,
  payload?: AiHandoffPayload,
) {
  void chrome.storage.local.set({
    lastHandoff: {
      ...response,
      provider: payload?.provider,
      shotId: payload?.shotId,
      updatedAt: new Date().toISOString(),
    },
  });
}

function rememberLastDomCheck(
  result:
    | {
        ok: true;
        provider: string;
        promptSelector: string;
        message: string;
        report?: DomSelectorReport;
      }
    | {
        ok: false;
        provider?: string;
        promptSelector?: string;
        errorMessage: string;
        report?: DomSelectorReport;
      },
) {
  void chrome.storage.local.set({
    lastDomCheck: {
      ...result,
      updatedAt: new Date().toISOString(),
    },
  });
}

function senderOrigin(sender: ChromeMessageSender) {
  const rawUrl = sender.url || sender.origin || "";
  if (!rawUrl) {
    return "";
  }
  try {
    return new URL(rawUrl).origin;
  } catch {
    return "";
  }
}

function rememberVideoAiOrigin(sender: ChromeMessageSender) {
  const origin = senderOrigin(sender);
  if (!origin) {
    return;
  }
  void chrome.storage.local.set({ videoAiOrigin: origin });
}

async function getVideoAiOrigin() {
  const stored = await storageGet(["videoAiOrigin"]);
  const origin = typeof stored.videoAiOrigin === "string" ? stored.videoAiOrigin : "";
  if (!origin) {
    throw new Error(
      "Open VideoAI and click Check installed or run AI Handoff once so the extension knows where to save Admin config.",
    );
  }
  return origin;
}

async function fetchActiveAiConfig() {
  const origin = await getVideoAiOrigin();
  const response = await fetch(`${origin}/api/v1/admin/ai-config`, {
    credentials: "include",
    headers: { "x-request-id": `extension-${Date.now()}` },
  });
  if (!response.ok) {
    throw new Error(
      `Cannot read VideoAI Admin config. HTTP status: ${response.status}`,
    );
  }
  const payload = (await response.json()) as ApiSuccess<StoredAiConfig>;
  return payload.data;
}

async function savePromptSelectorToAdmin(
  provider: string,
  promptSelector: string,
) {
  const origin = await getVideoAiOrigin();
  const response = await fetch(`${origin}/api/v1/admin/ai-config/ai-handoff-dom`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-request-id": `extension-${Date.now()}`,
    },
    body: JSON.stringify({ provider, promptSelector }),
  });
  if (!response.ok) {
    throw new Error(
      `Cannot save selector to VideoAI Admin config. HTTP status: ${response.status}`,
    );
  }
  await response.json();
}

function validateTarget(payload: AiHandoffPayload) {
  const adapter = getAdapter(payload.provider);
  if (!adapter) {
    return `Provider adapter is not configured: ${payload.provider}`;
  }

  let targetOrigin = "";
  try {
    targetOrigin = new URL(payload.targetUrl).origin;
  } catch {
    return "Target URL is invalid.";
  }

  if (!adapter.allowedOrigins.includes(targetOrigin)) {
    return `Target origin is not allowlisted for ${payload.provider}: ${targetOrigin}`;
  }

  if (!payload.promptSelector.trim()) {
    return "AI Handoff prompt selector is not configured. Open Flow, run Check DOM, then try again.";
  }

  return "";
}

function validateTabTarget(tab: ChromeTab, provider: string) {
  const adapter = getAdapter(provider);
  if (!adapter) {
    throw new Error(`Provider adapter is not configured: ${provider}`);
  }
  if (!tab.url) {
    throw new Error("Active tab has no URL.");
  }
  let origin = "";
  try {
    origin = new URL(tab.url).origin;
  } catch {
    throw new Error("Active tab URL is invalid.");
  }
  if (!adapter.allowedOrigins.includes(origin)) {
    throw new Error(`Open an allowlisted ${provider} target tab first.`);
  }
}

function waitForTabComplete(tabId: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(
        new Error("Target page did not finish loading within 30 seconds."),
      );
    }, 30000);

    const listener = (updatedTabId: number, changeInfo: ChromeTab) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }
      globalThis.clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function injectContentScript(tabId: number) {
  return new Promise<void>((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content.js"],
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError.message ||
                "Cannot inject AI Handoff content script into the target page.",
            ),
          );
          return;
        }
        resolve();
      },
    );
  });
}

function runSimpleInsertScript(tabId: number) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    chrome.scripting.executeScript<[string, string], Record<string, unknown>>(
      {
        target: { tabId },
        args: [simpleInsertSelector, simpleInsertText],
        func: (selector: string, text: string) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) {
            throw new Error(`Prompt input selector was not found: ${selector}`);
          }

          if (!element.isContentEditable) {
            throw new Error(`Prompt input is not contenteditable: ${selector}`);
          }

          element.focus();
          const selection = window.getSelection();
          if (!selection) {
            throw new Error("Cannot access page selection.");
          }

          const range = document.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);

          const inserted = document.execCommand("insertText", false, text);
          if (!inserted) {
            throw new Error("Browser rejected insertText for the Flow prompt input.");
          }

          element.dispatchEvent(
            new InputEvent("input", {
              bubbles: true,
              inputType: "insertText",
              data: text,
            }),
          );
          element.dispatchEvent(new Event("change", { bubbles: true }));

          return {
            ok: true,
            selector,
            text,
            currentText: element.textContent || "",
          };
        },
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError.message ||
                "Simple insert test could not run on the active tab.",
            ),
          );
          return;
        }
        const result = results?.[0]?.result;
        if (!result?.ok) {
          reject(new Error("Simple insert test returned an invalid result."));
          return;
        }
        resolve(result);
      },
    );
  });
}

function openTab(targetUrl: string) {
  return new Promise<ChromeTab>((resolve, reject) => {
    chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message || "Cannot open target tab.",
          ),
        );
        return;
      }
      if (!tab.id) {
        reject(new Error("Chrome did not return a target tab id."));
        return;
      }
      resolve(tab);
    });
  });
}

function getActiveTab() {
  return new Promise<ChromeTab>((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "Cannot read active tab."));
        return;
      }
      const tab = tabs[0];
      if (!tab?.id) {
        reject(new Error("No active browser tab is available."));
        return;
      }
      resolve(tab);
    });
  });
}

function sendRunMessage(tabId: number, payload: AiHandoffPayload) {
  return new Promise<AiHandoffResponse>((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "VIDEOAI_AI_HANDOFF_RUN",
        payload,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError.message ||
                "Cannot contact AI target content script.",
            ),
          );
          return;
        }
        if (!isRecord(response) || typeof response.ok !== "boolean") {
          reject(
            new Error("AI target content script returned an invalid response."),
          );
          return;
        }
        resolve(response as AiHandoffResponse);
      },
    );
  });
}

function sendTabMessage(tabId: number, message: unknown) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message ||
              "Cannot contact AI target content script.",
          ),
        );
        return;
      }
      if (!isRecord(response)) {
        reject(new Error("AI target content script returned an invalid response."));
        return;
      }
      resolve(response);
    });
  });
}

async function pingContentScript(tabId: number) {
  const response = await sendTabMessage(tabId, {
    type: "VIDEOAI_AI_HANDOFF_CONTENT_PING",
  });
  return response.ok === true;
}

async function ensureContentScriptReady(tabId: number) {
  try {
    if (await pingContentScript(tabId)) {
      return;
    }
  } catch {
    // No receiver yet. Continue with explicit injection and retry below.
  }

  await injectContentScript(tabId);

  let lastError = "";
  for (const delayMs of [100, 250, 500, 1000]) {
    await sleep(delayMs);
    try {
      if (await pingContentScript(tabId)) {
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Content script did not respond.";
    }
  }

  throw new Error(
    [
      "Cannot connect to the Flow page content script.",
      "Reload the Flow tab, reload the unpacked VideoAI extension, then run Check DOM again.",
      lastError ? `Technical detail: ${lastError}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

async function runHandoff(
  payload: AiHandoffPayload,
): Promise<AiHandoffResponse> {
  const targetError = validateTarget(payload);
  if (targetError) {
    return fail(payload, targetError);
  }

  try {
    const tab = await openTab(payload.targetUrl);
    rememberLastHandoff(
      {
        ok: true,
        handoffId: payload.handoffId,
        status: "target_opened",
        message: "Target page opened.",
      },
      payload,
    );
    await waitForTabComplete(tab.id as number);
    await ensureContentScriptReady(tab.id as number);
    const response = await sendRunMessage(tab.id as number, payload);
    rememberLastHandoff(response, payload);
    return response;
  } catch (error) {
    const response = fail(
      payload,
      error instanceof Error ? error.message : "AI Handoff failed.",
    );
    rememberLastHandoff(response, payload);
    return response;
  }
}

async function startPromptSelectorCapture() {
  const config = await fetchActiveAiConfig();
  const provider = config.aiHandoffProvider?.trim();
  if (!provider) {
    throw new Error("AI Handoff provider is missing in Admin config.");
  }
  const tab = await getActiveTab();
  validateTabTarget(tab, provider);
  await ensureContentScriptReady(tab.id as number);
  const response = await sendTabMessage(tab.id as number, {
    type: "VIDEOAI_AI_HANDOFF_BEGIN_CAPTURE",
    payload: { provider },
  });
  if (response.ok !== true) {
    throw new Error(
      typeof response.errorMessage === "string"
        ? response.errorMessage
        : "Cannot start DOM capture.",
    );
  }
  rememberLastDomCheck({
    ok: true,
    provider,
    promptSelector: config.aiHandoffPromptSelector || "",
    message: "Capture mode started. Click the Flow prompt input.",
  });
  return {
    ok: true,
    status: "capture_started",
    message: "Capture mode started. Click the Flow prompt input.",
  };
}

async function testPromptSelector() {
  console.log("[VideoAI AI Handoff][background] Test input prompt started");
  const config = await fetchActiveAiConfig();
  const provider = config.aiHandoffProvider?.trim();
  const promptSelector = config.aiHandoffPromptSelector?.trim();
  console.log("[VideoAI AI Handoff][background] Loaded AI Handoff config", {
    provider,
    promptSelector,
    testPromptText,
  });
  if (!provider) {
    throw new Error("AI Handoff provider is missing in Admin config.");
  }
  if (!promptSelector) {
    throw new Error(
      "AI Handoff prompt selector is not configured. Open Flow, run Check DOM, then try again.",
    );
  }
  const tab = await getActiveTab();
  console.log("[VideoAI AI Handoff][background] Active tab for test input prompt", {
    tabId: tab.id,
    url: tab.url,
  });
  validateTabTarget(tab, provider);
  await ensureContentScriptReady(tab.id as number);
  console.log("[VideoAI AI Handoff][background] Content script ready; sending test fill", {
    tabId: tab.id,
    provider,
    promptSelector,
    testPromptText,
  });
  const response = await sendTabMessage(tab.id as number, {
    type: "VIDEOAI_AI_HANDOFF_TEST_FILL",
    payload: { provider, promptSelector, testText: testPromptText },
  });
  console.log("[VideoAI AI Handoff][background] Test fill response", response);
  if (response.ok !== true) {
    throw new Error(
      typeof response.errorMessage === "string"
        ? response.errorMessage
        : "Cannot fill the test prompt.",
    );
  }
  rememberLastDomCheck({
    ok: true,
    provider,
    promptSelector,
    message: "Test prompt filled successfully.",
  });
  return response;
}

async function simpleInsertTest() {
  console.log("[VideoAI AI Handoff][background] Simple insert test started", {
    selector: simpleInsertSelector,
    text: simpleInsertText,
  });
  const tab = await getActiveTab();
  console.log("[VideoAI AI Handoff][background] Active tab for simple insert test", {
    tabId: tab.id,
    url: tab.url,
  });
  validateTabTarget(tab, "google-flow-veo");
  const result = await runSimpleInsertScript(tab.id as number);
  console.log("[VideoAI AI Handoff][background] Simple insert test result", result);
  rememberLastDomCheck({
    ok: true,
    provider: "google-flow-veo",
    promptSelector: simpleInsertSelector,
    message: `Simple insert test filled "${simpleInsertText}".`,
  });
  return {
    ok: true,
    status: "prompt_filled",
    message: `Simple insert test filled "${simpleInsertText}".`,
    result,
  };
}

async function saveCapturedSelector(provider: string, report: DomSelectorReport) {
  const promptSelector = report.promptSelector.trim();
  if (!promptSelector) {
    throw new Error("Captured selector is empty.");
  }
  await savePromptSelectorToAdmin(provider, promptSelector);
  const message =
    report.clipboardStatus === "copied"
      ? "Prompt selector saved to VideoAI Admin config and copied to clipboard."
      : report.clipboardStatus === "failed"
        ? "Prompt selector saved to VideoAI Admin config. Clipboard copy failed; use Copy selector in the extension popup."
        : report.clipboardStatus === "unsupported"
          ? "Prompt selector saved to VideoAI Admin config. Clipboard copy is not supported on this page."
          : "Prompt selector saved to VideoAI Admin config.";
  rememberLastDomCheck({
    ok: true,
    provider,
    promptSelector,
    message,
    report,
  });
  return {
    ok: true,
    status: "selector_saved",
    message,
    promptSelector,
  };
}

chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    rememberVideoAiOrigin(sender as ChromeMessageSender);
    if (!isRuntimeMessage(message)) {
      sendResponse(fail(undefined, "Invalid AI Handoff message."));
      return false;
    }

    if (message.type === "VIDEOAI_AI_HANDOFF_PING") {
      sendResponse({ ok: true, status: "ready", name: "VideoAI AI Handoff" });
      return false;
    }

    if (
      message.type !== "VIDEOAI_AI_HANDOFF_START" ||
      !isPayload(message.payload)
    ) {
      sendResponse(fail(undefined, "Invalid AI Handoff payload."));
      return false;
    }

    void runHandoff(message.payload).then(sendResponse);
    return true;
  },
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) {
    sendResponse(responseError(undefined, "Invalid extension message."));
    return false;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_CAPTURE_PROMPT_SELECTOR") {
    void startPromptSelectorCapture()
      .then(sendResponse)
      .catch((error: unknown) => {
        const response = responseError(error, "Cannot start DOM capture.");
        rememberLastDomCheck({
          ok: false,
          errorMessage: response.errorMessage,
        });
        sendResponse(response);
      });
    return true;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_TEST_PROMPT_SELECTOR") {
    void testPromptSelector()
      .then(sendResponse)
      .catch((error: unknown) => {
        const response = responseError(error, "Cannot fill test prompt.");
        rememberLastDomCheck({
          ok: false,
          errorMessage: response.errorMessage,
        });
        sendResponse(response);
      });
    return true;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_SIMPLE_INSERT_TEST") {
    void simpleInsertTest()
      .then(sendResponse)
      .catch((error: unknown) => {
        const response = responseError(error, "Cannot run simple insert test.");
        rememberLastDomCheck({
          ok: false,
          provider: "google-flow-veo",
          promptSelector: simpleInsertSelector,
          errorMessage: response.errorMessage,
        });
        sendResponse(response);
      });
    return true;
  }

  if (message.type === "VIDEOAI_AI_HANDOFF_SELECTOR_CAPTURED") {
    void saveCapturedSelector(message.payload.provider, message.payload.report)
      .then(sendResponse)
      .catch((error: unknown) => {
        const response = responseError(error, "Cannot save captured selector.");
        rememberLastDomCheck({
          ok: false,
          provider: message.payload.provider,
          promptSelector: message.payload.report.promptSelector,
          errorMessage: response.errorMessage,
          report: message.payload.report,
        });
        sendResponse(response);
      });
    return true;
  }

  return false;
});
