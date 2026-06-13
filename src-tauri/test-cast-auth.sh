#!/bin/bash
# Test Cast auth protocol on a real device
# Usage: ./test-cast-auth.sh <DEVICE_IP>

set -e

IP=${1:-""}
if [ -z "$IP" ]; then
    echo "Usage: ./test-cast-auth.sh <DEVICE_IP>"
    echo "Example: ./test-cast-auth.sh 192.168.1.11"
    echo ""
    echo "Available devices (from mDNS):"
    timeout 5 dns-sd -Z _googlecast._tcp local. 2>/dev/null | grep "SRV" | awk '{print $1}' | sed 's/_googlecast._tcp.local.//' | sed 's/^/  - /' || true
    exit 1
fi

# Get token from SPX auth storage
AUTH_FILE="$HOME/Library/Application Support/com.spx.app/spotify-auth.bin"
if [ ! -f "$AUTH_FILE" ]; then
    echo "❌ No auth file found at $AUTH_FILE"
    echo "   Please log in to SPX first"
    exit 1
fi

TOKEN=$(python3 -c "
import json
with open('$AUTH_FILE') as f:
    d = json.load(f)
    print(d['spx_spotify_token']['access_token'])
" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Could not extract token from auth file"
    exit 1
fi

echo "Token: ${TOKEN:0:30}..."
echo ""

# Run the test
cd "$(dirname "$0")"
cargo run --bin cast-auth-test -- "$IP" "$TOKEN"
