export type AiHandoffStatus =
  | "created"
  | "sent_to_extension"
  | "target_opened"
  | "prompt_filled"
  | "generate_clicked"
  | "failed"
  | "completed_manually";

export type AiHandoffPayload = {
  handoffId: string;
  provider: string;
  targetUrl: string;
  promptText: string;
  promptSelector: string;
  shotId: string;
};

export type DomSelectorReport = {
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

export type AiHandoffResponse =
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

export type RuntimeMessage =
  | {
      type: "VIDEOAI_AI_HANDOFF_PING";
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_START";
      payload: AiHandoffPayload;
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_RUN";
      payload: AiHandoffPayload;
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_CONTENT_PING";
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_CAPTURE_PROMPT_SELECTOR";
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_BEGIN_CAPTURE";
      payload: { provider: string };
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_SELECTOR_CAPTURED";
      payload: { provider: string; report: DomSelectorReport };
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_TEST_PROMPT_SELECTOR";
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_SIMPLE_INSERT_TEST";
    }
  | {
      type: "VIDEOAI_AI_HANDOFF_TEST_FILL";
      payload: { provider: string; promptSelector: string; testText: string };
    };

export type AdapterConfig = {
  provider: string;
  targetUrl: string;
  allowedOrigins: string[];
  generateButtonSelector: string;
  loginRequiredSelector: string;
};

export type ChromeTab = {
  id?: number;
  url?: string;
  status?: string;
};

export type ChromeMessageSender = {
  url?: string;
  origin?: string;
  tab?: ChromeTab;
};

export type ChromeRuntime = {
  lastError?: { message?: string };
  onMessageExternal: {
    addListener(
      callback: (
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void,
      ) => boolean | void,
    ): void;
  };
  onMessage: {
    addListener(
      callback: (
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void,
      ) => boolean | void,
    ): void;
  };
  sendMessage(message: unknown, callback?: (response: unknown) => void): void;
  sendMessage(extensionId: string, message: unknown, callback?: (response: unknown) => void): void;
};

export type ChromeApi = {
  runtime: ChromeRuntime;
  tabs: {
    create(
      createProperties: { url: string; active?: boolean },
      callback: (tab: ChromeTab) => void,
    ): void;
    query(
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: ChromeTab[]) => void,
    ): void;
    sendMessage(
      tabId: number,
      message: unknown,
      callback?: (response: unknown) => void,
    ): void;
    onUpdated: {
      addListener(
        callback: (
          tabId: number,
          changeInfo: ChromeTab,
          tab: ChromeTab,
        ) => void,
      ): void;
      removeListener(
        callback: (
          tabId: number,
          changeInfo: ChromeTab,
          tab: ChromeTab,
        ) => void,
      ): void;
    };
  };
  scripting: {
    executeScript(
      injection: {
        target: { tabId: number };
        files: string[];
      },
      callback?: () => void,
    ): void;
    executeScript<Args extends unknown[] = unknown[], Result = unknown>(
      injection: {
        target: { tabId: number };
        func: (...args: Args) => Result;
        args?: Args;
      },
      callback?: (results?: Array<{ result?: Result }>) => void,
    ): void;
  };
  storage: {
    local: {
      set(items: Record<string, unknown>): Promise<void> | void;
      get(
        keys: string[],
        callback: (items: Record<string, unknown>) => void,
      ): void;
    };
  };
};

declare global {
  const chrome: ChromeApi;
}
