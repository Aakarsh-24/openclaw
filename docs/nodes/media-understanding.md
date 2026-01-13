---
title: "Media Understanding"
description: "Automatic transcription of voice notes and analysis of videos in WhatsApp messages"
---

# Media Understanding

Clawdbot can automatically transcribe voice notes and analyze videos sent via WhatsApp, giving your agent context about media content without requiring external CLI tools.

## Voice Note Transcription

When enabled, voice notes are transcribed using Groq's Whisper API before being passed to your agent. The transcript replaces the audio placeholder, so your agent sees `[Voice Note]` followed by the transcript text.

### Requirements

- A [Groq API key](https://console.groq.com/keys) (free tier available)

### Configuration

```json
{
  "voiceNotes": {
    "transcription": {
      "enabled": true,
      "provider": "groq"
    }
  },
  "skills": {
    "entries": {
      "groq": { "apiKey": "gsk_..." }
    }
  }
}
```

Alternatively, set the `GROQ_API_KEY` environment variable instead of using `skills.entries`.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable voice note transcription |
| `provider` | string | `"groq"` | Transcription provider (currently only `groq`) |
| `model` | string | `"whisper-large-v3-turbo"` | Whisper model to use |
| `language` | string | auto-detect | ISO 639-1 language code (e.g., `"en"`, `"es"`) |
| `timeoutSeconds` | number | `60` | Request timeout |
| `dmEnabled` | boolean | `true` | Enable for direct messages |
| `groupEnabled` | boolean | `false` | Enable for group chats |
| `groupAllowFrom` | string[] | — | Group JIDs or names to allow (when `groupEnabled` is true) |
| `persist` | boolean | `true` | Save transcripts as sidecar `.transcript.txt` files |

### Example: Enable for Specific Groups

```json
{
  "voiceNotes": {
    "transcription": {
      "enabled": true,
      "dmEnabled": true,
      "groupEnabled": true,
      "groupAllowFrom": ["Family Chat", "Work Team"]
    }
  }
}
```

### Performance

Groq's Whisper API is fast—typical voice notes transcribe in 1-2 seconds.

---

## Video Understanding

When enabled, videos are analyzed using Google's Gemini API. The model describes what's happening in the video, and this description is injected into the message so your agent can respond naturally as if it watched the video.

### Requirements

- A [Google AI Studio API key](https://aistudio.google.com/apikey) (free tier available)

### Configuration

```json
{
  "video": {
    "understanding": {
      "enabled": true,
      "provider": "gemini"
    }
  },
  "skills": {
    "entries": {
      "gemini": { "apiKey": "AIza..." }
    }
  }
}
```

Alternatively, set the `GEMINI_API_KEY` environment variable.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable video understanding |
| `provider` | string | `"gemini"` | Video analysis provider (currently only `gemini`) |
| `model` | string | `"gemini-3-flash-preview"` | Gemini model to use |
| `prompt` | string | — | Custom prompt for video description |
| `timeoutSeconds` | number | `120` | Request timeout (videos take longer) |
| `dmEnabled` | boolean | `true` | Enable for direct messages |
| `groupEnabled` | boolean | `false` | Enable for group chats |
| `groupAllowFrom` | string[] | — | Group JIDs or names to allow (when `groupEnabled` is true) |
| `persist` | boolean | `true` | Save descriptions as sidecar `.description.txt` files |

### Custom Prompts

Override the default video analysis prompt:

```json
{
  "video": {
    "understanding": {
      "enabled": true,
      "prompt": "Describe this video in detail, focusing on any text or documents shown."
    }
  }
}
```

### Performance

Gemini video analysis typically completes in 3-5 seconds depending on video length.

---

## Full Example

Enable both features with custom settings:

```json
{
  "voiceNotes": {
    "transcription": {
      "enabled": true,
      "model": "whisper-large-v3-turbo",
      "language": "en",
      "dmEnabled": true,
      "groupEnabled": false
    }
  },
  "video": {
    "understanding": {
      "enabled": true,
      "model": "gemini-3-flash-preview",
      "dmEnabled": true,
      "groupEnabled": false
    }
  },
  "skills": {
    "entries": {
      "groq": { "apiKey": "gsk_..." },
      "gemini": { "apiKey": "AIza..." }
    }
  }
}
```

## Sidecar Files

When `persist` is enabled (the default), transcripts and descriptions are saved alongside the original media:

- Voice notes: `<audio-file>.transcript.txt`
- Videos: `<video-file>.description.txt`

These files are useful for debugging and can be referenced later.

## Differences from CLI Transcription

This feature differs from the older [CLI-based audio transcription](/nodes/audio):

| Feature | `voiceNotes.transcription` | `tools.audio.transcription` |
|---------|---------------------------|----------------------------|
| Provider | Groq Whisper API | Any CLI tool |
| Setup | API key only | Install CLI tool |
| Speed | Fast (1-2s) | Depends on tool |
| Per-chat control | Yes (dm/group toggles) | No |

Both can coexist—the new `voiceNotes.transcription` runs first in the pipeline. If a voice note is already transcribed, the CLI transcription step is skipped.
