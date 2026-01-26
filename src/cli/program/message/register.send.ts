import type { Command } from "commander";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageSendCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers
        .withRequiredMessageTarget(
          message
            .command("send")
            .description("Send a message")
            .option("-m, --message <text>", "Message body (required unless --media is set)"),
        )
        .option(
          "--media <path-or-url>",
          "Attach media (image/audio/video/document). Accepts local paths or URLs.",
        )
        .option(
          "--buttons <json>",
          "Telegram inline keyboard buttons as JSON (array of button rows)",
        )
        .option("--card <json>", "Adaptive Card JSON object (when supported by the channel)")
        .option("--reply-to <id>", "Reply-to message id")
        .option("--thread-id <id>", "Thread id (Telegram forum thread)")
        .option("--gif-playback", "Treat video media as GIF playback (WhatsApp only).", false)
        .option(
          "--latitude <number>",
          "Latitude for location message (required with --longitude for native WhatsApp location pin)",
          (value: string) => Number(value),
        )
        .option(
          "--longitude <number>",
          "Longitude for location message (required with --latitude for native WhatsApp location pin)",
          (value: string) => Number(value),
        )
        .option(
          "--location-name <text>",
          "Optional name for location message (e.g., 'Home', 'Office')",
        )
        .option("--location-address <text>", "Optional address text for location message")
        .option(
          "--location-accuracy <number>",
          "Optional accuracy in meters for location message",
          (value: string) => Number(value),
        ),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("send", opts);
    });
}
