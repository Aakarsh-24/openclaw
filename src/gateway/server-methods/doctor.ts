import type { RuntimeEnv } from "../../runtime.js";
import type { GatewayRequestHandlers } from "./types.js";
import { doctorCommand } from "../../commands/doctor.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

export const doctorHandlers: GatewayRequestHandlers = {
  "doctor.run": async ({ params, respond }) => {
    const nonInteractive = params?.nonInteractive;
    const fix = params?.fix;
    if (nonInteractive !== undefined && typeof nonInteractive !== "boolean") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "doctor.run params: nonInteractive (boolean)"),
      );
      return;
    }
    if (fix !== undefined && typeof fix !== "boolean") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "doctor.run params: fix (boolean)"),
      );
      return;
    }

    const lines: string[] = [];
    const runtime: RuntimeEnv = {
      log: (...args) => {
        lines.push(args.map(String).join(" "));
      },
      error: (...args) => {
        lines.push(args.map(String).join(" "));
      },
      exit: (code) => {
        throw new Error(`doctor exit ${code}`);
      },
    };

    try {
      await doctorCommand(runtime, {
        nonInteractive: nonInteractive ?? true,
        // Do not prompt. If fix=true we still do best-effort, but doctor may refuse in nonInteractive.
        fix: fix ?? false,
      } as any);
      respond(true, { ok: true, output: lines.join("\n") }, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(true, { ok: false, output: lines.join("\n"), error: message }, undefined);
    }
  },
};
