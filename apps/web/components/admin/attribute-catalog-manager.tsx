"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, Loader2, Plus, Save, Sparkles, Star, Trash2 } from "lucide-react";
import type {
  AttributeCatalog,
  AttributeCatalogAttribute,
  AttributeCatalogType,
} from "@videoai/contracts";
import { Button, LinkButton } from "../ui/button";
import { TextareaWithCounter } from "../ui/textarea-with-counter";
import { AiDebugDialog, type AiDebugDialogData } from "../ui/ai-debug-dialog";
import { FeedbackToast, useFeedbackToast } from "../ui/feedback-toast";

type CatalogConfig = {
  type: AttributeCatalogType;
  catalogs: AttributeCatalog[];
  defaultCatalog: AttributeCatalog | null;
  updatedAt: string;
};

type AttributePrompt = {
  type: AttributeCatalogType;
  content: string;
  updatedAt: string | null;
};

type GenerateResult = {
  type: AttributeCatalogType;
  attributes: AttributeCatalogAttribute[];
  rawRequest: unknown;
  rawResponse: unknown;
  provider: string;
  model: string;
};

type AttributeCatalogListProps = {
  type: AttributeCatalogType;
  title: string;
  description: string;
};

type AttributeCatalogEditorProps = AttributeCatalogListProps & {
  catalogId?: string | undefined;
};

const typeLabel = {
  story: "Story",
  scenario: "Scenario",
  shots: "Shots",
  shot: "Shot",
} satisfies Record<AttributeCatalogType, string>;

const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200";

function unwrap<T>(payload: { data: T } | T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return unwrap<T>(payload);
}

