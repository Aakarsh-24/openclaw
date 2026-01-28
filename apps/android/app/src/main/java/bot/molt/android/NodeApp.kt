package bot.molt.android

import android.app.Application
import android.os.StrictMode
import bot.molt.android.sync.SyncWorker

class NodeApp : Application() {
  val runtime: NodeRuntime by lazy { NodeRuntime(this) }

  override fun onCreate() {
    super.onCreate()

    // Schedule periodic background sync for chat history
    SyncWorker.schedule(this)

    if (BuildConfig.DEBUG) {
      StrictMode.setThreadPolicy(
        StrictMode.ThreadPolicy.Builder()
          .detectAll()
          .penaltyLog()
          .build(),
      )
      StrictMode.setVmPolicy(
        StrictMode.VmPolicy.Builder()
          .detectAll()
          .penaltyLog()
          .build(),
      )
    }
  }
}
