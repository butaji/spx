#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWIFT_DIR="${SCRIPT_DIR}/swift/SPX"

# Load .env if present
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Error: SPX is a macOS app. It can only run on macOS." >&2
    exit 1
fi

# Run linter
echo "Linting..."
cd "${SWIFT_DIR}"
if command -v swiftlint &> /dev/null; then
    if ! swiftlint lint --quiet --config .swiftlint.yml; then
        echo "Error: Lint violations found. Fix them before building." >&2
        exit 1
    fi
    echo "Lint passed!"
else
    echo "Warning: swiftlint not installed. Install with: brew install swiftlint" >&2
fi

echo ""
echo "Building SPX..."

if ! command -v swift &> /dev/null; then
    echo "Error: Swift is not installed. Install Xcode or Command Line Tools." >&2
    exit 1
fi

swift build

echo ""
echo "Running SPX..."
exec "${SWIFT_DIR}/.build/debug/SPX" "$@"
