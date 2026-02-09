#!/bin/bash

set -e

STORAGE_ACCOUNT="${1:-quillbotstoragedev}"
CONFIG_SHARE="${2:-opencode-config}"

echo "Uploading OpenCode config to Azure Files..."
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Share Name: $CONFIG_SHARE"
echo ""

echo "1. Uploading opencode.json..."
az storage file upload \
  --account-name "$STORAGE_ACCOUNT" \
  --share-name "$CONFIG_SHARE" \
  --source opencode-config/opencode.json \
  --path opencode.json

echo "✓ opencode.json uploaded"
echo ""

echo "2. Creating commands directory..."
az storage directory create \
  --account-name "$STORAGE_ACCOUNT" \
  --share-name "$CONFIG_SHARE" \
  --name commands \
  2>/dev/null || echo "Directory already exists"

echo "3. Uploading command definitions..."
for file in opencode-config/commands/*.md; do
  filename=$(basename "$file")
  echo "  - $filename"
  az storage file upload \
    --account-name "$STORAGE_ACCOUNT" \
    --share-name "$CONFIG_SHARE" \
    --source "$file" \
    --path "commands/$filename"
done

echo "✓ Commands uploaded"
echo ""

echo "4. Creating github-copilot directory..."
az storage directory create \
  --account-name "$STORAGE_ACCOUNT" \
  --share-name "$CONFIG_SHARE" \
  --name github-copilot \
  2>/dev/null || echo "Directory already exists"

echo "5. Uploading GitHub Copilot auth..."
if [ -f "opencode-config/github-copilot/hosts.json" ]; then
  az storage file upload \
    --account-name "$STORAGE_ACCOUNT" \
    --share-name "$CONFIG_SHARE" \
    --source opencode-config/github-copilot/hosts.json \
    --path github-copilot/hosts.json
  echo "✓ GitHub Copilot auth uploaded"
else
  echo "⚠ Warning: opencode-config/github-copilot/hosts.json not found"
  echo "  GitHub Copilot authentication will not work without this file"
fi

echo ""
echo "✓ Upload complete!"
echo ""
echo "Verify the structure:"
echo "  az storage file list --account-name $STORAGE_ACCOUNT --share-name $CONFIG_SHARE --output table"
