#!/bin/bash
# google_web - Simple AI-friendly CLI wrapper for web searches
# Supports both Gemini and Brave search backends

set -e

# Default configuration
BACKEND="${GOOGLE_WEB_BACKEND:-gemini}"
DEFAULT_GEMINI_PATH="/home/almaz/TOOLS/web_search_by_gemini/web-search-by-Gemini.sh"
DEFAULT_BRAVE_PATH="/home/almaz/TOOLS/brave-search/brave-web-search.sh"

# Show help
show_help() {
    cat << 'EOF'
🔍 Google Web Search CLI

Search the web using AI-powered backends (Gemini or Brave).

USAGE:
    google_web [OPTIONS] "<search query>"
    google_web --help
    google_web -h

OPTIONS:
    --backend <gemini|brave>    Choose search backend (default: gemini)
    --timeout <seconds>         Set timeout (default: 30)
    --format <json|text>        Output format (default: json)
    --dry-run                   Show what would be executed without calling API
    --help, -h                  Show this help message

EXAMPLES:
    google_web "погода в Москве"
    google_web --backend brave "latest AI news"
    google_web --dry-run "python tutorial"
    google_web --format text "capital of Japan"
    google_web -h

ENVIRONMENT VARIABLES:
    GOOGLE_WEB_BACKEND    Default backend (gemini or brave)
    GEMINI_CLI_PATH      Path to Gemini CLI tool
    BRAVE_CLI_PATH       Path to Brave search CLI
    WEB_SEARCH_TIMEOUT   Default timeout in seconds

BACKENDS:
    gemini    Uses Gemini CLI with web search capability
    brave     Uses Brave Search API (requires BRAVE_API_KEY)

EXIT CODES:
    0    Success
    1    Generic error
    2    Backend not found
    3    Invalid query
    124  Timeout

OUTPUT FORMAT:
    Gemini backend returns JSON:
    {
      "session_id": "uuid",
      "response": "Search results in Russian",
      "stats": { "models": { ... } }
    }

    Brave backend returns JSON:
    {
      "query": "original query",
      "results": [ ... ],
      "metadata": { ... }
    }

    Text format returns plain text summary.

AI AGENT BEST PRACTICES:
    • Use for current information (weather, news, events)
    • Results always in Russian (Gemini) or English (Brave)
    • 5-10 second typical response time
    • No caching (always fresh results)
    • Visual distinction: 🌐 Результат поиска:
    • On error, retry once with modified query

SEE ALSO:
    • SDD: docs/sdd/web-search-via-gemini-cli/
    • Skills: skills/brave-search/SKILL.md
    • Tool: /home/almaz/TOOLS/web_search_by_gemini/README.md
EOF
    exit 0
}

# Error handler
error_exit() {
    echo "❌ ERROR: $1" >&2
    exit ${2:-1}
}

# Parse arguments
BACKEND="${GOOGLE_WEB_BACKEND:-gemini}"
TIMEOUT="${WEB_SEARCH_TIMEOUT:-30}"
FORMAT="json"
DRY_RUN="false"
QUERY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend)
            BACKEND="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            # Remaining arguments as query
            QUERY="$*"
            break
            ;;
    esac
done

# Validate query
if [[ -z "$QUERY" ]]; then
    error_exit "No search query provided. Use --help for usage information." 3
fi

if [[ ${#QUERY} -lt 3 ]]; then
    error_exit "Query too short. Minimum 3 characters required." 3
fi

# Determine CLI path
if [[ "$BACKEND" == "gemini" ]]; then
    CLI_PATH="${GEMINI_CLI_PATH:-$DEFAULT_GEMINI_PATH}"
elif [[ "$BACKEND" == "brave" ]]; then
    CLI_PATH="${BRAVE_CLI_PATH:-$DEFAULT_BRAVE_PATH}"
else
    error_exit "Invalid backend: $BACKEND. Use 'gemini' or 'brave'." 2
fi

# Validate CLI exists
if [[ ! -f "$CLI_PATH" ]]; then
    error_exit "CLI not found for backend '$BACKEND' at: $CLI_PATH\nSet ${BACKEND^^}_CLI_PATH environment variable." 2
fi

# Run command
case $BACKEND in
    gemini)
        CMD="\"$CLI_PATH\" --request \"$QUERY\""
        ;;
    brave)
        # Ensure API key is available
        if [[ -z "${BRAVE_API_KEY:-}" ]]; then
            error_exit "BRAVE_API_KEY environment variable not set. Required for Brave backend." 2
        fi
        CMD="BRAVE_API_KEY=\"$BRAVE_API_KEY\" \"$CLI_PATH\" --request \"$QUERY\""
        ;;
esac

# Add timeout if supported
if [[ -n "$TIMEOUT" ]]; then
    CMD="timeout ${TIMEOUT}s $CMD"
fi

# Execute
if [[ "$DRY_RUN" == "true" ]]; then
    echo "📝 DRY RUN MODE"
    echo "🐛 DEBUG: Backend=$BACKEND"
    echo "🐛 DEBUG: CLI=$CLI_PATH"
    echo "🐛 DEBUG: Timeout=${TIMEOUT}s"
    echo "🐛 DEBUG: Query=$QUERY"
    echo "🐛 DEBUG: Command=$CMD"
    echo "✓ Would execute: $CMD"
    echo "✓ Query: $QUERY"
    exit 0
fi

# Set format for backend
export WEB_SEARCH_OUTPUT_FORMAT="$FORMAT"

# Execute and capture output
if [[ "$FORMAT" == "text" ]]; then
    # For text format, extract just the response
    eval "$CMD" 2>/dev/null | grep -o '"response":"[^"]*"' | sed 's/"response":"//' | sed 's/"$//' | sed 's/\\n/\n/g'
else
    # Default JSON output
    eval "$CMD"
fi

exit_code=$?

# Handle specific exit codes
case $exit_code in
    124)
        error_exit "Search timed out after ${TIMEOUT} seconds" 124
        ;;
    127)
        error_exit "Command not found: $CLI_PATH" 2
        ;;
esac

exit $exit_code
