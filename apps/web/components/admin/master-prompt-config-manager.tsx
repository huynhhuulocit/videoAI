"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type {
  MasterPromptAttribute,
  MasterPromptAttributeConfig,
  MasterPromptAttributeOption,
} from "@videoai/contracts";
import { Button } from "../ui/button";
import { TextareaWithCounter } from "../ui/textarea-with-counter";

type ApiSuccess<T> = {
  data: T;
};

const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function emptyOption(): MasterPromptAttributeOption {
  return {
    id: makeId("option"),
    name: "",
    description: "",
  };
}

function emptyAttribute(): MasterPromptAttribute {
  return {
    id: makeId("attribute"),
    name: "",
    description: "",
    options: [emptyOption()],
  };
}

function createInitialAttributes() {
  return [emptyAttribute()];
}

function formatConfigJson(attributes: MasterPromptAttribute[]) {
  return JSON.stringify({ attributes }, null, 2);
}

function parseConfigJsonDraft(value: string): MasterPromptAttribute[] {
  const parsed = JSON.parse(value) as unknown;
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const attributesInput = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root.attributes)
      ? root.attributes
      : null;

  if (!attributesInput) {
    throw new Error("JSON must contain an attributes array.");
  }

  return attributesInput.map((attributeInput, attributeIndex): MasterPromptAttribute => {
    const attribute = attributeInput && typeof attributeInput === "object"
      ? attributeInput as Record<string, unknown>
      : {};
    const id = String(attribute.id ?? `attribute-${attributeIndex + 1}`).trim();
    const optionsInput = Array.isArray(attribute.options) ? attribute.options : [];
    const options = optionsInput.map((optionInput, optionIndex): MasterPromptAttributeOption => {
      const option = optionInput && typeof optionInput === "object"
        ? optionInput as Record<string, unknown>
        : {};
      return {
        id: String(option.id ?? `${id}-option-${optionIndex + 1}`).trim(),
        name: String(option.name ?? "").trim(),
        description: String(option.description ?? "").trim(),
      };
    });

    return {
      id,
      name: String(attribute.name ?? "").trim(),
      description: String(attribute.description ?? "").trim(),
      options: options.length > 0 ? options : [emptyOption()],
    };
  });
}

function parseConfigJson(value: string): MasterPromptAttribute[] {
  const attributes = parseConfigJsonDraft(value)
    .map((attribute) => ({
      ...attribute,
      id: attribute.id.trim(),
      name: attribute.name.trim(),
      description: attribute.description?.trim() || undefined,
      options: attribute.options
        .map((option) => ({
          id: option.id.trim(),
          name: option.name.trim(),
          description: option.description?.trim() || undefined,
        }))
        .filter((option) => option.id && option.name),
    }))
    .filter((attribute) => attribute.id && attribute.name && attribute.options.length > 0);

  if (attributes.length === 0) {
    throw new Error("At least one attribute with one option is required.");
  }

  return attributes;
}

async function fetchConfig() {
  const response = await fetch("/api/v1/admin/master-prompt-config", {
    cache: "no-store",
    headers: { "x-request-id": `web-${Date.now()}` },
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<ApiSuccess<MasterPromptAttributeConfig>> & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }
  if (!payload.data) {
    throw new Error("Master Prompt Config response is missing data.");
  }
  return payload.data;
}

async function saveConfig(attributes: MasterPromptAttribute[]) {
  const response = await fetch("/api/v1/admin/master-prompt-config", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-request-id": `web-${Date.now()}`,
    },
    body: JSON.stringify({ attributes }),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<ApiSuccess<MasterPromptAttributeConfig>> & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }
  if (!payload.data) {
    throw new Error("Master Prompt Config response is missing data.");
  }
  return payload.data;
}

