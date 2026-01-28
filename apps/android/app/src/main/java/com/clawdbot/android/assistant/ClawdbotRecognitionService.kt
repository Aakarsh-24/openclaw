package com.clawdbot.android.assistant

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log

/**
 * RecognitionService implementation required for VoiceInteractionService.
 *
 * Per Android documentation: "Given that all VIAs are also voice recognizer services,
 * you must also include a RecognitionService in your manifest."
 *
 * This is a minimal implementation that satisfies the system requirement.
 * Actual speech recognition is handled by VoiceInteractionSession.
 */
class ClawdbotRecognitionService : RecognitionService() {

    companion object {
        private const val TAG = "ClawdbotRecognition"
    }

    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        Log.i(TAG, "onStartListening called")

        // This is a minimal implementation - actual recognition happens in VoiceInteractionSession
        // We just need this service to exist for the VoiceInteractionService to be valid

        // Notify that we're not implementing speech recognition here
        listener?.error(SpeechRecognizer.ERROR_SERVER)
    }

    override fun onCancel(listener: Callback?) {
        Log.i(TAG, "onCancel called")
        listener?.endOfSpeech()
    }

    override fun onStopListening(listener: Callback?) {
        Log.i(TAG, "onStopListening called")
        listener?.endOfSpeech()
    }
}
