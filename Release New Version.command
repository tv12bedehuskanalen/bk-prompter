#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$PROJECT_DIR"

# Every release increments x.y.z by one patch version (0.0.01).
npm version patch --no-git-tag-version
VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

command -v gh >/dev/null 2>&1 || { echo "Installer GitHub CLI først: brew install gh"; read -r -p "Trykk Enter for å lukke..." _; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Logg inn i GitHub først: gh auth login"; read -r -p "Trykk Enter for å lukke..." _; exit 1; }
if git rev-parse "$TAG" >/dev/null 2>&1 || git ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1; then
  echo "Taggen $TAG finnes allerede."; read -r -p "Trykk Enter for å lukke..." _; exit 1
fi

npm run check
npm test
git add package.json package-lock.json README.md server public desktop config
git commit -m "Release $TAG"
git push origin main
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"
gh release create "$TAG" --title "$TAG" --generate-notes
for artifact in dist/*; do
  [[ -f "$artifact" ]] && gh release upload "$TAG" "$artifact" --clobber
done
echo "Publiserte $TAG. Bygg og last opp desktop-artifakter med npm run dist:mac og npm run dist:win."
read -r -p "Trykk Enter for å lukke..." _
