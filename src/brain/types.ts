export type ToolCategory =
  | "intelligence"
  | "trade"
  | "create"
  | "social"
  | "monitor"
  | "orbitx";

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
