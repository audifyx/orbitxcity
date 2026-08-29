export type ToolEventStatus = "queued" | "running" | "ok" | "error";

export type ToolEvent = {
  id: string;
  label: string;
  status: ToolEventStatus;
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
