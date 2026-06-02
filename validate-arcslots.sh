#!/usr/bin/env bash
# ArcSlots - Pre-Deployment Validation Script
# Run this before pushing to production

echo "🎰 ArcSlots Pre-Deployment Checklist"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    return 0
  else
    echo -e "${RED}✗${NC} $1"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    return 0
  else
    echo -e "${RED}✗${NC} $1/"
    return 1
  fi
}

# 1. Backend Module Check
echo "📦 Backend Module Files:"
check_file "src/lib/arcslots/arcslots.constants.ts"
check_file "src/lib/arcslots/arcslots.functions.ts"
check_file "src/lib/arcslots/index.ts"
echo ""

# 2. Frontend Components Check
echo "🎨 Frontend Components:"
check_file "src/components/arcslots/SlotMachine.tsx"
check_file "src/components/arcslots/SlotReel.tsx"
check_file "src/components/arcslots/PoolDisplay.tsx"
check_file "src/components/arcslots/StatsBar.tsx"
check_file "src/components/arcslots/GiftBox.tsx"
check_file "src/components/arcslots/index.ts"
echo ""

# 3. Route Check
echo "🌐 Route Files:"
check_file "src/app/slots/page.tsx"
check_file "src/app/slots/layout.tsx"
echo ""

# 4. Documentation Check
echo "📚 Documentation:"
check_file "ARCSLOTS_ARCHITECTURE.md"
check_file "ARCSLOTS_SETUP.md"
check_file "ARCSLOTS_INTEGRATION.md"
check_file "ARCSLOTS_SUMMARY.md"
check_file "ARCSLOTS_QUICK_REFERENCE.md"
echo ""

# 5. Regression Check
echo "🔍 Regression Check (should be UNCHANGED):"
check_file "src/app/layout.tsx"
check_file "src/components/Web3Provider.tsx"
echo ""

# 6. Build Check
echo "🔨 Build Check:"
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} npm run build (successful)"
else
  echo -e "${RED}✗${NC} npm run build (FAILED)"
fi
echo ""

# 7. Lint Check
echo "🔎 Lint Check:"
if npm run lint 2>&1 | grep -q "error"; then
  echo -e "${RED}✗${NC} npm run lint (has errors)"
else
  echo -e "${GREEN}✓${NC} npm run lint (no errors)"
fi
echo ""

# 8. TypeScript Check
echo "📝 TypeScript Check:"
if npx tsc --noEmit > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} TypeScript compilation (success)"
else
  echo -e "${RED}✗${NC} TypeScript compilation (errors found)"
fi
echo ""

echo "======================================"
echo "✅ Pre-deployment validation complete!"
echo ""
echo "Next steps:"
echo "1. Review ARCSLOTS_SETUP.md for Supabase setup"
echo "2. Create database tables from provided SQL"
echo "3. Deploy ArcSlots contract to Arc Testnet"
echo "4. Update ARCSLOTS_ADDRESS in constants"
echo "5. Add navigation link to dashboard"
echo "6. Push to GitHub and verify Vercel deploy"
echo ""
echo "Documentation:"
echo "- Architecture: ARCSLOTS_ARCHITECTURE.md"
echo "- Setup: ARCSLOTS_SETUP.md"
echo "- Integration: ARCSLOTS_INTEGRATION.md"
echo ""
