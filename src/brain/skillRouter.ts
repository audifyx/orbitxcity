import { AGENT_SKILLS, type AgentSkill } from "./skillCatalog";
import type { PlanIntent } from "./types";

export type SkillMatch = {
  skill: AgentSkill;
  score: number;
};

function patternMatches(text: string, pattern: string): boolean {
  const lower = text.toLowerCase();
  const needle = pattern.toLowerCase();
  if (pattern.startsWith("^") || pattern.includes("\\b") || pattern.includes("\\$")) {
    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return lower.includes(needle.replace(/\\b/g, "").replace(/\\/g, ""));
    }
  }
  return lower.includes(needle);
}

export function matchSkills(text: string, limit = 8): SkillMatch[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const scored: SkillMatch[] = [];

  for (const skill of AGENT_SKILLS) {
    let score = 0;
    for (const pattern of skill.patterns) {
      if (patternMatches(trimmed, pattern)) {
        const weight = pattern.length >= 12 ? 3 : pattern.length >= 6 ? 2 : 1;
        score += weight;
      }
    }
    if (score > 0) {
      score += skill.priority / 100;
      scored.push({ skill, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type SkillRoute = {
  toolIds: string[];
  agentIds: string[];
  intent?: PlanIntent;
  notes: string[];
  matchedSkills: string[];
};

export function routeFromSkills(text: string): SkillRoute {
  const matches = matchSkills(text, 6);
  if (matches.length === 0) {
    return { toolIds: [], agentIds: [], notes: [], matchedSkills: [] };
  }

  const toolIds: string[] = [];
  const agentIds: string[] = [];
  const notes: string[] = [];
  const matchedSkills: string[] = [];
  let intent: PlanIntent | undefined;

  for (const { skill } of matches) {
    matchedSkills.push(skill.id);
    for (const toolId of skill.toolIds) {
      if (!toolIds.includes(toolId)) {
        toolIds.push(toolId);
      }
    }
    for (const agentId of skill.agentIds) {
      if (!agentIds.includes(agentId)) {
        agentIds.push(agentId);
      }
    }
    if (skill.intent && !intent) {
      intent = skill.intent;
    }
    if (skill.promptHint && !notes.includes(skill.promptHint)) {
      notes.push(skill.promptHint);
    }
  }

  notes.unshift(`Skills: ${matchedSkills.slice(0, 4).join(", ")}`);

  return { toolIds, agentIds, intent, notes, matchedSkills };
}

export function topSkillCategories(text: string): string[] {
  const matches = matchSkills(text, 12);
  const counts = new Map<string, number>();
  for (const { skill, score } of matches) {
    counts.set(skill.category, (counts.get(skill.category) ?? 0) + score);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
}
