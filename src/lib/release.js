#!/usr/bin/env node
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// Website: https://blackoutsecure.app
// Repository: https://github.com/blackoutsecure/bos-robotstxt-generator
// Issues: https://github.com/blackoutsecure/bos-robotstxt-generator/issues
// Docs: https://github.com/blackoutsecure/bos-robotstxt-generator#readme
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Release workflow script (version bump, build, test, tag, push)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const { execSync } = require('child_process');
const { setVersion, getCurrentVersion } = require('./version');

/**
 * Execute command and log output
 */
function exec(command, options = {}) {
  console.log(`  $ ${command}`);
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch {
    console.error(`❌ Command failed: ${command}`);
    process.exit(1);
  }
}

/**
 * Check if git working directory is clean
 */
function checkGitClean() {
  try {
    execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Release workflow
 */
function release(versionType = null) {
  console.log(`📦 Starting release process...`);
  console.log();

  // Check git status FIRST before making any changes
  if (!checkGitClean()) {
    console.error('❌ Git working directory is not clean. Commit changes first.');
    process.exit(1);
  }

  let version;

  // Determine version to release
  if (versionType && /^\d+\.\d+\.\d+$/.test(versionType)) {
    version = versionType;
  } else if (versionType && ['patch', 'minor', 'major'].includes(versionType)) {
    // Calculate what the new version would be
    const current = getCurrentVersion();
    const parts = current.split('.').map(Number);
    switch (versionType) {
      case 'major':
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
        break;
      case 'minor':
        parts[1]++;
        parts[2] = 0;
        break;
      case 'patch':
        parts[2]++;
        break;
    }
    version = parts.join('.');
  } else {
    version = getCurrentVersion();
  }

  console.log(`📦 Releasing v${version}...`);
  console.log();

  // Update version
  console.log(`1️⃣  Updating version to ${version}...`);
  setVersion(version);
  console.log();

  // Build
  console.log('2️⃣  Building dist/...');
  exec('npm run build');
  console.log();

  // Run tests
  console.log('3️⃣  Running tests...');
  exec('npm test');
  console.log();

  // Commit changes
  console.log('4️⃣  Committing changes...');
  exec('git add package.json package-lock.json src/lib/project-config.js dist/');
  exec(`git commit -m "chore: release v${version}"`);
  console.log();

  // Create tag
  console.log(`5️⃣  Creating git tag v${version}...`);
  exec(`git tag -a v${version} -m "Release v${version}"`);
  console.log();

  // Push
  console.log('6️⃣  Pushing to remote...');
  exec('git push origin main');
  exec(`git push origin v${version}`);
  console.log();

  // Create moving major version tag
  const major = version.split('.')[0];
  console.log(`7️⃣  Creating moving tags v${major} and latest...`);
  exec(`git tag -f v${major} v${version}`);
  exec(`git push -f origin v${major}`);
  exec(`git tag -f latest v${version}`);
  exec(`git push -f origin latest`);
  console.log();

  console.log(`✅ Successfully released v${version}`);
  console.log();
  console.log('📝 Users can now reference this action with:');
  console.log(`   - @v${version} (specific version)`);
  console.log(`   - @v${major} (latest v${major}.x.x)`);
  console.log('   - @latest (always latest release)');
  console.log();
  console.log('📝 Next steps:');
  console.log('1. Go to: https://github.com/blackoutsecure/bos-robotstxt-generator/releases');
  console.log(`2. Draft a new release for tag v${version}`);
  console.log("3. Check 'Publish this Action to the GitHub Marketplace'");
  console.log('4. Select category: Deployment or Continuous Integration');
  console.log('5. Publish the release');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  let input = args[0];

  if (!input) {
    console.log('Usage:');
    console.log('  npm run release <version>   - Release specific version (e.g., 1.2.3)');
    console.log('  npm run release patch       - Auto-increment patch and release');
    console.log('  npm run release minor       - Auto-increment minor and release');
    console.log('  npm run release major       - Auto-increment major and release');
    console.log();
    console.log(`Current version: ${getCurrentVersion()}`);
    process.exit(1);
  }

  // Remove 'v' prefix if present
  input = input.replace(/^v/, '');

  release(input);
}

module.exports = { release };
