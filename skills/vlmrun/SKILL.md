---
name: vlmrun
description: "Use VLM Run's Orion visual AI agent via CLI. Process images, videos, and documents with natural language. Triggers: image understanding/generation, object detection, OCR, video summarization, document extraction, image generation, visual AI chat, 'generate an image/video', 'analyze this image/video', 'extract text from', 'summarize this video', 'process this PDF'."
homepage: https://vlm.run
metadata: {"clawdbot":{"emoji":"👁️","requires":{"bins":["uv"],"env":["VLMRUN_API_KEY"]},"primaryEnv":"VLMRUN_API_KEY","install":[{"id":"uv-brew","kind":"brew","formula":"uv","bins":["uv"],"label":"Install uv (brew)"}]}}
---

# VLM Run CLI

Chat with VLM Run's Orion visual AI agent via CLI. Process images, videos, and documents with state-of-the-art visual intelligence.

## Features

- **Image Intelligence**: Understanding, captioning, detection, segmentation, generation, editing
- **Video Intelligence**: Summarization, transcription, keyframe extraction, highlight detection
- **Document Intelligence**: Layout understanding, OCR, markdown extraction, data extraction from invoices/receipts/forms

## Setup

```bash
uv venv && source .venv/bin/activate
uv pip install "vlmrun[cli]"
```

## Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| `VLMRUN_API_KEY` | Required | Your VLM Run API key from [app.vlm.run](https://app.vlm.run) |
| `VLMRUN_BASE_URL` | Optional | Base URL (default: `https://agent.vlm.run/v1`) |
| `VLMRUN_CACHE_DIR` | Optional | Cache directory (default: `~/.vlmrun/cache/artifacts/`) |

## Command

```bash
vlmrun chat "<prompt>" -i input.jpg [options]
```

## Options

| Flag | Description |
|------|-------------|
| `-p, --prompt` | Prompt text, file path, or `stdin` |
| `-i, --input` | Input file(s) - images, videos, docs (repeatable) |
| `-o, --output` | Artifact directory (default: `~/.vlmrun/cache/artifacts/`) |
| `-m, --model` | `vlmrun-orion-1:fast`, `vlmrun-orion-1:auto` (default), `vlmrun-orion-1:pro` |
| `-s, --session` | Optional session ID to continue a previous session |
| `-j, --json` | Raw JSON output |
| `-ns, --no-stream` | Disable streaming |
| `-nd, --no-download` | Skip artifact download |

## Examples

### Image Understanding

```bash
vlmrun chat "Describe what you see in this image in detail" -i photo.jpg
vlmrun chat "Detect and list all objects visible in this scene" -i scene.jpg
vlmrun chat "Extract all text and numbers from this document image" -i document.png
vlmrun chat "Compare these two images and describe the differences" -i before.jpg -i after.jpg
```

### Image Generation

```bash
vlmrun chat "Generate a photorealistic image of a cozy cabin in a snowy forest at sunset" -o ./generated
vlmrun chat "Remove the background from this product image and make it transparent" -i product.jpg -o ./output
```

### Video Processing

```bash
vlmrun chat "Summarize the key points discussed in this meeting video" -i meeting.mp4
vlmrun chat "Find the top 3 highlight moments and create short clips from them" -i sports.mp4
vlmrun chat "Transcribe this lecture with timestamps for each section" -i lecture.mp4 --json
```

### Video Generation

```bash
vlmrun chat "Generate a 5-second video of ocean waves crashing on a rocky beach at golden hour" -o ./videos
vlmrun chat "Create a smooth slow-motion video from this image" -i ocean.jpg -o ./output
```

### Document Extraction

```bash
vlmrun chat "Extract the vendor name, line items, and total amount" -i invoice.pdf --json
vlmrun chat "Summarize the key terms and obligations in this contract" -i contract.pdf
```

### Prompt Sources

```bash
# Direct prompt
vlmrun chat "What objects and people are visible in this image?" -i photo.jpg

# Prompt from file
vlmrun chat -p long_prompt.txt -i photo.jpg

# Prompt from stdin
echo "Describe this image in detail" | vlmrun chat - -i photo.jpg
```

### Continuing a Session

```bash
# Start a new session
vlmrun chat "Create an iconic scene of a ninja in a forest, practicing his skills with a katana" -i photo.jpg

# Continue with previous context (use the session ID from above)
vlmrun chat "Create a new scene with the same character meditating under a tree" -i photo.jpg -s <session_id>
```

## Notes

- Use `-o ./<directory>` to save generated artifacts (images, videos) relative to your current working directory
- Without `-o`, artifacts save to `~/.vlmrun/cache/artifacts/<session_id>/`
- Multiple input files upload concurrently
- Get your API key from [app.vlm.run](https://app.vlm.run)
