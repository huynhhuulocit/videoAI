"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ApiError,
  type GenerateTemplateResult,
  type ShotPromptConfig,
  TemplateAttributeSchema,
  type TemplateAttribute,
  type TemplateOption,
  type VideoTemplate
} from "@videoai/contracts";
import { Eye, FileText, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/language-provider";
import { AiDebugDialog, type AiDebugDialogData } from "../ui/ai-debug-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { MasterPromptField } from "../ui/master-prompt-field";
import { TextareaWithCounter } from "../ui/textarea-with-counter";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";

type ApiSuccess<T> = {
  data: T;
};

type ApiFailure = {
  error?: ApiError;
  meta?: {
    requestId?: string;
  };
  message?: string | string[];
  statusCode?: number;
};

type TemplateDraft = {
  id?: string;
  name: string;
  description: string;
  idea: string;
  attributes: TemplateAttribute[];
};

const emptyDraft: TemplateDraft = {
  name: "",
  description: "",
  idea: "Create a video about a baby's happy day",
  attributes: []
};

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function escapeCompactToken(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/=/g, "\\=")
    .replace(/\|/g, "\\|");
}

function unescapeCompactToken(value: string) {
  let result = "";
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    result += character;
  }

  return result;
}

function splitUnescaped(value: string, separator: string) {
  const parts: string[] = [];
  let current = "";
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += `\\${character}`;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === separator) {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (escaped) {
    current += "\\";
  }

  parts.push(current);
  return parts;
}

function findUnescaped(value: string, target: string) {
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === target) {
      return index;
    }
  }

  return -1;
}

