package com.clawdbot.android.assistant

import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.util.Log

/**
 * Standalone VoiceInteractionService that makes Clawdbot appear in
 * "Settings > Apps > Default Apps > Digital assistant app".
 *
 * This service must be separate from NodeForegroundService because
 * VoiceInteractionService cannot have foregroundServiceType attributes.
 */
class ClawdbotVoiceInteractionService : VoiceInteractionService() {

    companion object {
        private const val TAG = "ClawdbotVoiceInteraction"
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "VoiceInteractionService created")
    }

    override fun onReady() {
        super.onReady()
        Log.i(TAG, "VoiceInteractionService ready")
        // The service should now be ready to handle showSession() calls from the system
    }

    override fun onShutdown() {
        Log.i(TAG, "VoiceInteractionService shutdown")
        super.onShutdown()
    }
}
