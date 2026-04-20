#!/bin/sh
# Run once after cloning to activate the project git hooks.
# This configures git to use the tracked .githooks/ directory
# instead of the default .git/hooks/ directory.
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.githooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "  .githooks/ directory not found. Are you in the right repo?"
  exit 1
fi

git config core.hooksPath "$HOOKS_DIR"
echo "  Git hooks configured -> $HOOKS_DIR"
echo "  Active hooks:"
for hook in "$HOOKS_DIR"/*; do
  echo "    - $(basename $hook)"
done
echo ""
echo "  You're all set. Direct pushes to dev/main are blocked locally."
echo "  AI attributions in commit messages are blocked locally."
