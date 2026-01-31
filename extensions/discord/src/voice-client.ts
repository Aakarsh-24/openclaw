import { Client, GatewayIntentBits } from "discord.js";
import type { Guild, GuildVoiceChannelResolvable } from "discord.js";

let voiceClient: Client | null = null;
let isInitializing = false;

/**
 * Get or create the Discord.js voice client.
 * This is a parallel client to @buape/carbon, specifically for voice operations.
 */
export async function getVoiceClient(token: string): Promise<Client> {
  if (voiceClient?.isReady()) {
    return voiceClient;
  }

  // Prevent multiple simultaneous initialization attempts
  if (isInitializing) {
    // Wait for initialization with timeout to prevent infinite polling
    const INIT_TIMEOUT_MS = 30_000; // 30 seconds max wait
    const startTime = Date.now();
    await new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (!isInitializing) {
          clearInterval(interval);
          resolve(undefined);
        } else if (Date.now() - startTime > INIT_TIMEOUT_MS) {
          clearInterval(interval);
          reject(new Error("Discord voice client initialization timeout"));
        }
      }, 100);
    });
    if (voiceClient?.isReady()) {
      return voiceClient;
    }
  }

  isInitializing = true;

  try {
    voiceClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    await voiceClient.login(token);

    // Wait for client to be ready
    if (!voiceClient.isReady()) {
      await new Promise<void>((resolve) => {
        voiceClient!.once("ready", () => resolve());
      });
    }

    return voiceClient;
  } finally {
    isInitializing = false;
  }
}

/**
 * Get the voice adapter creator for a specific guild.
 * Required by @discordjs/voice to join voice channels.
 */
export function getVoiceAdapterCreator(guildId: string) {
  if (!voiceClient?.isReady()) {
    throw new Error("Voice client not initialized. Call getVoiceClient() first.");
  }

  const guild = voiceClient.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error(`Guild ${guildId} not found in voice client cache.`);
  }

  return guild.voiceAdapterCreator;
}

/**
 * Get a guild from the voice client.
 */
export function getVoiceGuild(guildId: string): Guild | undefined {
  return voiceClient?.guilds.cache.get(guildId);
}

/**
 * Find which voice channel a user is currently in.
 */
export function getUserVoiceChannel(
  guildId: string,
  userId: string,
): GuildVoiceChannelResolvable | null {
  const guild = getVoiceGuild(guildId);
  if (!guild) return null;

  const member = guild.members.cache.get(userId);
  if (!member?.voice.channel) return null;

  return member.voice.channel;
}

/**
 * Validate that a channelId is a valid voice channel in the guild.
 * Returns the channel if valid, null otherwise.
 */
export function getVoiceChannel(
  guildId: string,
  channelId: string,
): GuildVoiceChannelResolvable | null {
  const guild = getVoiceGuild(guildId);
  if (!guild) return null;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) return null;

  return channel as GuildVoiceChannelResolvable;
}

/**
 * Cleanup the voice client connection.
 */
export async function destroyVoiceClient(): Promise<void> {
  if (voiceClient) {
    await voiceClient.destroy();
    voiceClient = null;
  }
}

/**
 * Check if voice client is ready.
 */
export function isVoiceClientReady(): boolean {
  return voiceClient?.isReady() ?? false;
}