function normalizeIdentifier(value: string, fallback: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function humanizeCompactKey(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const vietnameseLabelMap: Record<string, string> = {
  "adventure": "Phiêu lưu",
  "anthropomorphic": "Nhân cách hóa",
  "baby-animal": "Động vật nhỏ",
  "cartoon-animation": "Hoạt hình",
  "chibi-style": "Phong cách chibi",
  "colorful": "Nhiều màu sắc",
  "cute-style": "Dễ thương",
  "fantasy": "Kỳ ảo",
  "fantasy-creature": "Sinh vật kỳ ảo",
  "joyful": "Vui tươi",
  "lush-forest": "Khu rừng xanh tươi",
  "magical-realm": "Vùng đất phép thuật",
  "main-character-type": "Kiểu nhân vật chính",
  "mood-tone": "Tông cảm xúc",
  "musical": "Có âm nhạc",
  "natural-habitat": "Môi trường sống tự nhiên",
  "preschoolers": "Trẻ mẫu giáo",
  "prehistoric-landscape": "Cảnh quan tiền sử",
  "slice-of-life": "Đời thường",
  "setting-environment": "Bối cảnh môi trường",
  "storytelling": "Kể chuyện",
  "target-audience": "Đối tượng khán giả",
  "toddlers": "Trẻ nhỏ",
  "video-genre": "Thể loại video",
  "visual-style": "Phong cách hình ảnh",
  "warmhearted": "Ấm áp",
  "young-children": "Trẻ em nhỏ",
  "families": "Gia đình"
};

const attributeExplanationMap: Record<string, string> = {
  "main-character-type":
    "Xác định kiểu nhân vật chính để AI giữ đúng đối tượng trung tâm của câu chuyện.",
  "mood-tone":
    "Định hướng cảm xúc tổng thể, nhịp kể và cách nhân vật thể hiện trong video.",
  "setting-environment":
    "Mô tả bối cảnh chính để AI dựng không gian, đạo cụ và môi trường phù hợp.",
  "target-audience":
    "Cho biết nhóm người xem mục tiêu để điều chỉnh mức độ dễ hiểu, hình ảnh và lời thoại.",
  "video-genre":
    "Xác định thể loại video để AI chọn cấu trúc kể chuyện và phong cách triển khai phù hợp.",
  "visual-style":
    "Định hướng phong cách hình ảnh, màu sắc và cảm giác thị giác của video."
};

const optionExplanationMap: Record<string, string> = {
  "adventure": "Dùng khi câu chuyện có hành trình khám phá, di chuyển hoặc trải nghiệm mới.",
  "baby-animal": "Dùng khi nhân vật chính là một con vật nhỏ, tạo cảm giác gần gũi và đáng yêu.",
  "cartoon-animation": "Dùng khi muốn hình ảnh theo hướng hoạt hình rõ ràng, dễ xem.",
  "cute-style": "Dùng khi muốn tổng thể mềm mại, thân thiện và phù hợp trẻ nhỏ.",
  "fantasy": "Dùng khi câu chuyện có yếu tố phép thuật, thế giới tưởng tượng hoặc sinh vật kỳ ảo.",
  "joyful": "Dùng khi muốn nhịp video vui vẻ, sáng sủa và nhiều năng lượng tích cực.",
  "lush-forest": "Dùng khi bối cảnh cần nhiều cây xanh, ánh sáng tự nhiên và cảm giác sinh động.",
  "musical": "Dùng khi nội dung có hát, nhịp điệu hoặc chuyển động theo âm nhạc.",
  "slice-of-life": "Dùng khi muốn kể khoảnh khắc đời thường, nhẹ nhàng và dễ đồng cảm.",
  "storytelling": "Dùng khi video cần mạch chuyện rõ ràng, có mở đầu, diễn biến và kết thúc.",
  "toddlers": "Dùng khi nội dung cần đơn giản, an toàn và dễ hiểu cho trẻ nhỏ.",
  "warmhearted": "Dùng khi muốn tạo cảm giác ấm áp, tích cực và giàu cảm xúc."
};

function lookupVietnameseLabel(value: string) {
  return vietnameseLabelMap[normalizeIdentifier(value, "")] ?? value;
}

function explainAttribute(attribute: TemplateAttribute) {
  return (
    attribute.description?.trim() ||
    attributeExplanationMap[normalizeIdentifier(attribute.id || attribute.name, "")] ||
    attributeExplanationMap[normalizeIdentifier(attribute.name, "")] ||
    "Giúp người dùng hiểu nhóm thuộc tính này và chọn option phù hợp trước khi tạo prompt."
  );
}

function explainOption(option: TemplateOption) {
  return (
    option.description?.trim() ||
    optionExplanationMap[normalizeIdentifier(option.value || option.label, "")] ||
    optionExplanationMap[normalizeIdentifier(option.label, "")] ||
    `Lựa chọn này định hướng AI theo sắc thái "${option.label}" trong prompt.`
  );
}

function extractTranslateDescription(
  value: string | undefined,
  fallbackTranslate: string,
  fallbackDescription: string
) {
  const lines = (value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const translateLine = lines.find((line) => /^(Translate|Vietnamese):/i.test(line));
  const descriptionLine = lines.find((line) => /^Description:/i.test(line));
  const structuredTranslate = translateLine?.replace(/^(Translate|Vietnamese):\s*/i, "").trim();
  const structuredDescription = descriptionLine?.replace(/^Description:\s*/i, "").trim();
  const plainDescription = lines.length > 0 && !translateLine && !descriptionLine ? lines.join("\n") : "";

  return {
    translate: structuredTranslate || fallbackTranslate,
    description: structuredDescription || plainDescription || fallbackDescription
  };
}

function descriptionFromTranslateAndDetail(translate: string, detail: string) {
  return [
    translate ? `Translate: ${translate}` : "",
    detail ? `Description: ${detail}` : ""
  ].filter(Boolean).join("\n");
}

function formatAttributeTranslateText(attributes: TemplateAttribute[]) {
  const payload = attributes.map((attribute) => {
    const attributeTranslate = extractTranslateDescription(
      attribute.description,
      lookupVietnameseLabel(attribute.name),
      explainAttribute(attribute)
    );

    return {
      attributeId: attribute.id,
      attributeName: attribute.name,
      translate: attributeTranslate.translate,
      description: attributeTranslate.description,
      options: attribute.options.map((option) => {
        const optionTranslate = extractTranslateDescription(
          option.description,
          lookupVietnameseLabel(option.label),
          explainOption(option)
        );

        return {
          optionId: option.id,
          optionLabel: option.label,
          translate: optionTranslate.translate,
          description: optionTranslate.description
        };
      })
    };
  });

  return JSON.stringify(payload, null, 2);
}

function splitDetailParts(value: string) {
  return splitUnescaped(value, "|")
    .map((part) => unescapeCompactToken(part.trim()))
    .filter(Boolean);
}

function joinDetailDescription(parts: string[]) {
  return parts.length > 0 ? parts.join(" - ") : undefined;
}

function descriptionFromVietnameseAndDetail(vietnamese: string, detail: string) {
  return descriptionFromTranslateAndDetail(vietnamese, detail);
}

function findMatchingAttribute(attributes: TemplateAttribute[], name: string) {
  const normalizedName = normalizeIdentifier(name, "");
  return attributes.find((attribute) =>
    [
      attribute.id,
      attribute.name,
      compactKeyFromAttribute(attribute)
    ].some((candidate) => normalizeIdentifier(candidate, "") === normalizedName)
  );
}

function findMatchingOption(options: TemplateOption[], name: string) {
  const normalizedName = normalizeIdentifier(name, "");
  return options.find((option) =>
    [option.id, option.label, option.value].some(
      (candidate) => normalizeIdentifier(candidate, "") === normalizedName
    )
  );
}

function parseAttributeNotesText(value: string, attributes: TemplateAttribute[]) {
  const blocks = value
    .split(/\n(?=\s*\d+\.\s+)/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return attributes;
  }

  return attributes.map((attribute) => {
    const block = blocks.find((candidate) => {
      const firstLine = candidate.split(/\r?\n/).find(Boolean) ?? "";
      const name = firstLine.replace(/^\s*\d+\.\s*/, "").trim();
      return findMatchingAttribute([attribute], name);
    });

    if (!block) {
      return attribute;
    }

    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const vietnameseLine = lines.find((line) => /^Vietnamese:/i.test(line));
    const descriptionLine = lines.find((line) => /^Description:/i.test(line));
    const vietnamese = vietnameseLine?.replace(/^Vietnamese:\s*/i, "").trim() ?? "";
    const description = descriptionLine?.replace(/^Description:\s*/i, "").trim() ?? "";
    const optionLines = lines.filter((line) => line.startsWith("-"));

    return {
      ...attribute,
      description:
        descriptionFromVietnameseAndDetail(vietnamese, description) ||
        attribute.description,
      options: attribute.options.map((option) => {
        const optionLine = optionLines.find((line) => {
          const optionName = line.replace(/^-\s*/, "").split(":")[0]?.trim() ?? "";
          return findMatchingOption([option], optionName);
        });

        if (!optionLine) {
          return option;
        }

        const detail = optionLine.replace(/^-\s*/, "").split(":").slice(1).join(":").trim();
        return {
          ...option,
          description: detail || option.description
        };
      })
    };
  });
}

function attributeDescriptionFingerprint(attributes: TemplateAttribute[]) {
  return JSON.stringify(
    attributes.map((attribute) => ({
      id: attribute.id,
      description: attribute.description ?? "",
      options: attribute.options.map((option) => ({
        id: option.id,
        description: option.description ?? ""
      }))
    }))
  );
}

function parseAttributeTranslateJson(value: string, attributes: TemplateAttribute[]) {
  const parsed = JSON.parse(value) as unknown;
  const root = toRecord(parsed);
  const input = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root.attributes)
      ? root.attributes
      : null;

  if (!input) {
    throw new Error("Invalid translate JSON.");
  }

  return attributes.map((attribute) => {
    const match = input
      .map(toRecord)
      .find((entry) => {
        const id = cleanString(entry.attributeId) || cleanString(entry.id);
        const name =
          cleanString(entry.attributeName) ||
          cleanString(entry.name) ||
          cleanString(entry.label);
        return (
          (id && id === attribute.id) ||
          (name && Boolean(findMatchingAttribute([attribute], name)))
        );
      });

    if (!match) {
      return attribute;
    }

    const translate =
      cleanString(match.translate) ||
      cleanString(match.vietnamese) ||
      cleanString(match.translation) ||
      cleanString(match.vi);
    const detail =
      cleanString(match.description) ||
      cleanString(match.explanation) ||
      cleanString(match.detail);
    const optionsInput = Array.isArray(match.options) ? match.options.map(toRecord) : [];

    return {
      ...attribute,
      description:
        descriptionFromTranslateAndDetail(translate, detail) ||
        attribute.description,
      options: attribute.options.map((option) => {
        const optionMatch = optionsInput.find((entry) => {
          const id = cleanString(entry.optionId) || cleanString(entry.id);
          const name =
            cleanString(entry.optionLabel) ||
            cleanString(entry.label) ||
            cleanString(entry.value);
          return (
            (id && id === option.id) ||
            (name && Boolean(findMatchingOption([option], name)))
          );
        });

        if (!optionMatch) {
          return option;
        }

        const optionTranslate =
          cleanString(optionMatch.translate) ||
          cleanString(optionMatch.vietnamese) ||
          cleanString(optionMatch.translation) ||
          cleanString(optionMatch.vi);
        const optionDetail =
          cleanString(optionMatch.description) ||
          cleanString(optionMatch.explanation) ||
          cleanString(optionMatch.detail);

        return {
          ...option,
          description:
            descriptionFromTranslateAndDetail(optionTranslate, optionDetail) ||
            option.description
        };
      })
    };
  });
}

function parseAttributeTranslateText(value: string, attributes: TemplateAttribute[]) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return attributes;
  }

  if (trimmedValue.startsWith("[") || trimmedValue.startsWith("{")) {
    return parseAttributeTranslateJson(trimmedValue, attributes);
  }

  return parseAttributeNotesText(trimmedValue, attributes);
}

