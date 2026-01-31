import type { MoltbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { discordPlugin } from "./src/channel.js";
import { setDiscordRuntime } from "./src/runtime.js";
import { 
  initializeVoiceIntegration, 
  cleanupVoiceIntegration,
  handleDiscordMessageForVoice,
  getVoiceSessionManager,
} from "./src/voice-integration.js";
import { getUserVoiceChannel, getVoiceChannel } from "./src/voice-client.js";
import { 
  registerVoiceProvider, 
  clearVoiceProvider,
} from "../../src/discord/voice-registry.js";

const plugin = {
  id: "discord",
  name: "Discord",
  description: "Discord channel plugin with voice support",
  configSchema: emptyPluginConfigSchema(),
  register(api: MoltbotPluginApi) {
    api.logger.info("[discord-plugin] Register called");
    setDiscordRuntime(api.runtime);
    api.registerChannel({ plugin: discordPlugin });

    // Initialize voice integration (fire-and-forget, plugin system doesn't support async register)
    // NOTE: Voice channel integration is DISABLED by default to prevent connection spam
    // This feature was replaced by Phone Liam (Twilio) for real-time voice calls
    const config = api.config;
    const discordConfig = config.channels?.discord;
    const voiceEnabled = discordConfig?.voice?.enabled === true; // Explicit check - must be exactly true
    api.logger.info(`[discord-plugin] Voice channel integration: ${voiceEnabled ? "ENABLED" : "DISABLED"}`);
    
    if (!voiceEnabled) {
      api.logger.info("[discord-plugin] Skipping voice channel init (voice.enabled !== true). DM voice messages via TTS still work.");
      return; // Early return - don't initialize voice client, prevents connection spam
    }
    
    // Voice is enabled - proceed with initialization
    api.logger.info("Initializing Discord voice channel support...");
      
      // Get Discord token - use resolveDiscordToken from runtime config
      // We need to access the token that's being used by the Discord monitor
      const token = discordConfig?.token || process.env.DISCORD_BOT_TOKEN || "";
      
      if (!token) {
        console.error("Cannot initialize Discord voice: token not found");
        return;
      }
      
      // Get API keys from config
      const groqApiKey = config.models?.providers?.groq?.apiKey;
      const elevenlabsApiKey = config.messages?.tts?.elevenlabs?.apiKey;
      const elevenlabsVoiceId = config.messages?.tts?.elevenlabs?.voiceId;
      const elevenlabsModelId = config.messages?.tts?.elevenlabs?.modelId;

      // Initialize in background (don't await - plugin register must be sync)
      initializeVoiceIntegration({
        token,
        groqApiKey,
        elevenlabsApiKey,
        elevenlabsVoiceId,
        elevenlabsModelId,
      }).then(() => {
        // Register voice provider with core after successful initialization
        api.logger.info("Registering Discord voice provider with core...");
        const voiceSessionManager = getVoiceSessionManager();
        
        registerVoiceProvider({
          async joinChannel(guildId: string, channelId: string, userId: string): Promise<void> {
            // Check if already in a voice channel in this guild
            const existingSession = voiceSessionManager.getSession(guildId);
            if (existingSession && existingSession.isSessionActive()) {
              throw new Error("Already in a voice channel in this server.");
            }
            
            // Verify the channelId is a valid voice channel
            const voiceChannel = getVoiceChannel(guildId, channelId);
            if (!voiceChannel) {
              throw new Error(`Invalid voice channel: ${channelId} is not a voice channel or doesn't exist.`);
            }
            
            // Create and join voice session
            const session = await voiceSessionManager.createSession({
              guildId,
              channelId,
              userId: userId || "", // userId is optional for bot-initiated joins
              idleTimeoutMs: discordConfig?.voice?.idleTimeoutMs || 60_000,
              interruptEnabled: discordConfig?.voice?.interruptEnabled ?? true,
            });
            
            await session.join();
          },
          
          async leaveChannel(guildId: string): Promise<void> {
            const session = voiceSessionManager.getSession(guildId);
            if (!session || !session.isSessionActive()) {
              throw new Error("Not in a voice channel.");
            }
            await voiceSessionManager.destroySession(guildId);
          },
          
          getStatus(guildId: string) {
            const session = voiceSessionManager.getSession(guildId);
            if (!session || !session.isSessionActive()) {
              return { connected: false };
            }
            // Access private config via type assertion (safer than direct access)
            const sessionConfig = (session as any).config;
            return {
              connected: true,
              channelId: sessionConfig?.channelId,
              userId: sessionConfig?.userId,
            };
          },
        });
        
        api.logger.info("Discord voice provider registered successfully");
      }).catch((error) => {
        console.error("Failed to initialize Discord voice integration:", error);
      });
  },
  unregister() {
    // Clear voice provider registry
    clearVoiceProvider();
    // Cleanup voice sessions on unregister
    cleanupVoiceIntegration().catch(console.error);
  },
};

// Export voice utilities for use by Discord runtime
export { 
  handleDiscordMessageForVoice,
  getVoiceSessionManager,
};

export default plugin;
