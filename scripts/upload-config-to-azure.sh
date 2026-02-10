#!/bin/bash

set -euo pipefail
shopt -s globstar nullglob

STORAGE_ACCOUNT="${1:-quillbotstoragedev}"
CONFIG_SHARE="${2:-opencode-config}"
CONFIG_ROOT="opencode-config/opencode"
OPENCODE_CONFIG_FILE="$CONFIG_ROOT/opencode.json"

upload_file() {
  local source_path="$1"
  local destination_path="$2"

  az storage file upload \
    --account-name "$STORAGE_ACCOUNT" \
    --share-name "$CONFIG_SHARE" \
    --source "$source_path" \
    --path "$destination_path" \
    >/dev/null

  echo "  - $destination_path"
}

ensure_remote_directory() {
  local directory_path="$1"
  local current_path=""
  local segment

  IFS='/' read -r -a path_segments <<< "$directory_path"

  for segment in "${path_segments[@]}"; do
    if [ -z "$segment" ]; then
      continue
    fi

    if [ -z "$current_path" ]; then
      current_path="$segment"
    else
      current_path="$current_path/$segment"
    fi

    az storage directory create \
      --account-name "$STORAGE_ACCOUNT" \
      --share-name "$CONFIG_SHARE" \
      --name "$current_path" \
      >/dev/null 2>&1 || true
  done
}

upload_directory_tree() {
  local source_dir="$1"
  local destination_prefix="$2"
  local required="$3"
  local uploaded_count=0
  local file_path

  if [ ! -d "$source_dir" ]; then
    if [ "$required" = "true" ]; then
      echo "✗ Required directory missing: $source_dir"
      exit 1
    fi

    echo "Skipping missing directory: $source_dir"
    return
  fi

  echo "Uploading $destination_prefix/** from $source_dir"

  for file_path in "$source_dir"/**/*; do
    if [ ! -f "$file_path" ]; then
      continue
    fi

    local relative_path="${file_path#"$source_dir"/}"
    local destination_path="$destination_prefix/$relative_path"
    local destination_dir
    destination_dir=$(dirname "$destination_path")

    if [ "$destination_dir" != "." ]; then
      ensure_remote_directory "$destination_dir"
    fi

    upload_file "$file_path" "$destination_path"
    uploaded_count=$((uploaded_count + 1))
  done

  if [ "$required" = "true" ] && [ "$uploaded_count" -eq 0 ]; then
    echo "✗ No files found in required directory: $source_dir"
    exit 1
  fi

  echo "✓ Uploaded $uploaded_count file(s) to $destination_prefix"
  echo ""
}

delete_remote_file_if_exists() {
  local remote_path="$1"

  if az storage file delete \
    --account-name "$STORAGE_ACCOUNT" \
    --share-name "$CONFIG_SHARE" \
    --path "$remote_path" \
    >/dev/null 2>&1; then
    echo "  - deleted $remote_path"
  else
    echo "  - not present: $remote_path"
  fi
}

if [ ! -f "$OPENCODE_CONFIG_FILE" ]; then
  echo "✗ Missing required config file: $OPENCODE_CONFIG_FILE"
  exit 1
fi

echo "Uploading OpenCode config to Azure Files..."
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Share Name: $CONFIG_SHARE"
echo ""

echo "1. Removing secret/deprecated auth files from config share..."
delete_remote_file_if_exists "auth.json"
delete_remote_file_if_exists "github-copilot/hosts.json"
delete_remote_file_if_exists "github-copilot/auth.json"
echo ""

echo "2. Uploading opencode.json..."
upload_file "$OPENCODE_CONFIG_FILE" "opencode.json"
echo ""

echo "3. Uploading command, agent, and skill files..."
upload_directory_tree "$CONFIG_ROOT/commands" "commands" "true"
upload_directory_tree "$CONFIG_ROOT/agents" "agents" "true"
upload_directory_tree "$CONFIG_ROOT/skills" "skills" "true"

echo "✓ Upload complete!"
echo ""
echo "Verify the structure:"
echo "  az storage file list --account-name $STORAGE_ACCOUNT --share-name $CONFIG_SHARE --output table"
