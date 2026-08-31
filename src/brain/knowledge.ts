/**
 * OrbitX agent training — distilled from audifyx/og-scan.
 * Full corpus: /Orbitx-ai-knowledge/
 * Runtime bundle: ./knowledgeBundle.ts
 */

export {
  ORBITX_TOKEN_MINT,
  ORBITX_HOST,
  ORBITX_TELEGRAM_GC,
  ORBITX_TELEGRAM_BOT,
  ORBITX_FAQ_CORE,
  buildAgentKnowledge,
  buildChatSystem,
} from "./knowledgeBundle";

import { buildAgentKnowledge, buildChatSystem, ORBITX_TOKEN_MINT } from "./knowledgeBundle";

export const CHAT_SYSTEM = buildChatSystem();

export const AGENT_KNOWLEDGE = buildAgentKnowledge();

export const AGENT_CAPABILITY_CHIPS = [
  "hey tell me about 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  "sell 50% 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  "buy 0.1 sol when mcap hits 100k 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  "claim my creator fees",
  "launch a coin named OrbitX ticker ORB",
  "what is OrbitX and who built it?",
] as const;
