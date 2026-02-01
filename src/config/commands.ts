import type { ChannelId } from "../channels/plugins/types.js";
import type { NativeCommandsSetting } from "./types.js";
import { normalizeChannelId } from "../channels/plugins/index.js";

function resolveAutoDefault(providerId?: ChannelId): boolean {
  const id = normalizeChannelId(providerId);
  if (!id) {
    return false;
  }
  if (id === "discord" || id === "telegram") {
    return true;
  }
  if (id === "slack") {
    return false;
  }
  return false;
}

export function resolveNativeSkillsEnabled(params: {
  providerId: ChannelId;
  providerSetting?: NativeCommandsSetting;
  globalSetting?: NativeCommandsSetting;
}): boolean {
  const { providerId, providerSetting, globalSetting } = params;
  const setting = providerSetting === undefined ? globalSetting : providerSetting;
  if (setting === true) {
    return true;
  }
  if (setting === false) {
    return false;
  }
  if (Array.isArray(setting)) {
    // When an explicit allowlist is provided for nativeSkills, enable if non-empty
    return setting.length > 0;
  }
  return resolveAutoDefault(providerId);
}

export function resolveNativeCommandsEnabled(params: {
  providerId: ChannelId;
  providerSetting?: NativeCommandsSetting;
  globalSetting?: NativeCommandsSetting;
}): boolean {
  const { providerId, providerSetting, globalSetting } = params;
  const setting = providerSetting === undefined ? globalSetting : providerSetting;
  if (setting === true) {
    return true;
  }
  if (setting === false) {
    return false;
  }
  if (Array.isArray(setting)) {
    return setting.length > 0;
  }
  // auto or undefined -> heuristic
  return resolveAutoDefault(providerId);
}

/**
 * Resolve the effective native commands setting, returning the string[] allowlist if one is set,
 * or null if all commands should be registered.
 */
export function resolveNativeCommandAllowlist(params: {
  providerSetting?: NativeCommandsSetting;
  globalSetting?: NativeCommandsSetting;
}): { set: Set<string>; order: string[] } | null {
  const { providerSetting, globalSetting } = params;
  const setting = providerSetting === undefined ? globalSetting : providerSetting;
  if (Array.isArray(setting)) {
    const order = setting.map((s) => s.toLowerCase());
    return { set: new Set(order), order };
  }
  return null;
}

/**
 * Resolve the effective native skills allowlist, or null if all skills should be registered.
 */
export function resolveNativeSkillAllowlist(params: {
  providerSetting?: NativeCommandsSetting;
  globalSetting?: NativeCommandsSetting;
}): Set<string> | null {
  const { providerSetting, globalSetting } = params;
  const setting = providerSetting === undefined ? globalSetting : providerSetting;
  if (Array.isArray(setting)) {
    return new Set(setting.map((s) => s.toLowerCase()));
  }
  return null;
}

export function isNativeCommandsExplicitlyDisabled(params: {
  providerSetting?: NativeCommandsSetting;
  globalSetting?: NativeCommandsSetting;
}): boolean {
  const { providerSetting, globalSetting } = params;
  if (providerSetting === false) {
    return true;
  }
  if (providerSetting === undefined) {
    return globalSetting === false;
  }
  return false;
}
