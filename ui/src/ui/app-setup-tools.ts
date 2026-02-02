import type { ConfigSnapshot } from "./types";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function setupDownloadConfig(state: any) {
  if (!state.client || !state.connected) {
    state.setupToolsError = "Not connected";
    return;
  }
  state.setupToolsBusy = true;
  state.setupToolsError = null;
  try {
    const snap = (await state.client.request("config.get", {})) as ConfigSnapshot;
    const raw =
      typeof snap.raw === "string"
        ? snap.raw
        : JSON.stringify(snap.config ?? {}, null, 2);
    downloadText("openclaw.json", raw);
  } catch (err) {
    state.setupToolsError = String(err);
  } finally {
    state.setupToolsBusy = false;
  }
}

export async function setupImportConfig(state: any, file: File) {
  if (!state.client || !state.connected) {
    state.setupToolsError = "Not connected";
    return;
  }
  state.setupToolsBusy = true;
  state.setupToolsError = null;
  try {
    const raw = await file.text();
    const snap = (await state.client.request("config.get", {})) as ConfigSnapshot;
    const baseHash = snap.hash;
    if (!baseHash) {
      state.setupToolsError = "Config hash missing; reload and retry.";
      return;
    }
    await state.client.request("config.apply", {
      raw,
      baseHash,
      sessionKey: state.applySessionKey,
    });
    state.setupToolsMessage = "Imported config and requested restart.";
  } catch (err) {
    state.setupToolsError = String(err);
  } finally {
    state.setupToolsBusy = false;
  }
}

export async function setupRunDoctor(state: any) {
  if (!state.client || !state.connected) {
    state.setupDoctorError = "Not connected";
    return;
  }
  state.setupDoctorBusy = true;
  state.setupDoctorError = null;
  state.setupDoctorOutput = null;
  try {
    const res = (await state.client.request("doctor.run", { nonInteractive: true })) as any;
    state.setupDoctorOutput = typeof res?.output === "string" ? res.output : JSON.stringify(res, null, 2);
    if (res?.ok === false && res?.error) {
      state.setupDoctorError = String(res.error);
    }
  } catch (err) {
    state.setupDoctorError = String(err);
  } finally {
    state.setupDoctorBusy = false;
  }
}
