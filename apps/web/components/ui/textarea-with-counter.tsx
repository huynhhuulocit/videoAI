"use client";

import type { KeyboardEvent, TextareaHTMLAttributes } from "react";
import { useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/language-provider";

export type TextareaPlaceholderSuggestion = {
  token: string;
  description: string;
};

type TextareaWithCounterProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  placeholderSuggestions?: TextareaPlaceholderSuggestion[];
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
  ...props
}: TextareaWithCounterProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<PlaceholderTrigger | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
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
              className={`block w-full px-3 py-2 text-left ${
                index === activeSuggestionIndex ? "bg-sky-50" : "bg-white"
              } hover:bg-sky-50`}
              onMouseDown={(event) => {
                event.preventDefault();
                insertSuggestion(suggestion);
              }}
            >
              <span className="font-mono font-semibold text-sky-900">{suggestion.token}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {suggestion.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