async function apiSend<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`/api/v1${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return unwrap<T>(payload);
}

function normalizeId(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function emptyAttribute(): AttributeCatalogAttribute {
  const id = makeId("attribute");
  return {
    id,
    name: "",
    description: "",
    required: false,
    options: [{ id: makeId("option"), name: "", description: "" }],
  };
}

function createEmptyAttributes() {
  return [emptyAttribute()];
}

function formatCatalogJson(attributes: AttributeCatalogAttribute[]) {
  return JSON.stringify({ attributes }, null, 2);
}

function parseCatalogJson(value: string): AttributeCatalogAttribute[] {
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
  const attributes = attributesInput
    .map((attributeInput, attributeIndex): AttributeCatalogAttribute | null => {
      const attribute = attributeInput && typeof attributeInput === "object"
        ? attributeInput as Record<string, unknown>
        : {};
      const name = String(attribute.name ?? attribute.label ?? "").trim();
      if (!name) {
        return null;
      }
      const id = String(
        attribute.id ?? normalizeId(name, `attribute-${attributeIndex + 1}`),
      ).trim();
      const optionsInput = Array.isArray(attribute.options) ? attribute.options : [];
      const options = optionsInput
        .map((optionInput, optionIndex) => {
          const option = optionInput && typeof optionInput === "object"
            ? optionInput as Record<string, unknown>
            : {};
          const optionName = String(option.name ?? option.label ?? option.value ?? "").trim();
          if (!optionName) {
            return null;
          }
          return {
            id: String(option.id ?? `${id}-${normalizeId(optionName, `option-${optionIndex + 1}`)}`).trim(),
            name: optionName,
            description: String(option.description ?? "").trim(),
          };
        })
        .filter((option): option is { id: string; name: string; description: string } => Boolean(option));
      if (options.length === 0) {
        return null;
      }
      return {
        id,
        name,
        description: String(attribute.description ?? "").trim(),
        required: Boolean(attribute.required),
        options,
      };
    })
    .filter((attribute): attribute is AttributeCatalogAttribute => Boolean(attribute));
  if (attributes.length === 0) {
    throw new Error("At least one valid attribute is required.");
  }
  return attributes;
}

function parseCatalogJsonDraft(value: string): AttributeCatalogAttribute[] {
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
  return attributesInput.map((attributeInput, attributeIndex): AttributeCatalogAttribute => {
    const attribute = attributeInput && typeof attributeInput === "object"
      ? attributeInput as Record<string, unknown>
      : {};
    const name = String(attribute.name ?? attribute.label ?? "").trim();
    const id = String(
      attribute.id ?? normalizeId(name, `attribute-${attributeIndex + 1}`),
    ).trim();
    const optionsInput = Array.isArray(attribute.options) ? attribute.options : [];
    const options = optionsInput.map((optionInput, optionIndex) => {
      const option = optionInput && typeof optionInput === "object"
        ? optionInput as Record<string, unknown>
        : {};
      const optionName = String(option.name ?? option.label ?? option.value ?? "").trim();
      return {
        id: String(option.id ?? `${id}-${normalizeId(optionName, `option-${optionIndex + 1}`)}`).trim(),
        name: optionName,
        description: String(option.description ?? "").trim(),
      };
    });
    return {
      id,
      name,
      description: String(attribute.description ?? "").trim(),
      required: Boolean(attribute.required),
      options: options.length > 0 ? options : [{ id: makeId("option"), name: "", description: "" }],
    };
  });
}

function getAttributeJsonFormat(type: AttributeCatalogType) {
  return formatCatalogJson([
    {
      id: `${type}-mood`,
      name: "Mood",
      description: "Primary feeling or direction.",
      required: true,
      options: [
        {
          id: `${type}-mood-friendly`,
          name: "Friendly",
          description: "Warm, approachable, and easy to understand.",
        },
      ],
    },
  ]);
}

function buildPromptPreview(prompt: string, sourceText: string, type: AttributeCatalogType) {
  return prompt
    .replaceAll("{inputText}", sourceText)
    .replaceAll("{attributeJsonFormat}", getAttributeJsonFormat(type));
}

function catalogListHref(type: AttributeCatalogType) {
  return `/admin/${type}/attributes`;
}

function catalogNewHref(type: AttributeCatalogType) {
  return `${catalogListHref(type)}/new`;
}

function catalogEditHref(type: AttributeCatalogType, catalogId: string) {
  return `${catalogListHref(type)}/${catalogId}`;
}

export function AttributeCatalogList({ type, title, description }: AttributeCatalogListProps) {
  const { clearToast, showToast, toast } = useFeedbackToast();
  const [catalogs, setCatalogs] = useState<AttributeCatalog[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [busyCatalogId, setBusyCatalogId] = useState("");
  const [busyCatalogAction, setBusyCatalogAction] = useState<"default" | "delete" | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError("");
    try {
      const config = await apiGet<CatalogConfig>(`/admin/attribute-catalogs?type=${type}`);
      setCatalogs(config.catalogs);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Cannot load attribute catalogs.";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function setDefault(catalog: AttributeCatalog) {
    setIsBusy(true);
    setBusyCatalogId(catalog.id);
    setBusyCatalogAction("default");
    setError("");
    setMessage("");
    try {
      const updated = await apiSend<AttributeCatalog>(
        "POST",
        `/admin/attribute-catalogs/${type}/${catalog.id}/default`,
      );
      setCatalogs((current) =>
        current.map((item) => ({ ...item, isDefault: item.id === updated.id })),
      );
      const message = "Default catalog updated.";
      setMessage(message);
      showToast({ type: "success", message });
    } catch (defaultError) {
      const message = defaultError instanceof Error ? defaultError.message : "Cannot set default catalog.";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setIsBusy(false);
      setBusyCatalogId("");
      setBusyCatalogAction(null);
    }
  }

  async function deleteCatalog(catalog: AttributeCatalog) {
    if (!window.confirm(`Delete catalog "${catalog.name}"?`)) {
      return;
    }
    setIsBusy(true);
    setBusyCatalogId(catalog.id);
    setBusyCatalogAction("delete");
    setError("");
    setMessage("");
    try {
      await apiSend<{ archived: boolean }>("DELETE", `/admin/attribute-catalogs/${type}/${catalog.id}`);
      setCatalogs((current) => current.filter((item) => item.id !== catalog.id));
      const message = "Catalog deleted.";
      setMessage(message);
      showToast({ type: "success", message });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Cannot delete catalog.";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setIsBusy(false);
      setBusyCatalogId("");
      setBusyCatalogAction(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <FeedbackToast toast={toast} onClose={clearToast} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <LinkButton href={catalogNewHref(type)} variant="primary" className="gap-2">
          <Plus size={16} /> New catalog
        </LinkButton>
      </div>

      {message ? (
        <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-md bg-muted p-4 text-sm text-muted-foreground">Loading catalogs...</div>
      ) : catalogs.length === 0 ? (
        <div className="mt-5 rounded-md bg-muted p-4 text-sm text-muted-foreground">No catalogs yet.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {catalogs.map((catalog) => (
            <div key={catalog.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{catalog.name}</span>
                    {catalog.isDefault ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Default
                      </span>
                    ) : null}
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      {catalog.attributes.length} attributes
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {catalog.description || "No description."}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <LinkButton href={catalogEditHref(type, catalog.id)} variant="secondary" className="gap-2">
                    <FileText size={15} /> Edit
                  </LinkButton>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    disabled={catalog.isDefault || isBusy}
                    onClick={() => void setDefault(catalog)}
                  >
                    {busyCatalogId === catalog.id && busyCatalogAction === "default" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Star size={15} />
                    )}
                    Set default
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    disabled={catalog.isDefault || isBusy}
                    onClick={() => void deleteCatalog(catalog)}
                  >
                    {busyCatalogId === catalog.id && busyCatalogAction === "delete" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AttributeCatalogEditor({ type, title, description, catalogId }: AttributeCatalogEditorProps) {
  const router = useRouter();
  const { clearToast, showToast, toast } = useFeedbackToast();
  const isNewCatalog = !catalogId;
  const [selectedId, setSelectedId] = useState(catalogId ?? "");
  const [name, setName] = useState("");
  const [catalogDescription, setCatalogDescription] = useState("");
  const [attributes, setAttributes] = useState<AttributeCatalogAttribute[]>(createEmptyAttributes);
  const [jsonText, setJsonText] = useState(formatCatalogJson(createEmptyAttributes()));
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [rawRequest, setRawRequest] = useState<unknown>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"generate" | "save" | null>(null);
  const [debugDialog, setDebugDialog] = useState<AiDebugDialogData | null>(null);

  const pageTitle = useMemo(() => {
    return isNewCatalog ? `New ${typeLabel[type]} Attribute catalog` : `Edit ${typeLabel[type]} Attribute catalog`;
  }, [isNewCatalog, type]);

  function syncAttributes(nextAttributes: AttributeCatalogAttribute[]) {
    setAttributes(nextAttributes);
    setJsonText(formatCatalogJson(nextAttributes));
    setIsEditingJson(false);
  }

  function openCatalog(catalog: AttributeCatalog) {
    setSelectedId(catalog.id);
    setName(catalog.name);
    setCatalogDescription(catalog.description ?? "");
    syncAttributes(catalog.attributes);
    setMessage("");
    setError("");
  }

  function resetNewCatalog() {
    const nextAttributes = createEmptyAttributes();
    setSelectedId("");
    setName(`${typeLabel[type]} Attribute Catalog`);
    setCatalogDescription("");
    syncAttributes(nextAttributes);
    setRawRequest(null);
    setRawResponse(null);
    setMessage("");
    setError("");
  }

  async function loadData() {
    setIsLoading(true);
    setError("");
    try {
      const prompt = await apiGet<AttributePrompt>(`/admin/attribute-generation-prompts/${type}`);
      setGenerationPrompt(prompt.content);
      if (catalogId) {
        const catalog = await apiGet<AttributeCatalog>(`/admin/attribute-catalogs/${type}/${catalogId}`);
        openCatalog(catalog);
      } else {
        resetNewCatalog();
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Cannot load attribute catalog.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setSelectedId(catalogId ?? "");
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, catalogId]);

  function updateAttribute(attributeId: string, patch: Partial<AttributeCatalogAttribute>) {
    syncAttributes(
      attributes.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, ...patch } : attribute,
      ),
    );
  }

  function updateOption(
    attributeId: string,
    optionId: string,
    patch: Partial<AttributeCatalogAttribute["options"][number]>,
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
    const next = attributes.filter((attribute) => attribute.id !== attributeId);
    syncAttributes(next.length > 0 ? next : createEmptyAttributes());
  }

  function addOption(attributeId: string) {
    syncAttributes(
      attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: [...attribute.options, { id: makeId("option"), name: "", description: "" }],
            }
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
      const parsed = parseCatalogJson(jsonText);
      syncAttributes(parsed);
      const message = "JSON applied.";
      setMessage(message);
      setError("");
      showToast({ type: "success", message });
    } catch (jsonError) {
      const message = jsonError instanceof Error ? jsonError.message : "Invalid JSON.";
      setMessage("");
      setError(message);
      showToast({ type: "error", message });
    }
  }

  function updateJsonText(nextJsonText: string) {
    setJsonText(nextJsonText);
    setIsEditingJson(true);
    try {
      setAttributes(parseCatalogJsonDraft(nextJsonText));
    } catch {
      // Keep the visual editor unchanged while the admin is typing incomplete JSON.
    }
  }

  async function saveCatalog() {
    setIsBusy(true);
    setBusyAction("save");
    setMessage("");
    setError("");
    try {
      const attributesToSave = isEditingJson ? parseCatalogJson(jsonText) : attributes;
      if (!name.trim()) {
        throw new Error("Catalog name is required.");
      }
      if (!generationPrompt.trim()) {
        throw new Error("Attribute Generation Prompt is required.");
      }
      await apiSend<AttributePrompt>("PATCH", `/admin/attribute-generation-prompts/${type}`, {
        content: generationPrompt.trim(),
      });
      const body = {
        type,
        name: name.trim(),
        description: catalogDescription.trim() || undefined,
        attributes: attributesToSave,
      };
      const saved = selectedId
        ? await apiSend<AttributeCatalog>("PATCH", `/admin/attribute-catalogs/${type}/${selectedId}`, body)
        : await apiSend<AttributeCatalog>("POST", "/admin/attribute-catalogs", body);
      const message = "Catalog saved.";
      setMessage(message);
      showToast({ type: "success", message });
      openCatalog(saved);
      if (!selectedId || selectedId !== saved.id) {
        router.replace(catalogEditHref(type, saved.id));
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Cannot save catalog.";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  async function generateAttributes() {
    setIsBusy(true);
    setBusyAction("generate");
    setMessage("");
    setError("");
    try {
      if (!generationPrompt.trim()) {
        throw new Error("Attribute Generation Prompt is required.");
      }
      const result = await apiSend<GenerateResult>("POST", `/admin/attribute-catalogs/${type}/generate`, {
        inputText: sourceText,
        prompt: generationPrompt,
      });
      syncAttributes(result.attributes);
      setRawRequest(result.rawRequest);
      setRawResponse(result.rawResponse);
      const message = "Attributes generated.";
      setMessage(message);
      showToast({ type: "success", message });
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "Cannot generate attributes.";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  function renderSaveButton() {
    return (
      <Button type="button" className="gap-2" disabled={isBusy || isLoading} onClick={() => void saveCatalog()}>
        {busyAction === "save" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save
      </Button>
    );
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <FeedbackToast toast={toast} onClose={clearToast} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{pageTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {renderSaveButton()}
            <LinkButton href={catalogListHref(type)} variant="secondary" className="gap-2">
              <ArrowLeft size={16} /> Back to list
            </LinkButton>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-5 rounded-md bg-muted p-4 text-sm text-muted-foreground">Loading catalog...</div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block min-w-0 text-sm font-medium text-foreground">
                Catalog name
                <input
                  className={`${inputClass} mt-1`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block min-w-0 text-sm font-medium text-foreground">
                Description
                <input
                  className={`${inputClass} mt-1`}
                  value={catalogDescription}
                  onChange={(event) => setCatalogDescription(event.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 rounded-md border border-sky-100 bg-sky-50/70 p-4">
              <label className="block text-sm font-semibold text-foreground" htmlFor={`${type}-attribute-prompt`}>
                Attribute Generation Prompt
              </label>
              <p className="mt-1 text-sm text-sky-700">
                Use {"{inputText}"} and {"{attributeJsonFormat}"} when the prompt needs runtime data. No hidden context is appended.
              </p>
              <TextareaWithCounter
                id={`${type}-attribute-prompt`}
                className="mt-3 min-h-56 font-mono text-sm"
                value={generationPrompt}
                onChange={(event) => setGenerationPrompt(event.target.value)}
                placeholder={`Create ${typeLabel[type]} attributes as JSON.\n\nSource:\n{inputText}\n\nFormat:\n{attributeJsonFormat}`}
                placeholderSuggestions={[
                  { token: "{inputText}", description: "Source text for attribute generation." },
                  { token: "{attributeJsonFormat}", description: "Required JSON format for attribute catalog output." },
                ]}
              />
            </div>

            <label className="mt-5 block text-sm font-medium text-foreground" htmlFor={`${type}-attribute-source`}>
              Source text for AI generation
              <TextareaWithCounter
                id={`${type}-attribute-source`}
                className="mt-1 min-h-36 text-sm"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={`Describe the ${typeLabel[type].toLowerCase()} attributes you want AI to create.`}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" className="gap-2" disabled={isBusy} onClick={() => void generateAttributes()}>
                {busyAction === "generate" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Generate attributes
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() =>
                  setDebugDialog({
                    title: `${typeLabel[type]} Attribute prompt`,
                    help: "Exact prompt after replacing placeholders present in the Attribute Generation Prompt.",
                    value: buildPromptPreview(generationPrompt, sourceText, type),
                  })
                }
              >
                <FileText size={15} /> Prompt
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!rawRequest}
                onClick={() =>
                  setDebugDialog({
                    title: "Raw attribute request",
                    help: "Redacted provider request from the latest generation.",
                    value: rawRequest,
                  })
                }
              >
                Request
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!rawResponse}
                onClick={() =>
                  setDebugDialog({
                    title: "Raw attribute response",
                    help: "Provider response from the latest generation.",
                    value: rawResponse,
                  })
                }
              >
                Response
              </Button>
              <Button type="button" variant="secondary" className="gap-2" disabled={isBusy} onClick={applyJson}>
                <Check size={16} /> Apply JSON
              </Button>
            </div>

            <label className="mt-5 block text-sm font-semibold text-foreground" htmlFor={`${type}-catalog-json`}>
              Attribute JSON
              <TextareaWithCounter
                id={`${type}-catalog-json`}
                className="mt-2 min-h-80 font-mono text-xs"
                value={jsonText}
                onChange={(event) => updateJsonText(event.target.value)}
              />
            </label>

            <div className="mt-5 space-y-4">
              {attributes.map((attribute, attributeIndex) => (
                <div key={`attribute-${attributeIndex}`} className="rounded-md border border-border p-4">
                  <div className="grid gap-3 md:grid-cols-[2rem_minmax(0,1fr)_auto]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-700">
                      {attributeIndex + 1}
                    </div>
                    <div className="grid min-w-0 items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <input
                        className={inputClass}
                        value={attribute.name}
                        placeholder="Attribute name"
                        onChange={(event) =>
                          updateAttribute(attribute.id, {
                            name: event.target.value,
                            id: normalizeId(event.target.value, attribute.id),
                          })
                        }
                      />
                      <input
                        className={inputClass}
                        value={attribute.description ?? ""}
                        placeholder="Attribute description"
                        onChange={(event) => updateAttribute(attribute.id, { description: event.target.value })}
                      />
                      <label className="flex h-10 items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={attribute.required}
                          onChange={(event) => updateAttribute(attribute.id, { required: event.target.checked })}
                        />
                        Require
                      </label>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeAttribute(attribute.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {attribute.options.map((option, optionIndex) => (
                      <div
                        key={`option-${attributeIndex}-${optionIndex}`}
                        className="grid items-start gap-3 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <div className="rounded-md bg-muted px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                          {attributeIndex + 1}.{optionIndex + 1}
                        </div>
                        <input
                          className={inputClass}
                          value={option.name}
                          placeholder="Option name"
                          onChange={(event) =>
                            updateOption(attribute.id, option.id, {
                              name: event.target.value,
                              id: `${attribute.id}-${normalizeId(event.target.value, option.id)}`,
                            })
                          }
                        />
                        <input
                          className={inputClass}
                          value={option.description ?? ""}
                          placeholder="Option description"
                          onChange={(event) => updateOption(attribute.id, option.id, { description: event.target.value })}
                        />
                        <Button type="button" variant="ghost" onClick={() => removeOption(attribute.id, option.id)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" className="gap-2" onClick={() => addOption(attribute.id)}>
                      <Plus size={15} /> Add option
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="secondary" className="gap-2" onClick={addAttribute}>
                <Plus size={16} /> Add attribute
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <LinkButton href={catalogNewHref(type)} variant="secondary">
                New catalog
              </LinkButton>
              {renderSaveButton()}
            </div>
          </>
        )}
      </section>
      <AiDebugDialog
        data={debugDialog}
        closeLabel="Close"
        onClose={() => setDebugDialog(null)}
      />
    </>
  );
}
