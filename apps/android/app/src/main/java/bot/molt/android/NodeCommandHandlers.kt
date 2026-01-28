package bot.molt.android

import android.Manifest
import android.content.pm.PackageManager
import android.location.LocationManager
import android.util.Log
import androidx.core.content.ContextCompat
import bot.molt.android.gateway.GatewaySession
import bot.molt.android.node.CanvasController
import bot.molt.android.protocol.MoltbotCameraCommand
import bot.molt.android.protocol.MoltbotCanvasA2UICommand
import bot.molt.android.protocol.MoltbotCanvasCommand
import bot.molt.android.protocol.MoltbotLocationCommand
import bot.molt.android.protocol.MoltbotScreenCommand
import bot.molt.android.protocol.MoltbotSmsCommand
import kotlinx.coroutines.TimeoutCancellationException

private const val TAG = "NodeCommandHandlers"

// MARK: - Command Handlers Extension

/**
 * Extension for node.invoke command routing and handlers.
 * Separated from NodeRuntime for maintainability.
 */
internal suspend fun NodeRuntime.routeInvoke(
    command: String,
    paramsJson: String?
): GatewaySession.InvokeResult {
    // Background restrictions
    if (command.startsWith(MoltbotCanvasCommand.NamespacePrefix) ||
        command.startsWith(MoltbotCanvasA2UICommand.NamespacePrefix) ||
        command.startsWith(MoltbotCameraCommand.NamespacePrefix) ||
        command.startsWith(MoltbotScreenCommand.NamespacePrefix)
    ) {
        if (!isForeground.value) {
            return GatewaySession.InvokeResult.error(
                code = "NODE_BACKGROUND_UNAVAILABLE",
                message = "NODE_BACKGROUND_UNAVAILABLE: canvas/camera/screen commands require foreground",
            )
        }
    }

    // Camera check
    if (command.startsWith(MoltbotCameraCommand.NamespacePrefix) && !cameraEnabled.value) {
        return GatewaySession.InvokeResult.error(
            code = "CAMERA_DISABLED",
            message = "CAMERA_DISABLED: enable Camera in Settings",
        )
    }

    // Location check
    if (command.startsWith(MoltbotLocationCommand.NamespacePrefix) &&
        locationMode.value == LocationMode.Off
    ) {
        return GatewaySession.InvokeResult.error(
            code = "LOCATION_DISABLED",
            message = "LOCATION_DISABLED: enable Location in Settings",
        )
    }

    return when (command) {
        MoltbotCanvasCommand.Present.rawValue -> handleCanvasPresent(paramsJson)
        MoltbotCanvasCommand.Hide.rawValue -> GatewaySession.InvokeResult.ok(null)
        MoltbotCanvasCommand.Navigate.rawValue -> handleCanvasNavigate(paramsJson)
        MoltbotCanvasCommand.Eval.rawValue -> handleCanvasEval(paramsJson)
        MoltbotCanvasCommand.Snapshot.rawValue -> handleCanvasSnapshot(paramsJson)
        MoltbotCanvasA2UICommand.Reset.rawValue -> handleA2UIReset()
        MoltbotCanvasA2UICommand.Push.rawValue,
        MoltbotCanvasA2UICommand.PushJSONL.rawValue -> handleA2UIPush(command, paramsJson)
        MoltbotCameraCommand.Snap.rawValue -> handleCameraSnap(paramsJson)
        MoltbotCameraCommand.Clip.rawValue -> handleCameraClip(paramsJson)
        MoltbotLocationCommand.Get.rawValue -> handleLocationGet(paramsJson)
        MoltbotScreenCommand.Record.rawValue -> handleScreenRecord(paramsJson)
        MoltbotSmsCommand.Send.rawValue -> handleSmsSend(paramsJson)
        else -> GatewaySession.InvokeResult.error(
            code = "INVALID_REQUEST",
            message = "INVALID_REQUEST: unknown command",
        )
    }
}

// MARK: - Canvas Handlers

private fun NodeRuntime.handleCanvasPresent(paramsJson: String?): GatewaySession.InvokeResult {
    val url = CanvasController.parseNavigateUrl(paramsJson)
    canvas.navigate(url)
    return GatewaySession.InvokeResult.ok(null)
}

private fun NodeRuntime.handleCanvasNavigate(paramsJson: String?): GatewaySession.InvokeResult {
    val url = CanvasController.parseNavigateUrl(paramsJson)
    canvas.navigate(url)
    return GatewaySession.InvokeResult.ok(null)
}

