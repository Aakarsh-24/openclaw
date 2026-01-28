# Android Assistant App Support for Clawdbot

## Overview

Implement Android's VoiceInteractionService to make Clawdbot appear in "Settings > Apps > Default Apps > Digital assistant app" like ChatGPT and Perplexity. When users long-press the home button, Clawdbot will launch with screen context captured via the Assist API.

## Architecture Decisions (User-Confirmed)

1. **UI**: Launch MainActivity with chat overlay expanded (reuse existing UI)
2. **Screen Context**: Always capture via Assist API and include in query
3. **Service**: Extend NodeForegroundService to also be a VoiceInteractionService
4. **Offline**: Show error dialog prompting user to connect to gateway

## Implementation Flow

```
User long-presses Home
  ↓
Android invokes VoiceInteractionSession.onHandleAssist()
  ↓
Capture screen context (AssistStructure + AssistContent) → JSON
  ↓
Launch MainActivity with Intent (action=ACTION_ASSISTANT, context JSON)
  ↓
Check gateway connection
  ├─ Connected: Open chat sheet with context message
  └─ Offline: Show error dialog with "Open Settings" button
```

## Implementation Steps

### 1. AndroidManifest Changes

**File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/AndroidManifest.xml`

Add permission:
```xml
<uses-permission android:name="android.permission.BIND_VOICE_INTERACTION" />
```

Update NodeForegroundService declaration:
```xml
<service
    android:name=".NodeForegroundService"
    android:exported="true"
    android:foregroundServiceType="dataSync|microphone|mediaProjection"
    android:permission="android.permission.BIND_VOICE_INTERACTION">
    <intent-filter>
        <action android:name="android.service.voice.VoiceInteractionService" />
    </intent-filter>
    <meta-data
        android:name="android.voice_interaction"
        android:resource="@xml/voice_interaction_service" />
</service>
```

Add VoiceInteractionSessionService:
```xml
<service
    android:name=".assistant.ClawdbotVoiceInteractionSessionService"
    android:exported="false"
    android:permission="android.permission.BIND_VOICE_INTERACTION" />
```

Update MainActivity for assistant intent:
```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTop">
    <!-- Existing MAIN/LAUNCHER intent-filter stays -->
    <intent-filter>
        <action android:name="com.clawdbot.android.ACTION_ASSISTANT" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
</activity>
```

### 2. Create XML Resource

**New File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/res/xml/voice_interaction_service.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<voice-interaction-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:sessionService=".assistant.ClawdbotVoiceInteractionSessionService"
    android:supportsAssist="true"
    android:supportsLaunchVoiceAssistFromKeyguard="false"
    android:supportsLocalInteraction="false" />
```

### 3. Update NodeForegroundService