export function MasterPromptConfigManager() {
  const [attributes, setAttributes] = useState<MasterPromptAttribute[]>(createInitialAttributes);
  const [jsonText, setJsonText] = useState(formatConfigJson(createInitialAttributes()));
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const updatedLabel = useMemo(() => {
    if (!message) {
      return "";
    }
    return message;
  }, [message]);

  function syncAttributes(nextAttributes: MasterPromptAttribute[]) {
    setAttributes(nextAttributes);
    setJsonText(formatConfigJson(nextAttributes));
    setIsEditingJson(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const config = await fetchConfig();
        if (cancelled) {
          return;
        }
        const nextAttributes = config.attributes.length > 0 ? config.attributes : createInitialAttributes();
        syncAttributes(nextAttributes);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Cannot load Master Prompt Config.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateJsonText(nextJsonText: string) {
    setJsonText(nextJsonText);
    setIsEditingJson(true);
    try {
      setAttributes(parseConfigJsonDraft(nextJsonText));
    } catch {
      // Keep the visual editor stable while JSON is incomplete.
    }
  }

  function updateAttribute(attributeId: string, patch: Partial<MasterPromptAttribute>) {
    syncAttributes(
      attributes.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, ...patch } : attribute,
      ),
    );
  }

  function updateOption(
    attributeId: string,
    optionId: string,
    patch: Partial<MasterPromptAttributeOption>,
  ) {
    syncAttributes(
      attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: attribute.options.map((option) =>
                option.id === optionId ? { ...option, ...patch } : option,
              ),
            }
          : attribute,
      ),
    );
  }

  function addAttribute() {
    syncAttributes([...attributes, emptyAttribute()]);
  }

  function removeAttribute(attributeId: string) {
    const nextAttributes = attributes.filter((attribute) => attribute.id !== attributeId);
    syncAttributes(nextAttributes.length > 0 ? nextAttributes : createInitialAttributes());
  }

  function addOption(attributeId: string) {
    syncAttributes(
      attributes.map((attribute) =>
        attribute.id === attributeId
          ? { ...attribute, options: [...attribute.options, emptyOption()] }
          : attribute,
      ),
    );
  }

  function removeOption(attributeId: string, optionId: string) {
    syncAttributes(
      attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options:
                attribute.options.length > 1
                  ? attribute.options.filter((option) => option.id !== optionId)
                  : attribute.options,
            }
          : attribute,
      ),
    );
  }

  function applyJson() {
    try {
      const parsed = parseConfigJson(jsonText);
      syncAttributes(parsed);
      setMessage("JSON applied.");
      setError("");
    } catch (jsonError) {
      setMessage("");
      setError(jsonError instanceof Error ? jsonError.message : "Invalid JSON.");
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const attributesToSave = isEditingJson ? parseConfigJson(jsonText) : parseConfigJson(formatConfigJson(attributes));
      const saved = await saveConfig(attributesToSave);
      syncAttributes(saved.attributes.length > 0 ? saved.attributes : createInitialAttributes());
      setMessage("Master Prompt Config saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Cannot save Master Prompt Config.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Master Prompt Config</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Build one admin-only attribute set for prompt authors. Story, Scenario, and Shots master prompts
            can select these options and include them only through {"{masterPromptAttributes}"}.
          </p>
        </div>
        <Button type="button" className="gap-2" disabled={isSaving || isLoading} onClick={() => void handleSave()}>
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save config
        </Button>
      </div>

      {updatedLabel ? (
        <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {updatedLabel}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-md bg-muted p-4 text-sm text-muted-foreground">Loading Master Prompt Config...</div>
      ) : (
        <>
          <label className="mt-5 block text-sm font-semibold text-foreground" htmlFor="master-prompt-config-json">
            Attribute JSON
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              JSON uses id, name, description, and option descriptions. The visual editor and JSON editor stay synchronized.
            </p>
            <TextareaWithCounter
              id="master-prompt-config-json"
              className="mt-2 min-h-80 font-mono text-xs"
              value={jsonText}
              onChange={(event) => updateJsonText(event.target.value)}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="gap-2" onClick={applyJson}>
              <Check size={16} /> Apply JSON
            </Button>
            <Button type="button" variant="secondary" className="gap-2" onClick={addAttribute}>
              <Plus size={16} /> Add attribute
            </Button>
          </div>

          <div className="mt-5 space-y-4">
            {attributes.map((attribute, attributeIndex) => (
              <div key={attribute.id} className="rounded-md border border-border p-4">
                <div className="grid gap-3 md:grid-cols-[2rem_minmax(0,1fr)_auto]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-700">
                    {attributeIndex + 1}
                  </div>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <input
                      className={inputClass}
                      value={attribute.name}
                      placeholder="Attribute name"
                      onChange={(event) => updateAttribute(attribute.id, { name: event.target.value })}
                    />
                    <input
                      className={inputClass}
                      value={attribute.description ?? ""}
                      placeholder="Attribute description"
                      onChange={(event) => updateAttribute(attribute.id, { description: event.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-10 px-0"
                    aria-label="Delete attribute"
                    onClick={() => removeAttribute(attribute.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {attribute.options.map((option, optionIndex) => (
                    <div
                      key={option.id}
                      className="grid items-start gap-3 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
                    >
                      <div className="rounded-md bg-muted px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                        {attributeIndex + 1}.{optionIndex + 1}
                      </div>
                      <input
                        className={inputClass}
                        value={option.name}
                        placeholder="Option name"
                        onChange={(event) => updateOption(attribute.id, option.id, { name: event.target.value })}
                      />
                      <input
                        className={inputClass}
                        value={option.description ?? ""}
                        placeholder="Option description"
                        onChange={(event) => updateOption(attribute.id, option.id, { description: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 w-10 px-0"
                        aria-label="Show helper text"
                        onClick={() =>
                          setExpandedIds((current) => ({
                            ...current,
                            [option.id]: !current[option.id],
                          }))
                        }
                      >
                        <Info size={15} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 w-10 px-0"
                        aria-label="Delete option"
                        onClick={() => removeOption(attribute.id, option.id)}
                      >
                        <Trash2 size={15} />
                      </Button>
                      {expandedIds[option.id] ? (
                        <div className="md:col-start-2 md:col-span-3 rounded-md bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                          {option.description || "No option description yet."}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <Button type="button" variant="secondary" className="gap-2" onClick={() => addOption(attribute.id)}>
                    <Plus size={15} /> Add option
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
