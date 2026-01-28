import type { PluginRuntime } from "../plugin-sdk/index.js";

let runtime: PluginRuntime | null = null;

export function setZoomRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getZoomRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Zoom runtime not initialized");
  }
  return runtime;
}
