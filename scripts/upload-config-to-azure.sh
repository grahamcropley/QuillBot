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
  --source opencode-config/opencode/opencode.json \
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
for file in opencode-config/opencode/commands/*.md; do
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

echo "4. Removing deprecated github-copilot auth file from config share..."
az storage file delete \
  --account-name "$STORAGE_ACCOUNT" \
  --share-name "$CONFIG_SHARE" \
  --path github-copilot/hosts.json \
  2>/dev/null || echo "No deprecated github-copilot/hosts.json found"

echo "✓ Config share contains non-secret files only"

echo ""
echo "✓ Upload complete!"
echo ""
echo "Verify the structure:"
echo "  az storage file list --account-name $STORAGE_ACCOUNT --share-name $CONFIG_SHARE --output table"
