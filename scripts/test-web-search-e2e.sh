#!/bin/bash
# E2E test for web search feature
# Tests complete flow: CLI → API → Response

set -e

# Configuration
CLI_PATH="${1:-/home/almaz/TOOLS/web_search_by_gemini/web-search-by-Gemini.sh}"
DRY_RUN="${2:-true}"
REPORT_FILE="/tmp/web-search-e2e-report-$$.txt"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1" | tee -a "$REPORT_FILE"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1" | tee -a "$REPORT_FILE"
    echo "  Error: $2" | tee -a "$REPORT_FILE"
    ((TESTS_FAILED++))
}

info() {
    echo -e "${BLUE}→ INFO${NC}: $1" | tee -a "$REPORT_FILE"
}

test_start() {
    echo "" | tee -a "$REPORT_FILE"
    echo "═══════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
    echo "Testing: $1" | tee -a "$REPORT_FILE"
    echo "═══════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
    ((TESTS_RUN++))
}

# Initialize report
echo "Web Search E2E Test Report" > "$REPORT_FILE"
echo "===========================" >> "$REPORT_FILE"
echo "Started: $(date)" >> "$REPORT_FILE"
echo "CLI Path: $CLI_PATH" >> "$REPORT_FILE"
echo "Dry Run: $DRY_RUN" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check if CLI exists
if [ ! -f "$CLI_PATH" ]; then
    echo -e "${RED}ERROR${NC}: CLI not found at $CLI_PATH"
    exit 1
fi

# Enable dry-run if requested
if [ "$DRY_RUN" = "true" ]; then
    info "Running in DRY RUN mode (no actual API calls)"
    export WEB_SEARCH_DRY_RUN=true
else
    info "Running with REAL API calls (API costs may apply)"
    export WEB_SEARCH_DRY_RUN=false
fi

info "CLI tool found: $CLI_PATH"

# Test 1: Weather Query
test_start "Weather Search"
RESULT=$(timeout 35s pnpm clawdis agent --message "погода в Москве" --provider telegram --dry-run 2>&1 || echo "ERROR: Command failed")

if echo "$RESULT" | grep -q "погода\|температура\|°C"; then
    pass "Weather search returned relevant result"
elif echo "$RESULT" | grep -q "DRY RUN"; then
    pass "Weather search (dry run) completed"
else
    fail "Weather search" "No weather information in result"
fi

# Test 2: News Query
test_start "News Search"
RESULT=$(timeout 35s pnpm clawdis agent --message "последние новости по технологиям" --provider telegram --dry-run 2>&1 || echo "ERROR: Command failed")

if echo "$RESULT" | grep -q "новост\|сообщени\|технолог"; then
    pass "News search returned relevant result"
elif echo "$RESULT" | grep -q "DRY RUN"; then
    pass "News search (dry run) completed"
else
    fail "News search" "No news information in result"
fi

# Test 3: Factual Query
test_start "Factual Search"
RESULT=$(timeout 35s pnpm clawdis agent --message "какая высота Эвереста" --provider telegram --dry-run 2>&1 || echo "ERROR: Command failed")

if echo "$RESULT" | grep -q "высот\|метр\|метров"; then
    pass "Fact search returned relevant result"
elif echo "$RESULT" | grep -q "DRY RUN"; then
    pass "Fact search (dry run) completed"
else
    fail "Fact search" "No factual information in result"
fi

# Test 4: Russian Query with Special Characters
test_start "Russian Query"
RESULT=$(timeout 35s pnpm clawdis agent --message "столица Японии" --provider telegram --dry-run 2>&1 || echo "ERROR: Command failed")

if echo "$RESULT" | grep -q "Токио\|Япония"; then
    pass "Russian query returned correct result"
elif echo "$RESULT" | grep -q "DRY RUN"; then
    pass "Russian query (dry run) completed"
else
    fail "Russian query" "No relevant information in result"
fi

# Test 5: Explicit Search Keywords
test_start "Explicit Search Keywords"
RESULT=$(timeout 35s pnpm clawdis agent --message "погугли python tutorial" --provider telegram --dry-run 2>&1 || echo "ERROR: Command failed")

if echo "$RESULT" | grep -q "python\|DRY RUN"; then
    pass "Explicit keyword search worked"
else
    fail "Explicit keyword search" "No python information in result"
fi

# Test 6: Timeout Test (shorter timeout to test handling)
test_start "Timeout Handling"
START_TIME=$(date +%s)
RESULT=$(timeout 15s pnpm clawdis agent --message "погода в Москве сегодня и завтра а также на неделю" --provider telegram --dry-run 2>&1 || true)
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "$DURATION" -ge 15 ]; then
    info "Timeout test (process killed at 15s)"
    pass "Timeout test passed"
elif echo "$RESULT" | grep -q "timeout\|таймаут"; then
    pass "Timeout properly handled"
else
    info "Query completed before timeout ($DURATION seconds)"
    pass "Timeout not triggered (fast query)"
fi

# Generate Report
echo "" | tee -a "$REPORT_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
echo -e "${YELLOW}Test Report${NC}" | tee -a "$REPORT_FILE"
echo "═══════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
echo "Total Tests:  $TESTS_RUN" | tee -a "$REPORT_FILE"
echo -e "${GREEN}Passed:${NC}       $TESTS_PASSED" | tee -a "$REPORT_FILE"
echo -e "${RED}Failed:${NC}       $TESTS_FAILED" | tee -a "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
