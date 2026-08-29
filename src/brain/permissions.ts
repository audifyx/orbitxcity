import type { ToolDefinition } from "./types";

export type OrbitXPermissionMode =
  | "read_only"
  | "confirm_every_action"
  | "limited_automation";

export type PermissionState = {
  mode: OrbitXPermissionMode;
  /** User explicitly confirmed the pending action in UI */
  userConfirmed?: boolean;
  /** Allowed write tool ids when mode is limited_automation */
  automationAllowlist?: readonly string[];
};

export const DEFAULT_PERMISSIONS: PermissionState = {
  mode: "confirm_every_action",
  userConfirmed: false,
  automationAllowlist: ["alerts", "send-push"],
};

export type ToolAllowanceResult = {
  allowed: boolean;
  needsConfirm: boolean;
  reason: string;
};

export function assertToolAllowed(
  tool: ToolDefinition,
  perms: PermissionState,
): ToolAllowanceResult {
  if (tool.side === "read") {
    return {
      allowed: true,
      needsConfirm: false,
      reason: "Read tools are always allowed.",
    };
  }

  if (perms.mode === "read_only") {
    return {
      allowed: false,
      needsConfirm: false,
      reason: `Write tool '${tool.id}' blocked in read_only mode.`,
    };
  }

  if (perms.mode === "limited_automation") {
    const allowlist = perms.automationAllowlist ?? DEFAULT_PERMISSIONS.automationAllowlist ?? [];
    const onAllowlist = allowlist.includes(tool.id);

    if (tool.permission === "confirm" || tool.confirmationRequired) {
      if (perms.userConfirmed) {
        return {
          allowed: true,
          needsConfirm: false,
          reason: "User confirmed high-risk write action.",
        };
      }
      return {
        allowed: false,
        needsConfirm: true,
        reason: `Write tool '${tool.id}' requires explicit confirmation even in limited_automation.`,
      };
    }

    if (tool.permission === "limit" && onAllowlist) {
      return {
        allowed: true,
        needsConfirm: false,
        reason: `Write tool '${tool.id}' allowed via automation allowlist.`,
      };
    }

    if (tool.permission === "none" || tool.permission === "limit") {
      return {
        allowed: onAllowlist,
        needsConfirm: !onAllowlist,
        reason: onAllowlist
          ? `Write tool '${tool.id}' on automation allowlist.`
          : `Write tool '${tool.id}' not on automation allowlist.`,
      };
    }

    return {
      allowed: false,
      needsConfirm: true,
      reason: `Write tool '${tool.id}' not permitted under limited_automation.`,
    };
  }

  // confirm_every_action (default)
  if (tool.confirmationRequired || tool.permission === "confirm") {
    if (perms.userConfirmed) {
      return {
        allowed: true,
        needsConfirm: false,
        reason: "User confirmed action.",
      };
    }
    return {
      allowed: false,
      needsConfirm: true,
      reason: `Write tool '${tool.id}' requires user confirmation.`,
    };
  }

  if (tool.permission === "limit") {
    if (perms.userConfirmed) {
      return {
        allowed: true,
        needsConfirm: false,
        reason: "User confirmed limited write action.",
      };
    }
    return {
      allowed: false,
      needsConfirm: true,
      reason: `Write tool '${tool.id}' requires confirmation in confirm_every_action mode.`,
    };
  }

  return {
    allowed: false,
    needsConfirm: true,
    reason: `Write tool '${tool.id}' blocked until confirmed.`,
  };
}

export function isReadOnlyMode(perms: PermissionState): boolean {
  return perms.mode === "read_only";
}

export function canAutomate(perms: PermissionState): boolean {
  return perms.mode === "limited_automation";
}
