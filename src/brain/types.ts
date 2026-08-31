export type ToolCategory =
  | "intelligence"
  | "trade"
  | "create"
  | "social"
  | "monitor"
  | "orbitx"
  | "defi"
  | "wallet"
  | "knowledge";

export type ToolSide = "read" | "write";

export type ToolPermission = "none" | "confirm" | "limit";

export type ErrorBehavior = "return" | "throw";

export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  side: ToolSide;
  permission: ToolPermission;
  confirmationRequired: boolean;
  backend: string;
  timeoutMs: number;
  errorBehavior: ErrorBehavior;
  inputHint: string;
  outputHint: string;
};

export type AgentCategory =
  | "core"
  | "research"
  | "trade"
  | "security"
  | "social"
  | "monitor"
  | "create"
  | "system"
  | "specialist";

export type AgentPermission = "read" | "confirm" | "automate";

export type AgentMarketplace = "core" | "specialist";

export type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  tools: string[];
  permission: AgentPermission;
  systemRole: string;
  marketplace: AgentMarketplace;
};

export type PlanIntent =
  | "analyze_token"
  | "analyze_wallet"
  | "trade"
  | "alert"
  | "social"
  | "research"
  | "launch"
  | "nft"
  | "portfolio"
  | "screen"
  | "news"
  | "other";

export type UtterancePlan = {
  agentIds: string[];
  toolIds: string[];
  intent: PlanIntent;
  notes: string[];
};

export type ModelCapability =
  | "fast"
  | "balanced"
  | "deep"
  | "reasoning"
  | "vision"
  | "multimodal";

export type ModelLatency = "low" | "medium" | "high";

export type ModelDefinition = {
  id: string;
  label: string;
  description: string;
  latency: ModelLatency;
  capabilities: ModelCapability[];
  default?: boolean;
};

export type SkillCategory =
  | "trading"
  | "defi"
  | "intelligence"
  | "security"
  | "wallet"
  | "portfolio"
  | "social"
  | "create"
  | "monitor"
  | "knowledge"
  | "system";

/**
 * How a skill behaves at runtime:
 * - `knowledge`: pure explanation, no live tool calls
 * - `analysis`: reads live tools and synthesizes a read-only answer
 * - `action`: prepares a write (quote/preview) that the user must sign
 * - `automation`: runs within permission limits (alerts, pushes)
 */
export type SkillKind = "knowledge" | "analysis" | "action" | "automation";

export type SkillLevel = "core" | "advanced" | "expert";

export type SkillDefinition = {
  id: string;
  name: string;
  category: SkillCategory;
  kind: SkillKind;
  level: SkillLevel;
  summary: string;
  /** Real tool ids this skill orchestrates (may be empty for knowledge skills). */
  toolIds: string[];
  /** Owning specialist agent id, when the skill maps to one. */
  agentId?: string;
  /** Example phrases that should activate the skill. */
  triggers: string[];
  tags: string[];
};
