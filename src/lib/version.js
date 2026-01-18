#!/usr/bin/env node
/**
 * Version Management Script
 * Automatically syncs version across package.json and project-config.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const PROJECT_CONFIG_PATH = path.join(ROOT_DIR, 'src', 'lib', 'project-config.js');

/**
 * Read and parse package.json
 */
function readPackageJson() {
  const content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  return JSON.parse(content);
}

/**
 * Write package.json
 */
function writePackageJson(pkg) {
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

/**
 * Update version in project-config.js
 */
function updateProjectConfig(version) {
  let content = fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8');
  content = content.replace(/version:\s*['"][\d.]+['"]/, `version: '${version}'`);
  fs.writeFileSync(PROJECT_CONFIG_PATH, content, 'utf8');
}

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  const pkg = readPackageJson();
  return pkg.version;
}

/**
 * Set version in both files
 */
function setVersion(version) {
  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('❌ Invalid version format. Expected: x.y.z (e.g., 1.2.3)');
    process.exit(1);
  }

  // Update package.json
  const pkg = readPackageJson();
  pkg.version = version;
  writePackageJson(pkg);

  // Update project-config.js
  updateProjectConfig(version);

  console.log(`✅ Version updated to ${version}`);
  console.log(`   - ${PACKAGE_JSON_PATH}`);
  console.log(`   - ${PROJECT_CONFIG_PATH}`);
}

/**
 * Increment version by type
 */
function incrementVersion(type = 'patch') {
  const current = getCurrentVersion();
  const parts = current.split('.').map(Number);

  switch (type) {
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
    default:
      console.error('❌ Invalid increment type. Use: major, minor, or patch');
      process.exit(1);
  }

  const newVersion = parts.join('.');
  setVersion(newVersion);
  return newVersion;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Current version:', getCurrentVersion());
    console.log('\nUsage:');
    console.log('  node src/lib/version.js get              - Get current version');
    console.log('  node src/lib/version.js set <version>    - Set specific version');
    console.log('  node src/lib/version.js patch            - Increment patch (x.y.Z)');
    console.log('  node src/lib/version.js minor            - Increment minor (x.Y.0)');
    console.log('  node src/lib/version.js major            - Increment major (X.0.0)');
    process.exit(0);
  }

  switch (command) {
    case 'get':
      console.log(getCurrentVersion());
      break;

    case 'set':
      if (!args[1]) {
        console.error('❌ Version required. Usage: node src/lib/version.js set 1.2.3');
        process.exit(1);
      }
      setVersion(args[1]);
      break;

    case 'patch':
    case 'minor':
    case 'major':
      incrementVersion(command);
      break;

    default:
      console.error('❌ Unknown command:', command);
      process.exit(1);
  }
}

module.exports = { getCurrentVersion, setVersion, incrementVersion };
