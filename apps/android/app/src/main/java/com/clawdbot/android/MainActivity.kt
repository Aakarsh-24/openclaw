package com.clawdbot.android

import android.Manifest
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Build
import android.util.Log
import android.view.WindowManager
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.clawdbot.android.ui.RootScreen
import com.clawdbot.android.ui.ClawdbotTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  private val viewModel: MainViewModel by viewModels()
  private lateinit var permissionRequester: PermissionRequester
  private lateinit var screenCaptureRequester: ScreenCaptureRequester

  companion object {
    private const val TAG = "MainActivity"
    private const val REQUEST_AUDIO_PERMISSION_FOR_ASSIST = 200
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val isDebuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    WebView.setWebContentsDebuggingEnabled(isDebuggable)
    applyImmersiveMode()
    requestDiscoveryPermissionsIfNeeded()
    requestNotificationPermissionIfNeeded()
    NodeForegroundService.start(this)

    // Auto-enable voice mode when launched via digital assistant (long-press power)
    handleAssistIntent(intent)
    permissionRequester = PermissionRequester(this)
    screenCaptureRequester = ScreenCaptureRequester(this)
    viewModel.camera.attachLifecycleOwner(this)
    viewModel.camera.attachPermissionRequester(permissionRequester)
    viewModel.sms.attachPermissionRequester(permissionRequester)
    viewModel.screenRecorder.attachScreenCaptureRequester(screenCaptureRequester)
    viewModel.screenRecorder.attachPermissionRequester(permissionRequester)

    lifecycleScope.launch {
      repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.preventSleep.collect { enabled ->
          if (enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
          } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
          }
        }
      }
    }

    setContent {
      ClawdbotTheme {
        Surface(modifier = Modifier) {
          RootScreen(viewModel = viewModel)
        }
      }
    }
  }

  override fun onResume() {
    super.onResume()
    applyImmersiveMode()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      applyImmersiveMode()
    }
  }

  override fun onStart() {
    super.onStart()
    viewModel.setForeground(true)
  }

  override fun onStop() {
    viewModel.setForeground(false)
    super.onStop()
  }

  private fun applyImmersiveMode() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.hide(WindowInsetsCompat.Type.systemBars())
  }

  private fun requestDiscoveryPermissionsIfNeeded() {
    if (Build.VERSION.SDK_INT >= 33) {
      val ok =
        ContextCompat.checkSelfPermission(
          this,
          Manifest.permission.NEARBY_WIFI_DEVICES,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
      if (!ok) {
        requestPermissions(arrayOf(Manifest.permission.NEARBY_WIFI_DEVICES), 100)
      }
    } else {
      val ok =
        ContextCompat.checkSelfPermission(
          this,
          Manifest.permission.ACCESS_FINE_LOCATION,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
      if (!ok) {
        requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 101)
      }
    }
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < 33) return
    val ok =
      ContextCompat.checkSelfPermission(
        this,
        Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED
    if (!ok) {
      requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 102)
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleAssistIntent(intent)
  }

  private fun handleAssistIntent(intent: Intent?) {
    val action = intent?.action ?: return
    val isAssistAction = action == Intent.ACTION_ASSIST ||
        action == "android.intent.action.VOICE_ASSIST" ||
        action == "android.intent.action.VOICE_COMMAND" ||
        action == "android.intent.action.SEARCH_LONG_PRESS" ||
        action == "com.clawdbot.android.ACTION_ASSISTANT"

    if (isAssistAction) {
      Log.d(TAG, "Launched via assistant action: $action - enabling voice mode")
      enableVoiceModeIfPermitted()
    }
  }

  private fun enableVoiceModeIfPermitted() {
    val micOk = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.RECORD_AUDIO
    ) == PackageManager.PERMISSION_GRANTED

    if (micOk) {
      viewModel.setTalkEnabled(true)
    } else {
      // Request permission - will enable talk mode when granted
      requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO_PERMISSION_FOR_ASSIST)
    }
  }

  @Deprecated("Deprecated in Java")
  @Suppress("DEPRECATION")
  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQUEST_AUDIO_PERMISSION_FOR_ASSIST) {
      if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
        Log.d(TAG, "Audio permission granted - enabling voice mode")
        viewModel.setTalkEnabled(true)
      }
    }
  }
}