**File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/java/com/clawdbot/android/NodeForegroundService.kt`

Change line 23 from:
```kotlin
class NodeForegroundService : Service() {
```

To:
```kotlin
class NodeForegroundService : VoiceInteractionService() {
```

Add import:
```kotlin
import android.service.voice.VoiceInteractionService
```

Add lifecycle callbacks (after line 66, in the class body):
```kotlin
override fun onReady() {
    super.onReady()
    android.util.Log.i("ClawdbotVoiceInteraction", "VoiceInteractionService ready")
}

override fun onShutdown() {
    android.util.Log.i("ClawdbotVoiceInteraction", "VoiceInteractionService shutdown")
    super.onShutdown()
}
```

### 4. Create VoiceInteractionSessionService

**New File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/java/com/clawdbot/android/assistant/ClawdbotVoiceInteractionSessionService.kt`

```kotlin
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
```

### 5. Create VoiceInteractionSession

**New File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/java/com/clawdbot/android/assistant/ClawdbotVoiceInteractionSession.kt`

Core logic:
- Capture screen context from AssistStructure (view hierarchy text) and AssistContent (URLs, structured data)
- Serialize to JSON (timestamp, packageName, webUri, visibleText array)
- Launch MainActivity with ACTION_ASSISTANT intent + context JSON extra
- Extract up to 100 text nodes to avoid overwhelming the chat
- Finish session immediately after launching activity

Key features:
- `onHandleAssist()`: Main entry point, captures context and launches MainActivity
- `captureScreenContext()`: Builds JSON from AssistStructure/AssistContent
- `extractTextFromViewNode()`: Recursively walks view hierarchy for text
- Error handling with try-catch and fallback

### 6. MainActivity Integration

**File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/java/com/clawdbot/android/MainActivity.kt`

Add in `onCreate()` (after line 37):
```kotlin
handleAssistantIntent(intent)
```

Add `onNewIntent()` method (for singleTop launch mode):
```kotlin
override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleAssistantIntent(intent)
}
```

Add helper methods:
```kotlin
private fun handleAssistantIntent(intent: Intent?) {
    if (intent?.action == "com.clawdbot.android.ACTION_ASSISTANT") {
        val screenContext = intent.getStringExtra("screen_context")
        lifecycleScope.launch {
            delay(100) // Wait for runtime initialization
            if (!viewModel.isConnected.value) {
                showAssistantOfflineDialog()
            } else {
                viewModel.openChatWithContext(screenContext)
            }
        }
    }
}

private fun showAssistantOfflineDialog() {
    androidx.appcompat.app.AlertDialog.Builder(this)
        .setTitle("Gateway Not Connected")
        .setMessage("Clawdbot Assistant requires a connection to your gateway. Please connect first.")
        .setPositiveButton("Open Settings") { _, _ ->
            viewModel.requestShowSettings()
        }
        .setNegativeButton("Cancel", null)
        .show()
}
```

Add imports:
```kotlin
import android.content.Intent
import androidx.appcompat.app.AlertDialog
import kotlinx.coroutines.delay
```

### 7. MainViewModel Updates

**File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/java/com/clawdbot/android/MainViewModel.kt`

Add state flows:
```kotlin
private val _assistantContext = MutableStateFlow<String?>(null)
val assistantContext: StateFlow<String?> = _assistantContext.asStateFlow()

private val _showSettingsRequest = MutableStateFlow(false)
val showSettingsRequest: StateFlow<Boolean> = _showSettingsRequest.asStateFlow()
```

Add methods:
```kotlin
fun openChatWithContext(screenContext: String?) {
    _assistantContext.value = screenContext
}

fun requestShowSettings() {
    _showSettingsRequest.value = true
}

fun clearShowSettingsRequest() {
    _showSettingsRequest.value = false
}

fun clearAssistantContext() {
    _assistantContext.value = null
}
```

### 8. RootScreen UI Integration

**File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/java/com/clawdbot/android/ui/RootScreen.kt`

Add state collection:
```kotlin
val assistantContext by viewModel.assistantContext.collectAsState()
val showSettingsRequest by viewModel.showSettingsRequest.collectAsState()
```

Add LaunchedEffect to auto-open chat:
```kotlin
LaunchedEffect(assistantContext) {
    if (assistantContext != null) {
        sheet = Sheet.Chat
    }
}

LaunchedEffect(showSettingsRequest) {
    if (showSettingsRequest) {
        sheet = Sheet.Settings
        viewModel.clearShowSettingsRequest()
    }
}
```

### 9. ChatSheet Context Formatting

**File**: `/home/yishai/code_projects/clawdbot/apps/android/app/src/main/java/com/clawdbot/android/ui/chat/ChatSheetContent.kt`

Add state collection and auto-send:
```kotlin
val assistantContext by viewModel.assistantContext.collectAsState()

LaunchedEffect(assistantContext) {
    assistantContext?.let { contextJson ->
        val formattedMessage = formatAssistantMessage(contextJson)
        viewModel.sendChat(
            message = formattedMessage,
            thinking = thinkingLevel,
            attachments = emptyList()
        )
        viewModel.clearAssistantContext()
    }
}
```

Add formatter helper:
```kotlin
private fun formatAssistantMessage(contextJson: String): String {
    return try {
        val json = Json.parseToJsonElement(contextJson).jsonObject
        buildString {
            appendLine("I'm looking at:")
            json["packageName"]?.jsonPrimitive?.contentOrNull?.let {
                appendLine("App: $it")
            }
            json["webUri"]?.jsonPrimitive?.contentOrNull?.let {
                appendLine("URL: $it")
            }
            json["visibleText"]?.jsonArray?.take(20)?.forEach {
                it.jsonPrimitive?.contentOrNull?.let { text ->
                    appendLine("- $text")
                }
            }
            appendLine("\nScreen context JSON:")
            appendLine("```json")
            appendLine(contextJson)
            appendLine("```")
        }
    } catch (e: Exception) {
        "Screen context:\n```json\n$contextJson\n```"
    }
}
```

## Testing Plan

### Setup
1. Install debug build: `./gradlew installDebug`
2. Open Settings > Apps > Default Apps > Digital assistant app
3. Select "Clawdbot"

### Test Cases

**Test 1: Basic Invocation (Connected)**
- Precondition: Connected to gateway
- Open any app (Chrome, Gmail)
- Long-press Home button
- Expected: MainActivity opens, chat sheet shows, message auto-sent with screen context

**Test 2: Offline Invocation**
- Precondition: NOT connected to gateway
- Long-press Home button
- Expected: Alert dialog "Gateway Not Connected" with "Open Settings" button

**Test 3: Screen Context - Web Browser**
- Open Chrome with webpage
- Invoke assistant
- Expected: Context includes webUri, packageName, visible text from page

**Test 4: Multiple Invocations**
- Invoke from one app, let response complete
- Switch to different app
- Invoke again
- Expected: New context from second app

**Test 5: Service Persistence**
- Reboot device
- Check Settings > Apps > Default Apps
- Expected: Clawdbot still appears as option

### Debugging
```bash
# View logs
adb logcat | grep -E "Clawdbot|VoiceInteraction|Assistant"

