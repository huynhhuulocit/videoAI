import type { Provider } from "@videoai/contracts";

export type MediaReference = {
  fileId: string;
  type: "image" | "video";
  mimeType: string;
  sizeBytes: number;
};

export type PromptGenerationInput = {
  inputText: string;
  mediaReferences: MediaReference[];
};

export type PromptGenerationResult = {
  generatedPrompt: string;
  mediaInsights: string[];
  provider: Provider;
  model: string;
};

export type ProductAnalysisInput = {
  productUrl: string;
  mediaReferences: MediaReference[];
};

export type ProductAnalysisResult = {
  productFacts: string[];
  mediaInsights: string[];
  generatedPrompt: string;
  provider: Provider;
  model: string;
};

export type VideoGenerationInput = {
  finalPrompt: string;
  mediaReferences: MediaReference[];
};

export type VideoGenerationResult = {
  outputStorageKey: string;
  provider: Provider;
  model: string;
};

export interface PromptProvider {
  readonly provider: Provider;
  readonly model: string;
  generatePrompt(input: PromptGenerationInput): Promise<PromptGenerationResult>;
  analyzeProduct(input: ProductAnalysisInput): Promise<ProductAnalysisResult>;
}

export interface VideoProvider {
  readonly provider: Provider;
  readonly model: string;
  generateVideo(input: VideoGenerationInput): Promise<VideoGenerationResult>;
}
