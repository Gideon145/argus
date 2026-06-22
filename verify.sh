#!/bin/bash
# Argus End-to-End Verifier
# Judges: run this script against the live deployment to verify every endpoint.
# Usage: bash verify.sh
# Requires: curl, jq (optional — falls back to grep)

set -e

AGENT_URL="${ARGUS_AGENT_URL:-https://argus-agent-production-ab97.up.railway.app}"
PASS=0
FAIL=0
TOTAL=0

green() { echo -e "\033[32m✓ $1\033[0m"; }
red()   { echo -e "\033[31m✗ $1\033[0m"; }

check() {
  TOTAL=$((TOTAL + 1))
  local label="$1"
  local condition="$2"
  if eval "$condition"; then
    green "$label"
    PASS=$((PASS + 1))
  else
    red "$label"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo " Argus E2E Verifier"
echo " Agent: $AGENT_URL"
echo " $(date)"
echo "========================================"
echo ""

# ── Core Health ──
echo "── Core Health ──"

HEALTH=$(curl -sS "$AGENT_URL/health" 2>/dev/null || echo '{"status":"down"}')
check "/health responds ok"          'echo "$HEALTH" | grep -q "ok"'
check "/health shows agent=Argus"   'echo "$HEALTH" | grep -q "Argus"'

# ── Stats ──
echo ""
echo "── Statistics ──"

STATS=$(curl -sS "$AGENT_URL/stats" 2>/dev/null || echo '{}')
check "/stats returns queries > 0"       'echo "$STATS" | grep -qE "\"queries\":[1-9]"'
check "/stats returns consensusReached"   'echo "$STATS" | grep -q "consensusReached"'
check "/stats returns avgConfidence"      'echo "$STATS" | grep -q "avgConfidence"'
check "/stats status is live"             'echo "$STATS" | grep -q "live"'

# ── ELO Reputation ──
echo ""
echo "── ELO Reputation ──"

ELO=$(curl -sS "$AGENT_URL/elo" 2>/dev/null || echo '{}')
check "/elo returns agents array"    'echo "$ELO" | grep -q "agents"'
check "/elo has Agent-α"             'echo "$ELO" | grep -q "Agent-α"'
check "/elo has Agent-β"             'echo "$ELO" | grep -q "Agent-β"'
check "/elo has Agent-γ"             'echo "$ELO" | grep -q "Agent-γ"'
check "/elo agents have ELO scores"  'echo "$ELO" | grep -qE "\"elo\":[1-9]"'

# ── On-Chain ELO ──
echo ""
echo "── On-Chain ELO ──"

CELO=$(curl -sS "$AGENT_URL/chain-elo" 2>/dev/null || echo '{}')
check "/chain-elo returns agents"     'echo "$CELO" | grep -q "agents"'
check "/chain-elo has oracle address" 'echo "$CELO" | grep -q "0x563b2DA572"'

# ── Treasury ──
echo ""
echo "── Treasury ──"

TREASURY=$(curl -sS "$AGENT_URL/treasury" 2>/dev/null || echo '{}')
check "/treasury returns treasury balance"  'echo "$TREASURY" | grep -q "balance"'
check "/treasury returns funding balance"   'echo "$TREASURY" | grep -q "funding"'
check "/treasury has ArcScan links"          'echo "$TREASURY" | grep -q "arcscan"'

# ── Agent-to-Agent Payments ──
echo ""
echo "── Agent Payments ──"

PAYMENTS=$(curl -sS "$AGENT_URL/agent-payments" 2>/dev/null || echo '{}')
check "/agent-payments returns totalPayments"  'echo "$PAYMENTS" | grep -q "totalPayments"'
check "/agent-payments returns totalVolume"     'echo "$PAYMENTS" | grep -q "totalVolume"'

# ── Wallet Pool ──
echo ""
echo "── Wallet Pool ──"

POOL=$(curl -sS "$AGENT_URL/wallet/pool-stats" 2>/dev/null || echo '{}')
check "/wallet/pool-stats returns total"    'echo "$POOL" | grep -q "total"'
check "/wallet/pool-stats returns assigned" 'echo "$POOL" | grep -q "assigned"'
check "/wallet/pool-stats returns available"'echo "$POOL" | grep -q "available"'
check "/wallet/pool-stats has wallets > 0"  'echo "$POOL" | grep -qE "\"total\":[1-9]"'

# ── History ──
echo ""
echo "── Scan History ──"

HISTORY=$(curl -sS "$AGENT_URL/history" 2>/dev/null || echo '[]')
check "/history returns array"            'echo "$HISTORY" | grep -qE "^\["'
check "/history has entries"              'echo "$HISTORY" | grep -q "address"'

# ── Scan (debug) ──
echo ""
echo "── Scan (debug) ──"

SCAN=$(curl -sS -X POST "$AGENT_URL/debug/scan" \
  -H "Content-Type: application/json" \
  -d '{"contractAddress":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"arc","threshold":2}' 2>/dev/null || echo '{}')
check "/debug/scan returns verdict"       'echo "$SCAN" | grep -q "verdict"'
check "/debug/scan returns agents"         'echo "$SCAN" | grep -q "agents"'
check "/debug/scan returns consensus"      'echo "$SCAN" | grep -q "consensus"'
check "/debug/scan has 3 agents"           'echo "$SCAN" | grep -qE "Agent-α.*Agent-β.*Agent-γ"'
check "/debug/scan verdict is SAFE (USDC)" 'echo "$SCAN" | grep -q "SAFE"'

# ── Configurable Threshold ──
echo ""
echo "── Configurable Threshold ──"

SCAN3=$(curl -sS -X POST "$AGENT_URL/debug/scan" \
  -H "Content-Type: application/json" \
  -d '{"contractAddress":"0x6B175474E89094C44Da98b954EedeAC495271d0F","chain":"arc","threshold":3}' 2>/dev/null || echo '{}')
check "3/3 threshold scan returns verdict"  'echo "$SCAN3" | grep -q "verdict"'
check "3/3 threshold scan includes agreement count" 'echo "$SCAN3" | grep -q "agreementCount"'

# ── Summary ──
echo ""
echo "========================================"
if [ $FAIL -eq 0 ]; then
  echo -e " \033[32m$PASS/$TOTAL passed — ALL CHECKS GREEN\033[0m"
  echo "========================================"
  echo ""
  echo "Argus is fully operational."
  echo "  Live: https://argusarc.xyz"
  echo "  Repo: https://github.com/Gideon145/argus"
  echo "  Oracle: https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8"
  exit 0
else
  echo -e " \033[31m$PASS/$TOTAL passed — $FAIL FAILED\033[0m"
  echo "========================================"
  exit 1
fi