function compactKeyFromAttribute(attribute: TemplateAttribute) {
  const source =
    attribute.id && !attribute.id.startsWith("attribute_")
      ? attribute.id
      : attribute.name;
  return source
    .replace(/[-_]+(.)/g, (_, character: string) => character.toUpperCase())
    .replace(/^\w/, (character) => character.toLowerCase())
    .replace(/\s+(.)/g, (_, character: string) => character.toUpperCase());
}

function formatAttributesText(attributes: TemplateAttribute[]) {
  return attributes
    .map((attribute) => {
      const options = attribute.options.map((option) => escapeCompactToken(option.label)).join(",");
      return `${escapeCompactToken(compactKeyFromAttribute(attribute))}=${options};`;
    })
    .join("\n");
}

function renderPromptTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
    template
  );
}

function getScenarioGenerationOutputContract() {
  return JSON.stringify(
    {
      name: "Reusable scenario name",
      description: "Short explanation of when this scenario should be used.",
      attributes: [
        {
          id: "video-purpose",
          name: "Video Purpose",
          description: "What the video should achieve.",
          options: [
            {
              id: "video-purpose-education",
              label: "Education",
              value: "Education",
              description: "Use when the video teaches or explains."
            }
          ]
        }
      ]
    },
    null,
    2
  );
}

const templateGenerationDebugKeyPrefix = "videoai:template-generation-debug:";

function saveTemplateGenerationDebug(templateId: string, rawRequest: unknown, rawResponse: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${templateGenerationDebugKeyPrefix}${templateId}`,
      JSON.stringify({ rawRequest, rawResponse })
    );
  } catch {
    // Raw debug data is helpful but not required for the saved scenario.
  }
}

function loadTemplateGenerationDebug(templateId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(`${templateGenerationDebugKeyPrefix}${templateId}`);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as { rawRequest?: unknown; rawResponse?: unknown };
  } catch {
    return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringifyDetailValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item(s)`;
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value).slice(0, 300);
    } catch {
      return "object";
    }
  }
  return "";
}

