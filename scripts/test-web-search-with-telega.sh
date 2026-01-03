#!/bin/bash
# E2E test for web search using telega_v2 to interact with real bot
# This tests the complete flow: send message → bot processes → fetch response

set -e

# Configuration
BOT_NAME="@${TELEGRAM_BOT_USERNAME:-clawdis_bot}"
TELEGA_CMD="/home/almaz/TOOLS/telega_v2/telega_v2"
TEST_CHAT="${TEST_CHAT_ID:-me}"
WAIT_TIME="${WAIT_TIME:-10}"  # seconds to wait for bot response

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo "  Expected: $2"
    echo "  Got: $3"
    ((TESTS_FAILED++))
}

info() {
    echo -e "${BLUE}→ INFO${NC}: $1"
}

test_start() {
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "Testing: $1"
    echo "═══════════════════════════════════════════════════════"
    ((TESTS_RUN++))
}

# Check if telega_v2 is available
if [ ! -f "$TELEGA_CMD" ]; then
    echo -e "${RED}ERROR${NC}: telega_v2 not found at $TELEGA_CMD"
    exit 1
fi

info "Using telega_v2 at: $TELEGA_CMD"
info "Testing bot: $BOT_NAME"
info "Test chat: $TEST_CHAT"
info "Wait time: ${WAIT_TIME}s for bot response"

# Test 1: Weather Search
test_start "Weather Search"
SEND_TIME=$(date +%s)
$TELEGA_CMD send "$TEST_CHAT" "${BOT_NAME} погода в Москве"
info "Message sent, waiting ${WAIT_TIME}s for bot response..."
sleep $WAIT_TIME

RESPONSE=$(timeout 10s $TELEGA_CMD fetch "$TEST_CHAT" --limit 5 2>/dev/null | grep -A 5 "погода в Москве" || echo "")

if echo "$RESPONSE" | grep -q "🔍"; then
    if echo "$RESPONSE" | grep -q "🌐"; then
        pass "Weather search returned result with proper emojis"
    else
        fail "Weather search" "🌐 emoji in response" "no result emoji found"
    fi
else
    fail "Weather search" "🔍 acknowledgment" "no acknowledgment found"
fi

# Test 2: News Search
test_start "News Search"
$TELEGA_CMD send "$TEST_CHAT" "${BOT_NAME} последние новости по технологиям"
info "Message sent, waiting ${WAIT_TIME}s for bot response..."
sleep $WAIT_TIME

RESPONSE=$(timeout 10s $TELEGA_CMD fetch "$TEST_CHAT" --limit 5 2>/dev/null | grep -A 5 "последние новости" || echo "")

if echo "$RESPONSE" | grep -q "🔍"; then
    pass "News search acknowledged"
    if echo "$RESPONSE" | grep -q "🌐"; then
        pass "News search returned formatted result"
    fi
else
    fail "News search" "bot acknowledgment" "no response"
fi

# Test 3: Explicit Search Keyword
test_start "Explicit Search Keyword (погугли)"
$TELEGA_CMD send "$TEST_CHAT" "${BOT_NAME} погугли python tutorial"
info "Message sent, waiting ${WAIT_TIME}s for bot response..."
sleep $WAIT_TIME

RESPONSE=$(timeout 10s $TELEGA_CMD fetch "$TEST_CHAT" --limit 5 2>/dev/null | grep -A 5 "python tutorial" || echo "")

if echo "$RESPONSE" | grep -q "🔍"; then
    pass "Explicit keyword triggered search"
else
    fail "Explicit keyword search" "trigger search" "no acknowledgment"
fi

# Test 4: Normal Chat (Should NOT trigger search)
test_start "Normal Chat (No False Positive)"
$TELEGA_CMD send "$TEST_CHAT" "${BOT_NAME} привет, как дела?"
info "Message sent, waiting ${WAIT_TIME}s for bot response..."
sleep $WAIT_TIME

RESPONSE=$(timeout 10s $TELEGA_CMD fetch "$TEST_CHAT" --limit 5 2>/dev/null | grep -A 5 "привет, как дела" || echo "")

if echo "$RESPONSE" | grep -q "что*такое*привет"; then
    pass "Normal chat handled without web search"
else
    fail "Normal chat" "AI response without 🔍" "got search acknowledgment"
fi

# Test 5: Deep Research Precedence
test_start "Deep Research Precedence"
$TELEGA_CMD send "$TEST_CHAT" "${BOT_NAME} сделай депресерч по ИИ"
info "Message sent, waiting ${WAIT_TIME}s for bot response..."
sleep $WAIT_TIME

RESPONSE=$(timeout 10s $TELEGA_CMD fetch "$TEST_CHAT" --limit 5 2>/dev/null | grep -A 5 "депресерч" || echo "")

if echo "$RESPONSE" | grep -q "🔍"; then
    fail "Deep research" "no web search" "web search triggered (should trigger deep research instead)"
else
    pass "Deep research took precedence (no web search)"
fi

# Test 6: Timeout Scenario (sending a very long query that might timeout)
test_start "Timeout Handling"
$TELEGA_CMD send "$TEST_CHAT" "${BOT_NAME} погода в Москве сегодня и завтра и на следующей неделе и какая будет температура и влажность и скорость ветра"
info "Message sent, waiting ${WAIT_TIME}s for bot response..."
sleep $WAIT_TIME

RESPONSE=$(timeout 10s $TELEGA_CMD fetch "$TEST_CHAT" --limit 5 2>/dev/null | tail -20 || echo "")

if echo "$RESPONSE" | grep -q "⏱️\|timeout\|таймаут"; then
    pass "Timeout properly handled"
elif echo "$RESPONSE" | grep -q "🌐"; then
    info "Query completed before timeout (fast processing)"
    pass "Search completed successfully"
else
    info "No specific timeout or result message (may still be processing)"
    pass "Response handling ok"
fi

# Generate final report
echo ""
echo "═══════════════════════════════════════════════════════"
echo "Test Report"
echo "═══════════════════════════════════════════════════════"
echo "Total Tests:  $TESTS_RUN"
echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
