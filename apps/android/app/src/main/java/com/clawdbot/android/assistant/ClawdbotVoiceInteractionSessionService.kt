package com.clawdbot.android.assistant

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

class ClawdbotVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        android.util.Log.i("ClawdbotAssistant", "Creating new VoiceInteractionSession")
        return ClawdbotVoiceInteractionSession(this)
    }
}
