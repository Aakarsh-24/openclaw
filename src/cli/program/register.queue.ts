/**
 * Register Queue CLI commands
 */

import type { CommandRegistration } from "./command-registry.js";
import { registerQueueCommands } from "../queue-cli.js";

export const registerQueue: CommandRegistration = {
  id: "queue",
  register: ({ program }) => registerQueueCommands(program),
};
