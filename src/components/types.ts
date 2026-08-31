export type ToolEventStatus = "queued" | "running" | "ok" | "error";

export type ToolEvent = {
  id: string;
  toolId?: string;
  label: string;
  status: ToolEventStatus;
  detail?: string;
};

export type MessageCard = {
  kind: string;
  title: string;
  data: Record<string, string | number | boolean | undefined>;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  toolEvents?: ToolEvent[];
  cards?: MessageCard[];
};
