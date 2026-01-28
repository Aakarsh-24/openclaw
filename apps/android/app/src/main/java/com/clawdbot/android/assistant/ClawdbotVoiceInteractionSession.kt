package com.clawdbot.android.assistant

import android.app.assist.AssistContent
import android.app.assist.AssistStructure
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.util.Log
import com.clawdbot.android.MainActivity
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class ClawdbotVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    companion object {
        private const val TAG = "ClawdbotAssistSession"
        const val ACTION_ASSISTANT = "com.clawdbot.android.ACTION_ASSISTANT"
        const val EXTRA_SCREEN_CONTEXT = "screen_context"
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onHandleAssist(
        data: Bundle?,
        structure: AssistStructure?,
        content: AssistContent?
    ) {
        try {
            Log.i(TAG, "onHandleAssist called")

            // Capture screen context
            val screenContext = captureScreenContext(structure, content)

            // Launch MainActivity with context
            val intent = Intent(context, MainActivity::class.java).apply {
                action = ACTION_ASSISTANT
                putExtra(EXTRA_SCREEN_CONTEXT, screenContext)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }

            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling assist", e)
            // Show error toast
            android.widget.Toast.makeText(
                context,
                "Clawdbot Assistant error: ${e.message}",
                android.widget.Toast.LENGTH_LONG
            ).show()
        } finally {
            // Close the session (we're delegating to MainActivity)
            finish()
        }
    }

    override fun onHandleScreenshot(screenshot: Bitmap?) {
        Log.i(TAG, "Screenshot captured: ${screenshot?.width}x${screenshot?.height}")
        // Optional: Could save screenshot and include in context
        // For now, we rely on AssistStructure text extraction
    }

    private fun captureScreenContext(
        structure: AssistStructure?,
        content: AssistContent?
    ): String {
        val contextData = buildJsonObject {
            // Basic metadata
            put("timestamp", System.currentTimeMillis())

            // Content data (URLs, structured data)
            content?.let { assistContent ->
                assistContent.webUri?.let { uri ->
                    put("webUri", uri.toString())
                }
                assistContent.clipData?.let { clip ->
                    if (clip.itemCount > 0) {
                        put("clipText", clip.getItemAt(0).text?.toString() ?: "")
                    }
                }
                // JSON-LD structured data (if available)
                assistContent.structuredData?.let { jsonLd ->
                    put("structuredData", jsonLd)
                }
            }

            // Structure data (view hierarchy, text content)
            structure?.let { assistStruct ->
                put("packageName", assistStruct.activityComponent.packageName)
                put("className", assistStruct.activityComponent.className)

                // Extract visible text from view hierarchy
                val textNodes = mutableListOf<String>()
                extractTextFromStructure(assistStruct, textNodes)

                put("visibleText", buildJsonArray {
                    textNodes.forEach { text -> add(JsonPrimitive(text)) }
                })
            }
        }

        return contextData.toString()
    }

    private fun extractTextFromStructure(
        structure: AssistStructure,
        textNodes: MutableList<String>,
        maxNodes: Int = 100
    ) {
        if (textNodes.size >= maxNodes) return

        val windowCount = structure.windowNodeCount
        for (i in 0 until windowCount) {
            val windowNode = structure.getWindowNodeAt(i)
            val rootViewNode = windowNode.rootViewNode
            extractTextFromViewNode(rootViewNode, textNodes, maxNodes)
        }
    }

    private fun extractTextFromViewNode(
        viewNode: AssistStructure.ViewNode,
        textNodes: MutableList<String>,
        maxNodes: Int
    ) {
        if (textNodes.size >= maxNodes) return

        // Extract text from this node
        viewNode.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let {
            textNodes.add(it)
        }

        // Extract content description
        viewNode.contentDescription?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let {
            if (!textNodes.contains(it)) {
                textNodes.add(it)
            }
        }

        // Recursively process children
        val childCount = viewNode.childCount
        for (i in 0 until childCount) {
            viewNode.getChildAt(i)?.let { child ->
                extractTextFromViewNode(child, textNodes, maxNodes)
            }
        }
    }
}
