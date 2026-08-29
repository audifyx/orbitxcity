import type { ModelDefinition } from "./types";

export type OrbitXModelId =
  | "orbitx-fast"
  | "orbitx-balanced"
  | "orbitx-deep"
  | "orbitx-reason"
  | "orbitx-vision";

export const MODELS: readonly ModelDefinition[] = [
  {
    id: "orbitx-fast",
    label: "Fast",
    description:
      "Low-latency responses for quick lookups, alerts, and lightweight analysis.",
    latency: "low",
    capabilities: ["fast", "balanced"],
  },
  {
    id: "orbitx-balanced",
    label: "Balanced",
    description:
      "Default model balancing speed and depth for everyday intelligence and trading prep.",
    latency: "medium",
    capabilities: ["balanced"],
    default: true,
  },
  {
    id: "orbitx-deep",
    label: "Deep Research",
    description:
      "Extended reasoning for multi-source research, due diligence, and report synthesis.",
    latency: "high",
    capabilities: ["deep", "balanced"],
  },
  {
    id: "orbitx-reason",
    label: "Reasoning",
    description:
      "Step-by-step logic for strategy design, risk assessment, and complex decision trees.",
    latency: "high",
    capabilities: ["reasoning", "deep"],
  },
  {
    id: "orbitx-vision",
    label: "Vision",
    description:
      "Chart, screenshot, and visual token analysis with multimodal understanding.",
    latency: "medium",
    capabilities: ["vision", "multimodal"],
  },
] as const;

export const DEFAULT_MODEL_ID: OrbitXModelId = "orbitx-balanced";
export const defaultModel = DEFAULT_MODEL_ID;

export function getModel(id: string): ModelDefinition | undefined {
  return MODELS.find((m) => m.id === id);
}

export function resolveModelId(id?: string): OrbitXModelId {
  if (id && MODELS.some((m) => m.id === id)) {
    return id as OrbitXModelId;
  }
  return DEFAULT_MODEL_ID;
}