private suspend fun NodeRuntime.handleCanvasEval(paramsJson: String?): GatewaySession.InvokeResult {
    val js = CanvasController.parseEvalJs(paramsJson)
        ?: return GatewaySession.InvokeResult.error(
            code = "INVALID_REQUEST",
            message = "INVALID_REQUEST: javaScript required",
        )
    val result = try {
        canvas.eval(js)
    } catch (err: Throwable) {
        return GatewaySession.InvokeResult.error(
            code = "NODE_BACKGROUND_UNAVAILABLE",
            message = "NODE_BACKGROUND_UNAVAILABLE: canvas unavailable",
        )
    }
    return GatewaySession.InvokeResult.ok("""{"result":${result.toJsonStringEscaped()}}""")
}

private suspend fun NodeRuntime.handleCanvasSnapshot(paramsJson: String?): GatewaySession.InvokeResult {
    val snapshotParams = CanvasController.parseSnapshotParams(paramsJson)
    val base64 = try {
        canvas.snapshotBase64(
            format = snapshotParams.format,
            quality = snapshotParams.quality,
            maxWidth = snapshotParams.maxWidth,
        )
    } catch (err: Throwable) {
        return GatewaySession.InvokeResult.error(
            code = "NODE_BACKGROUND_UNAVAILABLE",
            message = "NODE_BACKGROUND_UNAVAILABLE: canvas unavailable",
        )
    }
    return GatewaySession.InvokeResult.ok("""{"format":"${snapshotParams.format.rawValue}","base64":"$base64"}""")
}

// MARK: - A2UI Handlers

private suspend fun NodeRuntime.handleA2UIReset(): GatewaySession.InvokeResult {
    val a2uiUrl = resolveA2uiHostUrl()
        ?: return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_NOT_CONFIGURED",
            message = "A2UI_HOST_NOT_CONFIGURED: gateway did not advertise canvas host",
        )
    val ready = ensureA2uiReady(a2uiUrl)
    if (!ready) {
        return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_UNAVAILABLE",
            message = "A2UI host not reachable",
        )
    }
    val res = canvas.eval(A2UI_RESET_JS)
    return GatewaySession.InvokeResult.ok(res)
}

private suspend fun NodeRuntime.handleA2UIPush(
    command: String,
    paramsJson: String?
): GatewaySession.InvokeResult {
    val messages = try {
        decodeA2uiMessages(command, paramsJson)
    } catch (err: Throwable) {
        return GatewaySession.InvokeResult.error(
            code = "INVALID_REQUEST",
            message = err.message ?: "invalid A2UI payload"
        )
    }
    val a2uiUrl = resolveA2uiHostUrl()
        ?: return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_NOT_CONFIGURED",
            message = "A2UI_HOST_NOT_CONFIGURED: gateway did not advertise canvas host",
        )
    val ready = ensureA2uiReady(a2uiUrl)
    if (!ready) {
        return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_UNAVAILABLE",
            message = "A2UI host not reachable",
        )
    }
    val js = a2uiApplyMessagesJS(messages)
    val res = canvas.eval(js)
    return GatewaySession.InvokeResult.ok(res)
}

// MARK: - Camera Handlers

private suspend fun NodeRuntime.handleCameraSnap(paramsJson: String?): GatewaySession.InvokeResult {
    showCameraHud(message = "Taking photo…", kind = CameraHudKind.Photo)
    triggerCameraFlash()
    val res = try {
        camera.snap(paramsJson)
    } catch (err: Throwable) {
        val (code, message) = invokeErrorFromThrowable(err)
        showCameraHud(message = message, kind = CameraHudKind.Error, autoHideMs = 2200)
        return GatewaySession.InvokeResult.error(code = code, message = message)
    }
    showCameraHud(message = "Photo captured", kind = CameraHudKind.Success, autoHideMs = 1600)
    return GatewaySession.InvokeResult.ok(res.payloadJson)
}

private suspend fun NodeRuntime.handleCameraClip(paramsJson: String?): GatewaySession.InvokeResult {
    val includeAudio = paramsJson?.contains("\"includeAudio\":true") != false
    if (includeAudio) setExternalAudioCaptureActive(true)
    try {
        showCameraHud(message = "Recording…", kind = CameraHudKind.Recording)
        val res = try {
            camera.clip(paramsJson)
        } catch (err: Throwable) {
            val (code, message) = invokeErrorFromThrowable(err)
            showCameraHud(message = message, kind = CameraHudKind.Error, autoHideMs = 2400)
            return GatewaySession.InvokeResult.error(code = code, message = message)
        }
        showCameraHud(message = "Clip captured", kind = CameraHudKind.Success, autoHideMs = 1800)
        return GatewaySession.InvokeResult.ok(res.payloadJson)
    } finally {
        if (includeAudio) setExternalAudioCaptureActive(false)
    }
}

