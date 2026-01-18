/**
 * Copyright 2025 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Robots.txt parsing utilities
 */

const fs = require('fs');

/**
 * Read disallow rules from robots.txt
 * @param {string} robotsPath - Path to robots.txt
 * @returns {string[]} - Array of disallowed paths
 */
function readRobotsDisallows(robotsPath) {
  if (!fs.existsSync(robotsPath)) return [];
  const content = fs.readFileSync(robotsPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const disallows = [];
  let appliesToAll = false;

  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    if (/^User-agent:\s*\*/i.test(l)) {
      appliesToAll = true;
      continue;
    }
    if (appliesToAll) {
      const m = l.match(/^Disallow:\s*(\S*)/i);
      if (m) disallows.push(m[1]);
    }
  }

  return disallows.filter(Boolean);
}

/**
 * Check if a path matches a robots.txt pattern (supports wildcards)
 * @param {string} path - Path to check
 * @param {string} pattern - Robots.txt pattern (may contain * and $)
 * @returns {boolean} - True if path matches pattern
 */
function matchesPattern(path, pattern) {
  if (!pattern) return false;

  // Handle exact root match
  if (pattern === '/') return true;

  // Handle end-of-path marker ($)
  if (pattern.endsWith('$')) {
    const patternWithoutDollar = pattern.slice(0, -1);
    // Convert * to regex wildcard
    const regexPattern = patternWithoutDollar.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  // Handle wildcard (*)
  if (pattern.includes('*')) {
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}`);
    return regex.test(path);
  }

  // Simple prefix matching
  return path.startsWith(pattern);
}

/**
 * Check if a path is disallowed by robots.txt rules
 * @param {string} urlPath - URL path to check
 * @param {string[]} disallows - Array of disallow rules
 * @returns {boolean} - True if path is disallowed
 */
function isPathDisallowed(urlPath, disallows) {
  if (!disallows.length) return false;
  return disallows.some((rule) => matchesPattern(urlPath, rule));
}

module.exports = {
  readRobotsDisallows,
  isPathDisallowed,
  matchesPattern,
};