# Check service status
adb shell dumpsys activity services | grep -A 20 clawdbot

# Verify manifest
aapt dump xmltree app/build/outputs/apk/debug/app-debug.apk AndroidManifest.xml | grep -A 10 voice
```

## Critical Files Summary

### To Modify (5 files)
1. `AndroidManifest.xml` - Add permissions, service declarations, metadata
2. `NodeForegroundService.kt` - Extend VoiceInteractionService, add lifecycle methods
3. `MainActivity.kt` - Handle assistant intents, show offline dialog
4. `MainViewModel.kt` - Add assistant context state flows and methods
5. `RootScreen.kt` - Auto-open chat sheet when context provided

### To Create (3 files)
1. `res/xml/voice_interaction_service.xml` - Voice interaction metadata
2. `assistant/ClawdbotVoiceInteractionSessionService.kt` - Session service (lightweight)
3. `assistant/ClawdbotVoiceInteractionSession.kt` - Core session logic (screen context capture)

### Optional Enhancement
- `ChatSheetContent.kt` - Format context message for better UX (can use basic formatting initially)

## Key Technical Notes

- **VoiceInteractionService** is a Service subclass, so extending it from NodeForegroundService is fully compatible
- **BIND_VOICE_INTERACTION** permission is automatically granted when app is set as default assistant
- **AssistStructure** can be large; extract data immediately and discard object
- **Screen context** limited to 100 text nodes to prevent overwhelming chat
- **Intent flags** use SINGLE_TOP to reuse existing MainActivity instance
- **Error handling**: Wrap all Assist API calls in try-catch for robustness

## Security & Privacy

- Screen context may contain sensitive data (passwords, PII)
- Data only sent to user's own gateway (existing trust model)
- No local storage of screen context (memory only)
- User must explicitly invoke assistant (intentional action)
- Offline mode prevents transmission if not connected

## Success Criteria

✅ Clawdbot appears in "Digital assistant app" settings
✅ Long-press home launches Clawdbot with chat
✅ Screen context captured and formatted in message
✅ Offline handling shows error dialog
✅ Existing app functionality unaffected
✅ Service lifecycle stable across reboots
