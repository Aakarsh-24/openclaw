package bot.molt.android.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import bot.molt.android.MainActivity
import bot.molt.android.NodeApp
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Firebase Cloud Messaging service for receiving push notifications.
 * Handles both notification messages (shown automatically when app backgrounded)
 * and data messages (always delivered to this handler).
 */
class MoltbotMessagingService : FirebaseMessagingService() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM Token refreshed: ${token.take(16)}...")

        // Send token to gateway for registration
        val app = application as? NodeApp
        app?.let {
            // Store token for later registration with gateway
            PushTokenStore.saveToken(this, token)
            Log.d(TAG, "FCM token saved to local storage")
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message received from: ${message.from}")

        // Check if message contains a notification payload (handled automatically if app is in background)
        message.notification?.let { notification ->
            Log.d(TAG, "FCM notification payload: title=${notification.title}, body=${notification.body}")
            showNotification(
                title = notification.title ?: "Moltbot",
                body = notification.body ?: "New message"
            )
        }

        // Check if message contains a data payload (always handled here)
        if (message.data.isNotEmpty()) {
            Log.d(TAG, "FCM data payload: ${message.data.keys.joinToString()}")
            handleDataMessage(message.data)
        }
    }

    private fun handleDataMessage(data: Map<String, String>) {
        val messageType = data["type"]
        val title = data["title"] ?: "Moltbot"
        val body = data["body"] ?: "New message"
        val sessionKey = data["sessionKey"]

        when (messageType) {
            "chat" -> {
                // Incoming chat message - show notification and optionally sync
                Log.d(TAG, "Chat message received for session: $sessionKey")
                showNotification(title, body, sessionKey)
            }
            "sync" -> {
                // Silent sync request - trigger background sync
                Log.d(TAG, "Sync request received")
                // Could trigger SyncWorker.scheduleImmediately() here
            }
            else -> {
                // Generic notification
                showNotification(title, body)
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Chat Messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications for incoming chat messages"
            enableLights(true)
            enableVibration(true)
        }

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
        Log.d(TAG, "Notification channel created: $CHANNEL_ID")
    }

    private fun showNotification(title: String, body: String, sessionKey: String? = null) {
        // Create intent to open app when notification is tapped
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            sessionKey?.let { putExtra("sessionKey", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // TODO: Replace with app icon
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
        Log.d(TAG, "Notification shown: $title")
    }

    companion object {
        private const val TAG = "MoltbotFCM"
        private const val CHANNEL_ID = "moltbot_chat"
    }
}

/**
 * Secure storage for FCM push token using EncryptedSharedPreferences.
 * The token should be sent to the gateway when connection is established.
 *
 * SECURITY: Uses EncryptedSharedPreferences to protect tokens at rest.
 * Falls back to regular SharedPreferences only if encryption fails (rare edge cases).
 */
object PushTokenStore {
    private const val PREFS_NAME = "moltbot_push_secure"
    private const val KEY_FCM_TOKEN = "fcm_token"
    private const val TAG = "PushTokenStore"

    private fun getSecurePrefs(context: Context): android.content.SharedPreferences {
        return try {
            androidx.security.crypto.EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                androidx.security.crypto.MasterKeys.getOrCreate(
                    androidx.security.crypto.MasterKeys.AES256_GCM_SPEC
                ),
                androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback to regular prefs if encryption fails (shouldn't happen)
            Log.e(TAG, "Failed to create encrypted prefs, falling back to regular: ${e.message}")
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    fun saveToken(context: Context, token: String) {
        getSecurePrefs(context)
            .edit()
            .putString(KEY_FCM_TOKEN, token)
            .apply()
    }

    fun getToken(context: Context): String? {
        return getSecurePrefs(context)
            .getString(KEY_FCM_TOKEN, null)
    }

    fun clearToken(context: Context) {
        getSecurePrefs(context)
            .edit()
            .remove(KEY_FCM_TOKEN)
            .apply()
    }
}