function formatApiFailure(payload: ApiFailure, status: number) {
  const error = payload.error;
  const details = toRecord(error?.details);
  const providerError = toRecord(details.providerError);
  const code = cleanString(error?.code);
  const message =
    cleanString(error?.message) ||
    (Array.isArray(payload.message) ? payload.message.map(String).join("\n") : cleanString(payload.message)) ||
    `API request failed with status ${status}`;
  const lines = [code ? `${code}: ${message}` : message];

  const provider = cleanString(details.provider);
  const model = cleanString(details.model);
  const env = cleanString(details.env);
  const responseStatus = stringifyDetailValue(details.status).trim();
  const requestId = cleanString(details.requestId) || cleanString(payload.meta?.requestId);
  const providerErrorCode = cleanString(providerError.code);
  const providerErrorType = cleanString(providerError.type);
  const providerErrorMessage = cleanString(providerError.message);

  if (provider) {
    lines.push(`Provider: ${provider}`);
  }
  if (model) {
    lines.push(`Model: ${model}`);
  }
  if (env) {
    lines.push(`Env fallback: ${env}`);
  }
  if (responseStatus) {
    lines.push(`HTTP status: ${responseStatus}`);
  }
  if (providerErrorMessage || providerErrorCode || providerErrorType) {
    lines.push(
      `Provider error: ${[providerErrorCode, providerErrorType, providerErrorMessage]
        .filter(Boolean)
        .join(" - ")}`
    );
  }
  if (Array.isArray(details.issues) && details.issues.length > 0) {
    const firstIssue = toRecord(details.issues[0]);
    const firstIssueMessage = cleanString(firstIssue.message) || "no issue preview";
    lines.push(`Schema issues: ${details.issues.length} item(s). First issue: ${firstIssueMessage}`);
  }
  if (requestId) {
    lines.push(`Request ID: ${requestId}`);
  }

  return Array.from(new Set(lines.filter(Boolean))).join("\n");
}

async function readResponseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as ApiFailure;
    if (payload && typeof payload === "object") {
      return formatApiFailure(payload, response.status);
    }
  } catch {
    // Fall back to the status line below.
  }

  return `API request failed with status ${response.status}`;
}

function parseAttributesJson(value: string): TemplateAttribute[] {
  const parsed = JSON.parse(value) as unknown;
  const root = toRecord(parsed);
  const attributesInput = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root.attributes)
      ? root.attributes
      : null;

  if (!attributesInput) {
    throw new Error("Invalid attributes JSON.");
  }

  const normalizedAttributes = attributesInput
    .map((attributeInput) => {
      const attribute = toRecord(attributeInput);
      const name = cleanString(attribute.name);
      const attributeVietnamese =
        cleanString(attribute.vietnamese) ||
        cleanString(attribute.vi) ||
        cleanString(attribute.translation);
      const attributeDetail =
        cleanString(attribute.description) ||
        cleanString(attribute.explanation) ||
        cleanString(attribute.detail);
      const optionsInput = Array.isArray(attribute.options) ? attribute.options : [];
      const options = optionsInput
        .map((optionInput) => {
          if (typeof optionInput === "string") {
            const label = optionInput.trim();
            return label ? optionFromLabel(label) : null;
          }

          const option = toRecord(optionInput);
          const label = cleanString(option.label) || cleanString(option.value);
          const optionVietnamese =
            cleanString(option.vietnamese) ||
            cleanString(option.vi) ||
            cleanString(option.translation);
          const optionDetail =
            cleanString(option.description) ||
            cleanString(option.explanation) ||
            cleanString(option.detail);
          if (!label) {
            return null;
          }

          return {
            id: cleanString(option.id) || makeId("option"),
            label,
            value: cleanString(option.value) || label,
            description:
              descriptionFromVietnameseAndDetail(optionVietnamese, optionDetail) ||
              undefined
          };
        })
        .filter((option): option is TemplateOption => Boolean(option));

      if (!name || options.length === 0) {
        return null;
      }

      return {
        id: cleanString(attribute.id) || makeId("attribute"),
        name,
        description:
          descriptionFromVietnameseAndDetail(attributeVietnamese, attributeDetail) ||
          undefined,
        options
      };
    })
    .filter(Boolean);

  const validated = TemplateAttributeSchema.array().min(1).safeParse(normalizedAttributes);
  if (!validated.success) {
    throw new Error("Invalid attributes JSON.");
  }

  return validated.data;
}

function parseAttributesCompactText(value: string): TemplateAttribute[] {
  const normalizedAttributes = splitUnescaped(value, ";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, attributeIndex): TemplateAttribute | null => {
      const separatorIndex = findUnescaped(entry, "=");
      if (separatorIndex < 1) {
        return null;
      }

      const rawKeyParts = splitDetailParts(entry.slice(0, separatorIndex).trim());
      const rawKey = rawKeyParts[0] ?? "";
      const attributeDescription = joinDetailDescription(rawKeyParts.slice(1));
      const optionEntries = splitUnescaped(entry.slice(separatorIndex + 1), ",")
        .map((option) => splitDetailParts(option.trim()))
        .flatMap((parts) => {
          const label = parts[0];
          return label
            ? [{
                label,
                description: joinDetailDescription(parts.slice(1))
              }]
            : [];
        });

      if (!rawKey || optionEntries.length === 0) {
        return null;
      }

      const attributeId = normalizeIdentifier(rawKey, `attribute-${attributeIndex + 1}`);
      return {
        id: attributeId,
        name: humanizeCompactKey(rawKey),
        ...(attributeDescription ? { description: attributeDescription } : {}),
        options: optionEntries.map((optionEntry, optionIndex) => ({
          id: `${attributeId}-${normalizeIdentifier(optionEntry.label, `option-${optionIndex + 1}`)}`,
          label: optionEntry.label,
          value: optionEntry.label,
          ...(optionEntry.description ? { description: optionEntry.description } : {})
        }))
      };
    })
    .filter((attribute): attribute is TemplateAttribute => Boolean(attribute));

  const validated = TemplateAttributeSchema.array().min(1).safeParse(normalizedAttributes);
  if (!validated.success) {
    throw new Error("Invalid attributes text.");
  }

  return validated.data;
}

