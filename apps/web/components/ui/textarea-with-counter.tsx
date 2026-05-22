"use client";

import type { KeyboardEvent, TextareaHTMLAttributes } from "react";
import { useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useI18n } from "../i18n/language-provider";

export type TextareaPlaceholderSuggestion = {
  token: string;
  description: string;
};

type TextareaWithCounterProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  placeholderSuggestions?: TextareaPlaceholderSuggestion[];
  showPlaceholderList?: boolean;
};

type PlaceholderTrigger = {
  start: number;
  query: string;
};

function findPlaceholderTrigger(value: string, cursorPosition: number): PlaceholderTrigger | null {
  const beforeCursor = value.slice(0, cursorPosition);
  const openIndex = beforeCursor.lastIndexOf("{");

  if (openIndex === -1) {
    return null;
  }

  const query = beforeCursor.slice(openIndex);

  if (query.includes("}") || /\s/.test(query) || query.length > 48) {
    return null;
  }

  return {
    start: openIndex,
    query: query.toLowerCase()
  };
}

function setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export function TextareaWithCounter({
  className = "",
  value,
  defaultValue,
  onBlur,
  onChange,
  onClick,
  onKeyDown,
  onKeyUp,
  placeholderSuggestions = [],
  showPlaceholderList = false,
  ...props
}: TextareaWithCounterProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<PlaceholderTrigger | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [activeHelpToken, setActiveHelpToken] = useState("");
  const currentValue =
    typeof value === "string"
      ? value
      : typeof defaultValue === "string"
        ? defaultValue
        : "";
  const suggestions = useMemo(() => {
    if (!trigger) {
      return [];
    }

    return placeholderSuggestions.filter((suggestion) =>
      suggestion.token.toLowerCase().startsWith(trigger.query),
    );
  }, [placeholderSuggestions, trigger]);
  const hasSuggestions = suggestions.length > 0;

  function refreshSuggestions(textarea: HTMLTextAreaElement) {
    if (placeholderSuggestions.length === 0) {
      setTrigger(null);
      return;
    }

    const nextTrigger = findPlaceholderTrigger(textarea.value, textarea.selectionStart);
    setTrigger((current) => {
      if (current?.start === nextTrigger?.start && current?.query === nextTrigger?.query) {
        return current;
      }

      setActiveSuggestionIndex(0);
      return nextTrigger;
    });
  }

  function insertSuggestion(suggestion: TextareaPlaceholderSuggestion) {
    const textarea = textareaRef.current;

    if (!textarea || !trigger) {
      return;
    }

    const cursorPosition = textarea.selectionStart;
    const nextValue = `${textarea.value.slice(0, trigger.start)}${suggestion.token}${textarea.value.slice(cursorPosition)}`;
    const nextCursorPosition = trigger.start + suggestion.token.length;

    setNativeTextareaValue(textarea, nextValue);
    textarea.focus();
    requestAnimationFrame(() => {
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
      setTrigger(null);
    });
  }

  function insertToken(suggestion: TextareaPlaceholderSuggestion) {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const nextValue = `${textarea.value.slice(0, selectionStart)}${suggestion.token}${textarea.value.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + suggestion.token.length;

    setNativeTextareaValue(textarea, nextValue);
    textarea.focus();
    requestAnimationFrame(() => {
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
      setTrigger(null);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (hasSuggestions) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertSuggestion(suggestions[Math.min(activeSuggestionIndex, suggestions.length - 1)]!);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setTrigger(null);
        return;
      }
    }

    onKeyDown?.(event);
  }

  return (
    <div className="w-full">
      <div className="relative w-full">
        <textarea
          ref={textareaRef}
          value={value}
          defaultValue={defaultValue}
          className={`block w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm leading-5 text-foreground shadow-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 ${className} pb-8`}
          {...props}
          onBlur={(event) => {
            window.setTimeout(() => setTrigger(null), 120);
            onBlur?.(event);
          }}
          onChange={(event) => {
            refreshSuggestions(event.currentTarget);
            onChange?.(event);
          }}
          onClick={(event) => {
            refreshSuggestions(event.currentTarget);
            onClick?.(event);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => {
            refreshSuggestions(event.currentTarget);
            onKeyUp?.(event);
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-3 text-[11px] leading-none text-muted-foreground"
        >
          {t("common.characterCount", { count: currentValue.length })}
        </span>
        {hasSuggestions ? (
          <div className="absolute left-3 right-3 top-full z-20 mt-1 overflow-hidden rounded-md border border-sky-200 bg-white text-sm shadow-lg">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.token}
                type="button"
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                  index === activeSuggestionIndex ? "bg-sky-50" : "bg-white"
                } hover:bg-sky-50`}
                title={suggestion.description}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertSuggestion(suggestion);
                }}
              >
                <span className="font-mono font-semibold text-sky-900">{suggestion.token}</span>
                <Info size={14} className="shrink-0 text-sky-700" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {showPlaceholderList && placeholderSuggestions.length > 0 ? (
        <div className="mt-3 rounded-md border border-sky-100 bg-white/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-900">
            Available placeholders
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {placeholderSuggestions.map((suggestion) => {
              const isHelpOpen = activeHelpToken === suggestion.token;
              return (
                <div key={suggestion.token} className="min-w-0 rounded-md bg-sky-50 px-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-mono text-xs font-semibold text-sky-950"
                      onClick={() => insertToken(suggestion)}
                    >
                      {suggestion.token}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      aria-label={`Show help for ${suggestion.token}`}
                      title={suggestion.description}
                      onClick={() => setActiveHelpToken(isHelpOpen ? "" : suggestion.token)}
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {isHelpOpen ? (
                    <p className="mt-1 text-xs leading-5 text-sky-800/80">{suggestion.description}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-sky-800/80">
            Click a placeholder to insert it, or type {"{"} to search and press Enter.
          </p>
        </div>
      ) : null}
    </div>
  );
}
