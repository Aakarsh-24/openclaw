export async function approveDevicePairing(
  requestId: string,
  baseDir?: string,
  user?: { isAdmin?: boolean }
): Promise<{ requestId: string; device: PairedDevice } | null> {
  if (!user?.isAdmin) throw new Error("Unauthorized");
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const pending = state.pendingById[requestId];
    if (!pending) {
      return null;
    }
    const now = Date.now();
    const existing = state.pairedByDeviceId[pending.deviceId];
    const roles = mergeRoles(existing?.roles, existing?.role, pending.roles, pending.role);
    const scopes = mergeScopes(existing?.scopes, pending.scopes);
    const tokens = existing?.tokens ? { ...existing.tokens } : {};
    const roleForToken = normalizeRole(pending.role);
    if (roleForToken) {
      const nextScopes = normalizeScopes(pending.scopes);
      const existingToken = tokens[roleForToken];
      tokens[roleForToken] = {
        token: newToken(),
        role: roleForToken,
        scopes: nextScopes,
        createdAtMs: existingToken?.createdAtMs ?? now,
        rotatedAtMs: existingToken ? now : undefined,
        revokedAtMs: undefined,
        lastUsedAtMs: existingToken?.lastUsedAtMs,
      };
    }
    const device: PairedDevice = {
      deviceId: pending.deviceId,
      publicKey: pending.publicKey,
      displayName: pending.displayName,
      platform: pending.platform,
      clientId: pending.clientId,
      clientMode: pending.clientMode,
      role: pending.role,
      roles,
      scopes,
      remoteIp: pending.remoteIp,
      tokens,
      createdAtMs: existing?.createdAtMs ?? now,
      approvedAtMs: now,
    };
    delete state.pendingById[requestId];
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, baseDir);
    return { requestId, device };
  });
}

export async function rejectDevicePairing(
  requestId: string,
  baseDir?: string,
  user?: { isAdmin?: boolean }
): Promise<{ requestId: string; deviceId: string } | null> {
  if (!user?.isAdmin) throw new Error("Unauthorized");
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const pending = state.pendingById[requestId];
    if (!pending) {
      return null;
    }
    delete state.pendingById[requestId];
    await persistState(state, baseDir);
    return { requestId, deviceId: pending.deviceId };
  });
}

export async function updatePairedDeviceMetadata(
  deviceId: string,
  patch: Partial<Omit<PairedDevice, "deviceId" | "createdAtMs" | "approvedAtMs">>,
  baseDir?: string,
  user?: { isAdmin?: boolean }
): Promise<void> {
  if (!user?.isAdmin) throw new Error("Unauthorized");
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const normalizedId = normalizeDeviceId(deviceId);
    const existing = state.pairedByDeviceId[normalizedId];
    if (!existing) {
      return;
    }
    const roles = mergeRoles(existing.roles, existing.role, patch.role);
    const scopes = mergeScopes(existing.scopes, patch.scopes);
    state.pairedByDeviceId[normalizedId] = {
      ...existing,
      ...patch,
      deviceId: existing.deviceId,
      createdAtMs: existing.createdAtMs,
      approvedAtMs: existing.approvedAtMs,
      role: patch.role ?? existing.role,
      roles,
      scopes,
    };
    await persistState(state, baseDir);
  });
}

export async function ensureDeviceToken(params: {
  deviceId: string;
  role: string;
  scopes: string[];
  baseDir?: string;
  user?: { isAdmin?: boolean }
}): Promise<DeviceAuthToken | null> {
  if (!params.user?.isAdmin) throw new Error("Unauthorized");
  return await withLock(async () => {
    const state = await loadState(params.baseDir);
    const device = state.pairedByDeviceId[normalizeDeviceId(params.deviceId)];
    if (!device) {
      return null;
    }
    const role = normalizeRole(params.role);
    if (!role) {
      return null;
    }
    const requestedScopes = normalizeScopes(params.scopes);
    const tokens = device.tokens ? { ...device.tokens } : {};
    const existing = tokens[role];
    if (existing && !existing.revokedAtMs) {
      if (scopesAllow(requestedScopes, existing.scopes)) {
        return existing;
      }
    }
    const now = Date.now();
    const next: DeviceAuthToken = {
      token: newToken(),
      role,
      scopes: requestedScopes,
      createdAtMs: existing?.createdAtMs ?? now,
      rotatedAtMs: existing ? now : undefined,
      revokedAtMs: undefined,
      lastUsedAtMs: existing?.lastUsedAtMs,
    };
    tokens[role] = next;
    device.tokens = tokens;
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, params.baseDir);
    return next;
  });
}

export async function rotateDeviceToken(params: {
  deviceId: string;
  role: string;
  scopes?: string[];
  baseDir?: string;
  user?: { isAdmin?: boolean }
}): Promise<DeviceAuthToken | null> {
  if (!params.user?.isAdmin) throw new Error("Unauthorized");
  return await withLock(async () => {
    const state = await loadState(params.baseDir);
    const device = state.pairedByDeviceId[normalizeDeviceId(params.deviceId)];
    if (!device) {
      return null;
    }
    const role = normalizeRole(params.role);
    if (!role) {
      return null;
    }
    const tokens = device.tokens ? { ...device.tokens } : {};
    const existing = tokens[role];
    const requestedScopes = normalizeScopes(params.scopes ?? existing?.scopes ?? device.scopes);
    const now = Date.now();
    const next: DeviceAuthToken = {
      token: newToken(),
      role,
      scopes: requestedScopes,
      createdAtMs: existing?.createdAtMs ?? now,
      rotatedAtMs: now,
      revokedAtMs: undefined,
      lastUsedAtMs: existing?.lastUsedAtMs,
    };
    tokens[role] = next;
    device.tokens = tokens;
    if (params.scopes !== undefined) {
      device.scopes = requestedScopes;
    }
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, params.baseDir);
    return next;
  });
}

export async function revokeDeviceToken(params: {
  deviceId: string;
  role: string;
  baseDir?: string;
  user?: { isAdmin?: boolean }
}): Promise<DeviceAuthToken | null> {
  if (!params.user?.isAdmin) throw new Error("Unauthorized");
  return await withLock(async () => {
    const state = await loadState(params.baseDir);
    const device = state.pairedByDeviceId[normalizeDeviceId(params.deviceId)];
    if (!device) {
      return null;
    }
    const role = normalizeRole(params.role);
    if (!role) {
      return null;
    }
    if (!device.tokens?.[role]) {
      return null;
    }
    const tokens = { ...device.tokens };
    const entry = { ...tokens[role], revokedAtMs: Date.now() };
    tokens[role] = entry;
    device.tokens = tokens;
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, params.baseDir);
    return entry;
  });
}
// 🔒 VOTAL.AI Security Fix: Missing authorization checks for pairing approval/rejection and token management [CWE-862] - CRITICAL