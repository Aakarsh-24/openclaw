import { wizardCancel, wizardNext, wizardStart } from "./controllers/wizard";

export async function startConfigureWizard(state: any) {
  if (!state.client) {
    state.wizardError = "Not connected to gateway";
    return;
  }
  state.wizardLoading = true;
  state.wizardError = null;
  state.wizardDone = false;
  state.wizardStep = null;
  state.wizardAnswer = undefined;
  try {
    const res = await wizardStart(state.client, { wizard: "configure" });
    state.wizardSessionId = res.sessionId;
    state.wizardStep = res.step ?? null;
    state.wizardDone = Boolean(res.done);
  } catch (e: any) {
    state.wizardError = String(e?.message ?? e);
  } finally {
    state.wizardLoading = false;
  }
}

export async function nextWizard(state: any) {
  if (!state.client || !state.wizardSessionId) return;
  const stepId = state.wizardStep?.id;
  if (!stepId) return;

  state.wizardLoading = true;
  state.wizardError = null;
  try {
    const res = await wizardNext(state.client, {
      sessionId: state.wizardSessionId,
      answer: { stepId, value: state.wizardAnswer },
    });
    state.wizardStep = res.step ?? null;
    state.wizardDone = Boolean(res.done);
    if (res.done) {
      state.wizardSessionId = null;
      state.wizardAnswer = undefined;
    } else {
      state.wizardAnswer = res.step?.initialValue;
    }
  } catch (e: any) {
    state.wizardError = String(e?.message ?? e);
  } finally {
    state.wizardLoading = false;
  }
}

export async function cancelWizard(state: any) {
  if (!state.client || !state.wizardSessionId) {
    state.wizardSessionId = null;
    state.wizardStep = null;
    return;
  }
  state.wizardLoading = true;
  state.wizardError = null;
  try {
    await wizardCancel(state.client, state.wizardSessionId);
    state.wizardSessionId = null;
    state.wizardStep = null;
    state.wizardDone = false;
    state.wizardAnswer = undefined;
  } catch (e: any) {
    state.wizardError = String(e?.message ?? e);
  } finally {
    state.wizardLoading = false;
  }
}
