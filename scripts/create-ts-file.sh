#!/bin/bash
# Script to create a new TypeScript file with copyright header

if [ $# -eq 0 ]; then
    echo "Usage: ./scripts/create-ts-file.sh <filename>"
    echo "Example: ./scripts/create-ts-file.sh src/newFeature.ts"
    exit 1
fi

FILENAME="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPYRIGHT_HEADER="$SCRIPT_DIR/copyright-header.txt"

# Check if file already exists
if [ -f "$FILENAME" ]; then
    echo "Error: File $FILENAME already exists"
    exit 1
fi

# Create directory if it doesn't exist
mkdir -p "$(dirname "$FILENAME")"

# Create the file with copyright header
cat "$COPYRIGHT_HEADER" > "$FILENAME"
echo "" >> "$FILENAME"
echo "" >> "$FILENAME"

echo "✅ Created $FILENAME with copyright header"
echo "💡 You can now edit the file to add your code"