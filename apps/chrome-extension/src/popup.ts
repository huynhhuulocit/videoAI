type LastHandoff = {
  ok?: boolean;
  handoffId?: string;
  status?: string;
  errorMessage?: string;
  message?: string;
  provider?: string;
  shotId?: string;
  updatedAt?: string;
};

type LastDomCheck = {
  ok?: boolean;
  provider?: string;
  promptSelector?: string;
  message?: string;
  errorMessage?: string;
  updatedAt?: string;
  report?: unknown;
};

type SelectorReport = {
  promptSelector?: string;
};

function setText(id: string, value: string) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function getButton(id: string) {
  return document.getElementById(id) as HTMLButtonElement | null;
}

function renderHandoff(lastHandoff: LastHandoff | null) {
  if (!lastHandoff) {
    setText("last-result", "No handoff has run in this browser yet.");
    return;
  }

  const status = lastHandoff.status ?? "unknown";
  const resultText = lastHandoff.ok
    ? (lastHandoff.message ?? status)
    : (lastHandoff.errorMessage ?? "Handoff failed.");
  setText(
    "last-result",
    [
      `Status: ${status}`,
      lastHandoff.provider ? `Provider: ${lastHandoff.provider}` : "",
      lastHandoff.shotId ? `Shot: ${lastHandoff.shotId}` : "",
      lastHandoff.updatedAt ? `Updated: ${lastHandoff.updatedAt}` : "",
      resultText,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function renderDomCheck(lastDomCheck: LastDomCheck | null) {
  if (!lastDomCheck) {
    setText(
      "dom-result",
      "No selector captured yet. Open Flow, click Check DOM, then click the prompt input.",
    );
    return;
  }

  const resultText = lastDomCheck.ok
    ? (lastDomCheck.message ?? "Selector is ready.")
    : (lastDomCheck.errorMessage ?? "Selector check failed.");
  const selector = getLastSelector(lastDomCheck);
  setText(
    "dom-result",
    [
      `Status: ${lastDomCheck.ok ? "success" : "failed"}`,
      lastDomCheck.provider ? `Provider: ${lastDomCheck.provider}` : "",
      selector ? `Saved selector:\n${selector}` : "",
      lastDomCheck.updatedAt ? `Updated: ${lastDomCheck.updatedAt}` : "",
      resultText,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function getLastSelector(lastDomCheck: LastDomCheck | null) {
  if (lastDomCheck?.promptSelector) {
    return lastDomCheck.promptSelector;
  }
  const report = lastDomCheck?.report as SelectorReport | undefined;
  return typeof report?.promptSelector === "string" ? report.promptSelector : "";
}

function refresh() {
  chrome.storage.local.get(["lastHandoff", "lastDomCheck"], (items) => {
    renderHandoff((items.lastHandoff as LastHandoff | undefined) ?? null);
    renderDomCheck((items.lastDomCheck as LastDomCheck | undefined) ?? null);
    setText("status", "Ready");
  });
}

function sendAction(type: string, pendingMessage: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    console.log("[VideoAI AI Handoff][popup] sendAction", {
      type,
      pendingMessage,
    });
    setText("status", "Working");
    setText("action-message", pendingMessage);
    chrome.runtime.sendMessage({ type }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[VideoAI AI Handoff][popup] sendAction runtime error", {
          type,
          error: chrome.runtime.lastError.message,
        });
        reject(new Error(chrome.runtime.lastError.message || "Extension action failed."));
        return;
      }
      if (!response || typeof response !== "object") {
        console.error("[VideoAI AI Handoff][popup] sendAction invalid response", {
          type,
          response,
        });
        reject(new Error("Extension returned an invalid response."));
        return;
      }
      console.log("[VideoAI AI Handoff][popup] sendAction response", {
        type,
        response,
      });
      resolve(response as Record<string, unknown>);
    });
  });
}

async function runAction(type: string, pendingMessage: string) {
  const buttons = ["check-dom", "test-fill", "simple-insert-test", "copy-selector", "copy-report"]
    .map(getButton)
    .filter(Boolean) as HTMLButtonElement[];
  buttons.forEach((button) => {
    button.disabled = true;
  });
  try {
    const response = await sendAction(type, pendingMessage);
    if (response.ok === false) {
      throw new Error(
        typeof response.errorMessage === "string"
          ? response.errorMessage
          : "Extension action failed.",
      );
    }
    setText(
      "action-message",
      typeof response.message === "string"
        ? response.message
        : "Action completed successfully.",
    );
  } catch (error) {
    setText(
      "action-message",
      error instanceof Error ? error.message : "Extension action failed.",
    );
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
    refresh();
  }
}

async function copyLastSelector() {
  chrome.storage.local.get(["lastDomCheck"], async (items) => {
    const lastDomCheck = (items.lastDomCheck as LastDomCheck | undefined) ?? null;
    const selector = getLastSelector(lastDomCheck);
    if (!selector) {
      setText("action-message", "No selector is available yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(selector);
      setText("action-message", "Selector copied.");
    } catch {
      setText("action-message", "Cannot copy selector.");
    }
  });
}

async function copyLastSelectorReport() {
  chrome.storage.local.get(["lastDomCheck"], async (items) => {
    const lastDomCheck = (items.lastDomCheck as LastDomCheck | undefined) ?? null;
    if (!lastDomCheck?.report) {
      setText("action-message", "No selector report is available yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(lastDomCheck.report, null, 2),
      );
      setText("action-message", "Selector report copied.");
    } catch {
      setText("action-message", "Cannot copy selector report.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();
  getButton("check-dom")?.addEventListener("click", () => {
    void runAction(
      "VIDEOAI_AI_HANDOFF_CAPTURE_PROMPT_SELECTOR",
      "Starting capture mode on the active Flow tab...",
    );
  });
  getButton("test-fill")?.addEventListener("click", () => {
    console.log("[VideoAI AI Handoff][popup] Test input prompt clicked", {
      messageType: "VIDEOAI_AI_HANDOFF_TEST_PROMPT_SELECTOR",
      expectedText: "test input prompt",
    });
    void runAction(
      "VIDEOAI_AI_HANDOFF_TEST_PROMPT_SELECTOR",
      "Filling test input prompt on the active Flow tab...",
    );
  });
  getButton("simple-insert-test")?.addEventListener("click", () => {
    console.log("[VideoAI AI Handoff][popup] Simple insert test clicked", {
      messageType: "VIDEOAI_AI_HANDOFF_SIMPLE_INSERT_TEST",
      selector: 'div[role="textbox"][contenteditable="true"][data-slate-editor="true"]',
      text: "hello 123",
    });
    void runAction(
      "VIDEOAI_AI_HANDOFF_SIMPLE_INSERT_TEST",
      "Running simple insert test on the active Flow tab...",
    );
  });
  getButton("copy-selector")?.addEventListener("click", () => {
    void copyLastSelector();
  });
  getButton("copy-report")?.addEventListener("click", () => {
    void copyLastSelectorReport();
  });
});
