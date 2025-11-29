#!/bin/bash
#
# check-escape-hatches.sh
#
# Simple grep-based check for escape hatch patterns.
# Run in CI to catch violations before they're merged.
#
# Exit code: 0 = clean, 1 = violations found

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VIOLATIONS=0

echo "Checking for escape hatch patterns..."
echo ""

# Check 1: Methods that return internal objects (DOMAIN CODE ONLY)
# Framework code (apps/lore-weave/) is allowed to have these; domain code should not
echo "=== Checking for internal accessor methods in domain ==="
if grep -rn --include="*.ts" -E "^\s*(public\s+)?get(Graph|InternalGraph|Mapper|Internal\w+)\s*\(" penguin-tales/lore/ 2>/dev/null | grep -v node_modules | grep -v dist; then
    echo -e "${RED}VIOLATION: Methods returning internal objects found in domain${NC}"
    echo "These bypass framework protections. Use framework APIs instead."
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "✓ No internal accessor methods in domain"
fi
echo ""

# Check 2: Fallback defaults for config (but allow legitimate uses)
echo "=== Checking for config fallback patterns ==="
if grep -rn --include="*.ts" -E "(config|options|context)\s*(\?\?|\|\|)\s*(\{|default|null)" apps/lore-weave/lib/ penguin-tales/lore/ 2>/dev/null | grep -v "test" | grep -v "__tests__"; then
    echo -e "${YELLOW}WARNING: Potential config fallback patterns found${NC}"
    echo "Review these - if config is required, it should throw, not default."
    # Don't count as violation - needs human review
else
    echo "✓ No obvious config fallback patterns"
fi
echo ""

# Check 3: @deprecated comments (code should be deleted, not deprecated)
echo "=== Checking for @deprecated code ==="
if grep -rn --include="*.ts" "@deprecated" apps/lore-weave/lib/ penguin-tales/lore/ 2>/dev/null | grep -v "test" | grep -v "__tests__" | grep -v node_modules; then
    echo -e "${RED}VIOLATION: @deprecated code found${NC}"
    echo "Deprecated code must be removed, not left for compatibility."
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "✓ No deprecated code markers"
fi
echo ""

# Check 4: Legacy API method calls
echo "=== Checking for legacy API usage ==="
LEGACY_PATTERNS=(
    "\.getGraph\(\)"
    "\.getInternalGraph\(\)"
    "deriveCoordinates\("
    "addEntityInRegion\("
)
for pattern in "${LEGACY_PATTERNS[@]}"; do
    if grep -rn --include="*.ts" -E "$pattern" penguin-tales/lore/ 2>/dev/null | grep -v "test" | grep -v "__tests__" | grep -v node_modules; then
        echo -e "${RED}VIOLATION: Legacy API '${pattern}' used in domain code${NC}"
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done
if [ $VIOLATIONS -eq 0 ]; then
    echo "✓ No legacy API usage in domain"
fi
echo ""

# Summary
echo "=========================================="
if [ $VIOLATIONS -gt 0 ]; then
    echo -e "${RED}FAILED: $VIOLATIONS violation(s) found${NC}"
    echo ""
    echo "These patterns create divergent code paths that bypass framework protections."
    echo "Fix them before merging."
    exit 1
else
    echo -e "✓ ${NC}All escape hatch checks passed"
    exit 0
fi
