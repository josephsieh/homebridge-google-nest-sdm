#!/usr/bin/env bash
set -euo pipefail

# Verify clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: Working tree or staging area has uncommitted changes. Please commit or stash first."
  exit 1
fi

echo "Fetching upstream (no tags)..."
git fetch upstream --no-tags

echo ""
echo "Incoming upstream commits:"
git log --oneline --no-merges HEAD..upstream/master || true

if [ -z "$(git rev-list HEAD..upstream/master)" ]; then
  echo ""
  echo "Already up to date with upstream/master."
  exit 0
fi

branch="sync/upstream-$(date +%Y%m%d)"
echo ""
echo "Creating sync branch: $branch"
git switch -c "$branch"

echo "Attempting merge with upstream/master..."
if ! git merge --no-ff --no-commit upstream/master; then
  echo "Resolving untracked dist/ files automatically..."
  # dist/ is untracked in this fork: drop any incoming upstream dist changes
  dist_unmerged="$(git ls-files -u -- dist 2>/dev/null | cut -f2 | sort -u || true)"
  if [ -n "$dist_unmerged" ]; then
    echo "$dist_unmerged" | xargs git rm -q --cached --ignore-unmatch 2>/dev/null || true
  fi
  dist_tracked="$(git ls-files -- dist 2>/dev/null || true)"
  if [ -n "$dist_tracked" ]; then
    echo "$dist_tracked" | xargs git rm -q --cached 2>/dev/null || true
  fi
fi

echo ""
echo "Remaining conflicts to resolve manually using FORK.md ledger:"
git diff --name-only --diff-filter=U || true

echo ""
echo "Next steps:"
echo "  1. Resolve remaining conflicts in src/ and package.json according to FORK.md."
echo "  2. Run 'npm run build' to verify compilation."
echo "  3. Stage resolved files with 'git add <files>'."
echo "  4. Commit merge: git commit -m \"Merge remote-tracking branch 'upstream/master'\""
echo "  5. Update the 'Last synced' commit hash in FORK.md."
echo "  6. Switch back to master and merge $branch: git checkout master && git merge $branch"
