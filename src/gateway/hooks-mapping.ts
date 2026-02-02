async function loadTransform(transform: HookMappingTransformResolved): Promise<HookTransformFn> {
  const cached = transformCache.get(transform.modulePath);
  if (cached) {
    return cached;
  }
  // Only allow importing modules from within the transforms directory for safety
  if (
    !path.resolve(transform.modulePath).startsWith(
      path.resolve(path.dirname(CONFIG_PATH)) + path.sep
    )
  ) {
    throw new Error("Dynamic import of transform modules is restricted");
  }
  const url = pathToFileURL(transform.modulePath).href;
  const mod = (await import(url)) as Record<string, unknown>;
  const fn = resolveTransformFn(mod, transform.exportName);
  transformCache.set(transform.modulePath, fn);
  return fn;
}
// 🔒 VOTAL.AI Security Fix: Dynamic import of configurable module path enables code execution [CWE-94] - CRITICAL