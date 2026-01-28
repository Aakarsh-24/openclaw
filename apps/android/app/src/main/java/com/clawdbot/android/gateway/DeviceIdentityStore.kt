package com.clawdbot.android.gateway

import android.content.Context
import android.util.Base64
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.io.File
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Security
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class DeviceIdentity(
  val deviceId: String,
  val publicKeyRawBase64: String,
  val privateKeyPkcs8Base64: String,
  val createdAtMs: Long,
)

class DeviceIdentityStore(context: Context) {
  private val json = Json { ignoreUnknownKeys = true }
  private val identityFile = File(context.filesDir, "clawdbot/identity/device.json")

  companion object {
    // Use our own provider instance to avoid conflicts with Android's built-in BC
    private val bcProvider = BouncyCastleProvider()
    private val ED25519_SPKI_PREFIX = byteArrayOf(
      0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
    )

    init {
      // Remove any conflicting BC provider and add our full BouncyCastle
      Security.removeProvider("BC")
      Security.insertProviderAt(bcProvider, 1)
      android.util.Log.d("DeviceIdentityStore", "Registered BouncyCastle provider: ${bcProvider.info}")
    }
  }

  @Synchronized
  fun loadOrCreate(): DeviceIdentity {
    val existing = load()
    if (existing != null) {
      val derived = deriveDeviceId(existing.publicKeyRawBase64)
      if (derived != null && derived != existing.deviceId) {
        val updated = existing.copy(deviceId = derived)
        save(updated)
        return updated
      }
      return existing
    }
    val fresh = generate()
    save(fresh)
    return fresh
  }

  fun signPayload(payload: String, identity: DeviceIdentity): String? {
    return try {
      val privateKeyBytes = Base64.decode(identity.privateKeyPkcs8Base64, Base64.DEFAULT)
      val keySpec = PKCS8EncodedKeySpec(privateKeyBytes)
      val keyFactory = KeyFactory.getInstance("Ed25519", bcProvider)
      val privateKey = keyFactory.generatePrivate(keySpec)
      val signature = Signature.getInstance("Ed25519", bcProvider)
      signature.initSign(privateKey)
      signature.update(payload.toByteArray(Charsets.UTF_8))
      base64UrlEncode(signature.sign())
    } catch (e: Throwable) {
      android.util.Log.e("DeviceIdentityStore", "signPayload failed", e)
      null
    }
  }

  fun publicKeyBase64Url(identity: DeviceIdentity): String? {
    return try {
      val raw = Base64.decode(identity.publicKeyRawBase64, Base64.DEFAULT)
      base64UrlEncode(raw)
    } catch (_: Throwable) {
      null
    }
  }

  private fun load(): DeviceIdentity? {
    return try {
      if (!identityFile.exists()) return null
      val raw = identityFile.readText(Charsets.UTF_8)
      val decoded = json.decodeFromString(DeviceIdentity.serializer(), raw)
      if (decoded.deviceId.isBlank() ||
        decoded.publicKeyRawBase64.isBlank() ||
        decoded.privateKeyPkcs8Base64.isBlank()
      ) {
        null
      } else {
        decoded
      }
    } catch (_: Throwable) {
      null
    }
  }

  private fun save(identity: DeviceIdentity) {
    try {
      identityFile.parentFile?.mkdirs()
      val encoded = json.encodeToString(DeviceIdentity.serializer(), identity)
      identityFile.writeText(encoded, Charsets.UTF_8)
    } catch (_: Throwable) {
      // best-effort only
    }
  }

  private fun generate(): DeviceIdentity {
    android.util.Log.d("DeviceIdentityStore", "Generating new Ed25519 key using BouncyCastle")

    val kpg = KeyPairGenerator.getInstance("Ed25519", bcProvider)
    val keyPair = kpg.generateKeyPair()

    val spki = keyPair.public.encoded
    val rawPublic = stripSpkiPrefix(spki)
    val deviceId = sha256Hex(rawPublic)
    val privateKey = keyPair.private.encoded

    android.util.Log.d("DeviceIdentityStore", "Generated Ed25519 key, deviceId=${deviceId.take(8)}..., pubKeyLen=${rawPublic.size}")

    return DeviceIdentity(
      deviceId = deviceId,
      publicKeyRawBase64 = Base64.encodeToString(rawPublic, Base64.NO_WRAP),
      privateKeyPkcs8Base64 = Base64.encodeToString(privateKey, Base64.NO_WRAP),
      createdAtMs = System.currentTimeMillis(),
    )
  }

  private fun deriveDeviceId(publicKeyRawBase64: String): String? {
    return try {
      val raw = Base64.decode(publicKeyRawBase64, Base64.DEFAULT)
      sha256Hex(raw)
    } catch (_: Throwable) {
      null
    }
  }

  private fun stripSpkiPrefix(spki: ByteArray): ByteArray {
    if (spki.size == ED25519_SPKI_PREFIX.size + 32 &&
      spki.copyOfRange(0, ED25519_SPKI_PREFIX.size).contentEquals(ED25519_SPKI_PREFIX)
    ) {
      return spki.copyOfRange(ED25519_SPKI_PREFIX.size, spki.size)
    }
    return spki
  }

  private fun sha256Hex(data: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(data)
    val out = StringBuilder(digest.size * 2)
    for (byte in digest) {
      out.append(String.format("%02x", byte))
    }
    return out.toString()
  }

  private fun base64UrlEncode(data: ByteArray): String {
    return Base64.encodeToString(data, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  }
}