// MARK: - Location Handler

private suspend fun NodeRuntime.handleLocationGet(paramsJson: String?): GatewaySession.InvokeResult {
    val mode = locationMode.value
    if (!isForeground.value && mode != LocationMode.Always) {
        return GatewaySession.InvokeResult.error(
            code = "LOCATION_BACKGROUND_UNAVAILABLE",
            message = "LOCATION_BACKGROUND_UNAVAILABLE: background location requires Always",
        )
    }
    if (!hasFineLocationPermission() && !hasCoarseLocationPermission()) {
        return GatewaySession.InvokeResult.error(
            code = "LOCATION_PERMISSION_REQUIRED",
            message = "LOCATION_PERMISSION_REQUIRED: grant Location permission",
        )
    }
    if (!isForeground.value && mode == LocationMode.Always && !hasBackgroundLocationPermission()) {
        return GatewaySession.InvokeResult.error(
            code = "LOCATION_PERMISSION_REQUIRED",
            message = "LOCATION_PERMISSION_REQUIRED: enable Always in system Settings",
        )
    }

    val (maxAgeMs, timeoutMs, desiredAccuracy) = parseLocationParams(paramsJson)
    val preciseEnabled = locationPreciseEnabled.value
    val accuracy = when (desiredAccuracy) {
        "precise" -> if (preciseEnabled && hasFineLocationPermission()) "precise" else "balanced"
        "coarse" -> "coarse"
        else -> if (preciseEnabled && hasFineLocationPermission()) "precise" else "balanced"
    }
    val providers = when (accuracy) {
        "precise" -> listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        "coarse" -> listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
        else -> listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
    }

    return try {
        val payload = location.getLocation(
            desiredProviders = providers,
            maxAgeMs = maxAgeMs,
            timeoutMs = timeoutMs,
            isPrecise = accuracy == "precise",
        )
        GatewaySession.InvokeResult.ok(payload.payloadJson)
    } catch (err: TimeoutCancellationException) {
        GatewaySession.InvokeResult.error(
            code = "LOCATION_TIMEOUT",
            message = "LOCATION_TIMEOUT: no fix in time",
        )
    } catch (err: Throwable) {
        val message = err.message ?: "LOCATION_UNAVAILABLE: no fix"
        GatewaySession.InvokeResult.error(code = "LOCATION_UNAVAILABLE", message = message)
    }
}

// MARK: - Screen Recording Handler

private suspend fun NodeRuntime.handleScreenRecord(paramsJson: String?): GatewaySession.InvokeResult {
    setScreenRecordActive(true)
    try {
        val res = try {
            screenRecorder.record(paramsJson)
        } catch (err: Throwable) {
            val (code, message) = invokeErrorFromThrowable(err)
            return GatewaySession.InvokeResult.error(code = code, message = message)
        }
        return GatewaySession.InvokeResult.ok(res.payloadJson)
    } finally {
        setScreenRecordActive(false)
    }
}

// MARK: - SMS Handler

private fun NodeRuntime.handleSmsSend(paramsJson: String?): GatewaySession.InvokeResult {
    val res = sms.send(paramsJson)
    return if (res.ok) {
        GatewaySession.InvokeResult.ok(res.payloadJson)
    } else {
        val error = res.error ?: "SMS_SEND_FAILED"
        val idx = error.indexOf(':')
        val code = if (idx > 0) error.substring(0, idx).trim() else "SMS_SEND_FAILED"
        GatewaySession.InvokeResult.error(code = code, message = error)
    }
}

// MARK: - Permission Checks

internal fun NodeRuntime.hasFineLocationPermission(): Boolean {
    return ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
}

internal fun NodeRuntime.hasCoarseLocationPermission(): Boolean {
    return ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
}

internal fun NodeRuntime.hasBackgroundLocationPermission(): Boolean {
    return ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
}

// MARK: - Helper Extension

/**
 * Escape a string for safe embedding in JSON and JavaScript.
 *
 * SECURITY: Handles all necessary escaping including:
 * - Standard JSON escapes (backslash, quotes, control chars)
 * - HTML script-breaking sequences (defense-in-depth)
 * - Unicode control characters
 */
private fun String.toJsonStringEscaped(): String {
    val escaped = this
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
        .replace("\b", "\\b")
        .replace("\u000C", "\\f")
        // Defense-in-depth: escape sequences that could break HTML script context
        .replace("</script>", "<\\/script>", ignoreCase = true)
        .replace("<!--", "<\\!--")
        // Escape Unicode line/paragraph separators (valid JSON but can break JS)
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    return "\"$escaped\""
}