function parseAttributesText(value: string): TemplateAttribute[] {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error("Invalid attributes text.");
  }

  if (trimmedValue.startsWith("[") || trimmedValue.startsWith("{")) {
    return parseAttributesJson(trimmedValue);
  }

  return parseAttributesCompactText(trimmedValue);
}

function optionFromLabel(label: string): TemplateOption {
  return {
    id: makeId("option"),
    label,
    value: label
  };
}

function templateToDraft(template: VideoTemplate): TemplateDraft {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    idea: template.idea ?? "",
    attributes: template.attributes
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    headers: { "x-request-id": `web-${Date.now()}` }
  });
  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response));
  }
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

async function apiSend<T>(method: "POST" | "PATCH", path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-request-id": `web-${Date.now()}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response));
  }
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method: "DELETE",
    headers: { "x-request-id": `web-${Date.now()}` }
  });
  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response));
  }
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

type TemplateManagerProps = {
  mode?: "manage" | "create" | "edit";
  templateId?: string;
};

export function TemplateManager({ mode = "manage", templateId }: TemplateManagerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [attributesText, setAttributesText] = useState(formatAttributesText(emptyDraft.attributes));
  const [attributeTranslateText, setAttributeTranslateText] = useState(formatAttributeTranslateText(emptyDraft.attributes));
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [isEditingAttributeTranslate, setIsEditingAttributeTranslate] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [generationErrorMessage, setGenerationErrorMessage] = useState("");
  const [scenarioMasterPrompt, setScenarioMasterPrompt] = useState("");
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [rawTemplateRequest, setRawTemplateRequest] = useState<unknown>(null);
  const [rawTemplateResponse, setRawTemplateResponse] = useState<unknown>(null);
  const [debugDialog, setDebugDialog] = useState<AiDebugDialogData | null>(null);

  const hasDraftAttributes = draft.attributes.length > 0;
  const isCreateMode = mode === "create";
  const isEditMode = mode === "edit";

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        if (isCreateMode) {
          setTemplates([]);
          setDraft(emptyDraft);
          setAttributesText(formatAttributesText(emptyDraft.attributes));
          setAttributeTranslateText(formatAttributeTranslateText(emptyDraft.attributes));
          setIsEditingAttributeTranslate(false);
          setRawTemplateRequest(null);
          setRawTemplateResponse(null);
          return;
        }
        const loadedTemplates =
          isEditMode && templateId
            ? [await apiGet<VideoTemplate | null>(`/templates/${templateId}`)].filter(
                (template): template is VideoTemplate => Boolean(template),
              )
            : await apiGet<VideoTemplate[]>("/templates");
        if (!cancelled) {
          setTemplates(loadedTemplates);
          const firstTemplate = loadedTemplates[0];
          if (firstTemplate) {
            setDraft(templateToDraft(firstTemplate));
            const debug = loadTemplateGenerationDebug(firstTemplate.id);
            setRawTemplateRequest(debug?.rawRequest ?? null);
            setRawTemplateResponse(debug?.rawResponse ?? null);
          } else if (isEditMode) {
            setDraft(emptyDraft);
            setRawTemplateRequest(null);
            setRawTemplateResponse(null);
            setErrorMessage(t("template.notFound"));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : t("template.empty"));
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [isCreateMode, isEditMode, templateId, t]);

  useEffect(() => {
    if (!isEditingJson) {
      setAttributesText(formatAttributesText(draft.attributes));
    }
  }, [draft.attributes, isEditingJson]);

  useEffect(() => {
    if (!isEditingAttributeTranslate) {
      setAttributeTranslateText(formatAttributeTranslateText(draft.attributes));
    }
  }, [draft.attributes, isEditingAttributeTranslate]);

  useEffect(() => {
    let cancelled = false;

    async function loadScenarioMasterPrompt() {
      setIsPromptLoading(true);
      try {
        const config = await apiGet<ShotPromptConfig>("/admin/shot-prompt");
        if (!cancelled) {
          setScenarioMasterPrompt(
            config.scenarioAnalysisPrompt ||
              config.defaultScenarioAnalysisPrompt ||
              ""
          );
        }
      } catch (error) {
        if (!cancelled) {
          setGenerationErrorMessage(error instanceof Error ? error.message : t("template.masterPromptLoadFailed"));
        }
      } finally {
        if (!cancelled) {
          setIsPromptLoading(false);
        }
      }
    }

    void loadScenarioMasterPrompt();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const attributeCount = useMemo(
    () => draft.attributes.reduce((total, attribute) => total + attribute.options.length, 0),
    [draft.attributes]
  );

  function buildScenarioGenerationFullPrompt() {
    const idea = draft.idea.trim();
    const masterPrompt = scenarioMasterPrompt.trim();
    if (!idea || !masterPrompt) {
      return null;
    }

    const outputContract = getScenarioGenerationOutputContract();
    const renderedPrompt = renderPromptTemplate(masterPrompt, {
      story: idea,
      attributes: outputContract
    });

    return [
      renderedPrompt,
      "",
      "Runtime context:",
      "Task: Create a reusable Scenario template for VideoAI from the user's video idea.",
      "Do not select options from an existing catalog. Create a useful new catalog of attributes and options.",
      "The Scenario will later be used to guide script analysis, shot generation, and prompt composition.",
      "",
      "User video idea:",
      idea,
      "",
      "Output rules:",
      "- Return only strict JSON. Do not include markdown, comments, or prose outside JSON.",
      "- Include 3 to 8 attributes. Each attribute should include 2 to 6 practical options.",
      "- Keep attribute names short and reusable across similar videos.",
      "- Use human-readable labels and stable kebab-case ids.",
      "- The response must be original to the user's idea. Do not return placeholder/sample data.",
      "",
      "Required JSON shape:",
      outputContract
    ].join("\n");
  }

  function renderDebugButton(
    label: string,
    title: string,
    help: string,
    value: unknown,
    icon: "prompt" | "raw",
    unavailableTitle = t("workspace.rawDataUnavailable")
  ) {
    const hasValue = value !== null && value !== undefined && value !== "";

    return (
      <Button
        type="button"
        variant="secondary"
        className="gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hasValue}
        title={hasValue ? title : unavailableTitle}
        onClick={() => {
          if (hasValue) {
            setDebugDialog({ title, help, value });
          }
        }}
      >
        {icon === "prompt" ? <FileText size={15} /> : <Eye size={15} />}
        {label}
      </Button>
    );
  }

  const isAttributeTranslateApplied = useMemo(() => {
    if (!attributeTranslateText.trim()) {
      return false;
    }

    try {
      const translatedAttributes = parseAttributeTranslateText(attributeTranslateText, draft.attributes);
      return attributeDescriptionFingerprint(translatedAttributes) === attributeDescriptionFingerprint(draft.attributes);
    } catch {
      return false;
    }
  }, [attributeTranslateText, draft.attributes]);

  function updateAttribute(attributeId: string, patch: Partial<TemplateAttribute>) {
    setIsEditingJson(false);
    setDraft((current) => ({
      ...current,
      attributes: current.attributes.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, ...patch } : attribute
      )
    }));
  }

  function updateOption(attributeId: string, optionId: string, label: string) {
    setIsEditingJson(false);
    setDraft((current) => ({
      ...current,
      attributes: current.attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: attribute.options.map((option) =>
                option.id === optionId ? { ...option, label, value: label } : option
              )
            }
          : attribute
      )
    }));
  }

  function addAttribute() {
    setIsEditingJson(false);
    setDraft((current) => ({
      ...current,
      attributes: [
        ...current.attributes,
        {
          id: makeId("attribute"),
          name: "",
          description: "",
          options: [optionFromLabel("")]
        }
      ]
    }));
  }

  function removeAttribute(attributeId: string) {
    setIsEditingJson(false);
    setDraft((current) => ({
      ...current,
      attributes: current.attributes.filter((attribute) => attribute.id !== attributeId)
    }));
  }

  function addOption(attributeId: string) {
    setIsEditingJson(false);
    setDraft((current) => ({
      ...current,
      attributes: current.attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: [...attribute.options, optionFromLabel("")]
            }
          : attribute
      )
    }));
  }

  function removeOption(attributeId: string, optionId: string) {
    setIsEditingJson(false);
    setDraft((current) => ({
      ...current,
      attributes: current.attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: attribute.options.filter((option) => option.id !== optionId)
            }
          : attribute
      )
    }));
  }

  function selectTemplate(template: VideoTemplate) {
    setDraft(templateToDraft(template));
    const debug = loadTemplateGenerationDebug(template.id);
    setRawTemplateRequest(debug?.rawRequest ?? null);
    setRawTemplateResponse(debug?.rawResponse ?? null);
    setIsEditingJson(false);
    setIsEditingAttributeTranslate(false);
    setStatus("");
    setErrorMessage("");
  }

  function applyAttributesJson() {
    try {
      const parsedAttributes = parseAttributesText(attributesText);
      setDraft((current) => ({ ...current, attributes: parsedAttributes }));
      setAttributesText(formatAttributesText(parsedAttributes));
      setIsEditingJson(false);
      setIsEditingAttributeTranslate(false);
      setErrorMessage("");
      setStatus(t("template.jsonApplied"));
    } catch {
      setStatus("");
      setErrorMessage(t("template.jsonInvalid"));
    }
  }

  function buildAttributeTranslate() {
    setAttributeTranslateText(formatAttributeTranslateText(draft.attributes));
    setIsEditingAttributeTranslate(true);
    setStatus(t("template.translateGenerated"));
    setErrorMessage("");
  }

  function applyAttributeTranslate() {
    try {
      const nextAttributes = parseAttributeTranslateText(attributeTranslateText, draft.attributes);
      setDraft((current) => ({ ...current, attributes: nextAttributes }));
      setAttributeTranslateText(formatAttributeTranslateText(nextAttributes));
      setIsEditingAttributeTranslate(false);
      setStatus(t("template.translateApplied"));
      setErrorMessage("");
    } catch {
      setStatus("");
      setErrorMessage(t("template.translateInvalid"));
    }
  }

  async function generateTemplate() {
    const idea = draft.idea.trim();
    if (!idea) {
      setGenerationErrorMessage(t("template.ideaPlaceholder"));
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");
    setGenerationErrorMessage("");
    setStatus("");
    setRawTemplateRequest(null);
    setRawTemplateResponse(null);
    setDebugDialog(null);

    try {
      const masterPrompt = scenarioMasterPrompt.trim();
      const generatedTemplate = await apiSend<GenerateTemplateResult>("POST", "/templates/generate", {
        idea,
        ...(masterPrompt ? { masterPrompt } : {})
      });
      const template: VideoTemplate = generatedTemplate;
      setRawTemplateRequest(generatedTemplate.rawRequest);
      setRawTemplateResponse(generatedTemplate.rawResponse);
      saveTemplateGenerationDebug(template.id, generatedTemplate.rawRequest, generatedTemplate.rawResponse);
      setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
      setDraft(templateToDraft(template));
      setIsEditingJson(false);
      setIsEditingAttributeTranslate(false);
      setStatus(t("template.saved"));
      if (isCreateMode || isEditMode) {
        router.replace(`/templates/${template.id}`);
      }
    } catch (error) {
      setGenerationErrorMessage(error instanceof Error ? error.message : t("workspace.generateFailed"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveTemplate() {
    let parsedAttributes: TemplateAttribute[];
    try {
      parsedAttributes = isEditingJson
        ? parseAttributesText(attributesText)
        : draft.attributes;
    } catch {
      setStatus("");
      setErrorMessage(t("template.jsonInvalid"));
      return;
    }

    try {
      if (attributeTranslateText.trim()) {
        parsedAttributes = parseAttributeTranslateText(attributeTranslateText, parsedAttributes);
      }
    } catch {
      setStatus("");
      setErrorMessage(t("template.translateInvalid"));
      return;
    }

    const normalizedAttributes = parsedAttributes
      .map((attribute) => ({
        ...attribute,
        name: attribute.name.trim(),
        description: attribute.description?.trim() || undefined,
        options: attribute.options
          .map((option) => ({
            ...option,
            label: option.label.trim(),
            value: option.value.trim() || option.label.trim()
          }))
          .filter((option) => option.label)
      }))
      .filter((attribute) => attribute.name && attribute.options.length > 0);

    if (!draft.name.trim() || normalizedAttributes.length === 0) {
      setErrorMessage(t("template.name"));
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        idea: draft.idea.trim() || undefined,
        attributes: normalizedAttributes
      };
      const isNewTemplate = !draft.id;
      const template = draft.id
        ? await apiSend<VideoTemplate>("PATCH", `/templates/${draft.id}`, body)
        : await apiSend<VideoTemplate>("POST", "/templates", body);

      setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
      setDraft(templateToDraft(template));
      setAttributesText(formatAttributesText(template.attributes));
      setIsEditingJson(false);
      setAttributeTranslateText(formatAttributeTranslateText(template.attributes));
      setIsEditingAttributeTranslate(false);
      setStatus(t("template.saved"));
      if (isNewTemplate) {
        router.replace(`/templates/${template.id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("template.empty"));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTemplate(templateId: string) {
    setDeletingTemplateId(templateId);
    setStatus("");
    setErrorMessage("");

    try {
      await apiDelete<{ deleted: boolean }>(`/templates/${templateId}`);
      const remainingTemplates = templates.filter((template) => template.id !== templateId);
      setTemplates(remainingTemplates);
      if (draft.id === templateId) {
        const nextTemplate = remainingTemplates[0];
        setDraft(nextTemplate ? templateToDraft(nextTemplate) : emptyDraft);
        setIsEditingJson(false);
        setIsEditingAttributeTranslate(false);
      }
      setStatus(t("template.deleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("template.deleteFailed"));
    } finally {
      setDeletingTemplateId("");
    }
  }

  return (
    <>
    <div className={isCreateMode || isEditMode ? "grid gap-5" : "grid gap-5 xl:grid-cols-[0.95fr_1.05fr]"}>
      <div className="grid gap-5">
        <Card title={t("template.aiBuilder")} action={<Badge variant="info">{attributeCount} options</Badge>}>
          <MasterPromptField
            id="scenarioMasterPrompt"
            label={t("template.scenarioMasterPrompt")}
            help={t("template.scenarioMasterPromptHelp")}
            rows={8}
            value={scenarioMasterPrompt}
            onChange={(event) => {
              setScenarioMasterPrompt(event.target.value);
              setRawTemplateRequest(null);
              setRawTemplateResponse(null);
            }}
            placeholder={t("template.scenarioMasterPromptPlaceholder")}
            disabled={isPromptLoading}
            className="resize-y disabled:cursor-not-allowed"
          />
          <label className="mt-4 block text-sm font-medium" htmlFor="templateIdea">
            {t("template.idea")}
          </label>
          <TextareaWithCounter
            id="templateIdea"
            rows={4}
            value={draft.idea}
            onChange={(event) => {
              setDraft((current) => ({ ...current, idea: event.target.value }));
              setRawTemplateRequest(null);
              setRawTemplateResponse(null);
            }}
            placeholder={t("template.ideaPlaceholder")}
            className="mt-2 w-full rounded-md border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              type="button"
              className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isGenerating}
              onClick={() => void generateTemplate()}
            >
              <Sparkles size={16} />
              {isGenerating ? t("template.generating") : t("template.generate")}
            </Button>
            {renderDebugButton(
              t("workspace.fullPromptButton"),
              t("template.generationFullPrompt"),
              t("template.generationFullPromptHelp"),
              buildScenarioGenerationFullPrompt(),
              "prompt",
              t("workspace.fullPromptUnavailable")
            )}
            {renderDebugButton(
              t("workspace.rawRequestButton"),
              t("template.generationRawRequest"),
              t("template.generationRawRequestHelp"),
              rawTemplateRequest,
              "raw"
            )}
            {renderDebugButton(
              t("workspace.rawResponseButton"),
              t("template.generationRawResponse"),
              t("template.generationRawResponseHelp"),
              rawTemplateResponse,
              "raw"
            )}
          </div>
          {generationErrorMessage ? (
            <div className="mt-3 whitespace-pre-line rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {generationErrorMessage}
            </div>
          ) : null}
        </Card>

        {!isCreateMode && !isEditMode ? (
        <Card title={t("template.list")}>
          {templates.length === 0 ? (
            <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
              {t("template.empty")}
            </div>
          ) : (
            <div className="grid gap-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-md border p-3 transition ${
                    draft.id === template.id ? "border-sky-300 bg-sky-50" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectTemplate(template)}>
                      <div className="font-medium">{template.name}</div>
                      {template.description ? (
                        <div className="mt-1 text-sm text-muted-foreground">{template.description}</div>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="success">{template.attributes.length} attributes</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 px-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={deletingTemplateId === template.id}
                        onClick={() => void deleteTemplate(template.id)}
                        aria-label={t("template.delete")}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        ) : null}
      </div>

      <Card
        title={isEditMode ? t("template.editTitle") : t("template.builder")}
        action={status ? <Badge variant="success">{status}</Badge> : null}
      >
        {errorMessage ? (
          <div className="mb-4 whitespace-pre-line rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium">
            {t("template.name")}
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="text-sm font-medium">
            {t("template.descriptionField")}
            <input
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <label className="text-sm font-medium" htmlFor="templateAttributesJson">
              {t("template.jsonEditor")}
            </label>
            <p className="mt-1 text-sm text-muted-foreground">{t("template.jsonHelp")}</p>
            <TextareaWithCounter
              id="templateAttributesJson"
              value={attributesText}
              onChange={(event) => {
                setAttributesText(event.target.value);
                setIsEditingJson(true);
                setStatus("");
                setErrorMessage("");
              }}
              spellCheck={false}
              className="mt-3 min-h-72 w-full resize-y rounded-md border border-border bg-white p-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-sky-200"
            />
            <Button type="button" variant="secondary" className="mt-3 gap-2" onClick={applyAttributesJson}>
              <Sparkles size={15} />
              {t("template.jsonApply")}
            </Button>
          </div>

          <div className="rounded-md border border-sky-100 bg-sky-50/70 p-3">
            <label className="text-sm font-medium text-sky-950" htmlFor="templateAttributeNotes">
              {t("template.translateEditor")}
            </label>
            <p className="mt-1 text-sm text-sky-800/80">{t("template.translateHelp")}</p>
            <TextareaWithCounter
              id="templateAttributeNotes"
              value={attributeTranslateText}
              onChange={(event) => {
                setAttributeTranslateText(event.target.value);
                setIsEditingAttributeTranslate(true);
                setStatus("");
                setErrorMessage("");
              }}
              spellCheck={false}
              className="mt-3 min-h-52 w-full resize-y rounded-md border border-sky-200 bg-white/95 p-3 text-xs leading-5 outline-none focus:ring-2 focus:ring-sky-200"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={buildAttributeTranslate}
              >
                <Sparkles size={15} />
                {t("template.translateGenerate")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled={isAttributeTranslateApplied || !attributeTranslateText.trim()}
                title={isAttributeTranslateApplied ? t("template.translateAlreadyApplied") : undefined}
                onClick={applyAttributeTranslate}
              >
                <Save size={15} />
                {isAttributeTranslateApplied
                  ? t("template.translateAlreadyApplied")
                  : t("template.translateApply")}
              </Button>
            </div>
          </div>

          {draft.attributes.map((attribute, attributeIndex) => (
            <div key={attribute.id} className="rounded-md border border-border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
                  {attributeIndex + 1}
                </span>
                <input
                  value={attribute.name}
                  onChange={(event) => updateAttribute(attribute.id, { name: event.target.value })}
                  placeholder={t("template.attributeName")}
                  className="h-10 min-w-0 flex-1 rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                />
                <Button type="button" variant="ghost" className="gap-2" onClick={() => removeAttribute(attribute.id)}>
                  <Trash2 size={15} />
                </Button>
              </div>
              {attribute.description ? (
                <p className="mt-2 whitespace-pre-wrap rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
                  {attribute.description}
                </p>
              ) : null}

              <div className="mt-3 grid gap-2">
                {attribute.options.map((option, optionIndex) => (
                  <div key={option.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-2">
                    <span className="mt-1 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {attributeIndex + 1}.{optionIndex + 1}
                    </span>
                    <div className="min-w-0">
                      <input
                        value={option.label}
                        onChange={(event) => updateOption(attribute.id, option.id, event.target.value)}
                        placeholder={t("template.optionLabel")}
                        className="h-10 min-w-0 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                      />
                      {option.description ? (
                        <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-10 px-0"
                      onClick={() => removeOption(attribute.id, option.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" className="w-fit gap-2" onClick={() => addOption(attribute.id)}>
                  <Plus size={15} />
                  {t("template.addOption")}
                </Button>
              </div>
            </div>
          ))}

          {!hasDraftAttributes ? (
            <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
              {t("template.empty")}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" className="gap-2" onClick={addAttribute}>
            <Plus size={16} />
            {t("template.addAttribute")}
          </Button>
          <Button
            type="button"
            className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={() => void saveTemplate()}
          >
            <Save size={16} />
            {isSaving ? t("template.saving") : t("template.save")}
          </Button>
        </div>
      </Card>
    </div>
    <AiDebugDialog
      data={debugDialog}
      closeLabel={t("workspace.rawDataClose")}
      onClose={() => setDebugDialog(null)}
    />
    </>
  );
}
