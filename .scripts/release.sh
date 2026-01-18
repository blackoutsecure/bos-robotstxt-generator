#!/bin/bash

# Release script for bos-robotstxt-generator
# Usage: npm run release -- v1.2.3

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Usage: npm run release -- v1.2.3"
  exit 1
fi

# Remove 'v' prefix if present
VERSION=${VERSION#v}

# Validate version format (semver)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Invalid version format. Expected: 1.2.3"
  exit 1
fi

echo "📦 Releasing v$VERSION..."
echo ""

# Check if git is clean
if ! git diff-index --quiet HEAD --; then
  echo "❌ Git working directory is not clean. Commit changes first."
  exit 1
fi

# Update package.json version
echo "1️⃣  Updating package.json to v$VERSION..."
npm version $VERSION --no-git-tag-v

# Rebuild dist/
echo "2️⃣  Building dist/..."
npm run build

# Commit changes
echo "3️⃣  Committing changes..."
git add package.json package-lock.json dist/
git commit -m "chore: release v$VERSION"

# Create and push tag
echo "4️⃣  Creating git tag v$VERSION..."
git tag -a v$VERSION -m "Release v$VERSION"
git push origin main
git push origin v$VERSION

# Create moving major version tag
MAJOR=$(echo $VERSION | cut -d. -f1)
echo "5️⃣  Creating moving tag v$MAJOR..."
git tag -f v$MAJOR v$VERSION
git push -f origin v$MAJOR

echo ""
echo "✅ Successfully released v$VERSION"
echo ""
echo "📝 Next steps:"
echo "1. Go to: https://github.com/blackoutsecure/bos-robotstxt-generator/releases"
echo "2. Draft a new release for tag v$VERSION"
echo "3. Check 'Publish this Action to the GitHub Marketplace'"
echo "4. Select category: Deployment or Continuous Integration"
echo "5. Publish the release"
