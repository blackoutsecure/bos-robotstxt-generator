// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// Website: https://blackoutsecure.app
// Repository: https://github.com/blackoutsecure/bos-robotstxt-generator
// Issues: https://github.com/blackoutsecure/bos-robotstxt-generator/issues
// Docs: https://github.com/blackoutsecure/bos-robotstxt-generator#readme
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Robots.txt parsing helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

/** Directives RFC 9309 and the major crawlers recognise, lowercased. */
const KNOWN_DIRECTIVES = Object.freeze([
  'user-agent',
  'allow',
  'disallow',
  'sitemap',
  'crawl-delay',
  'host',
  'clean-param',
]);

/** Directives that belong to the file, not to a user-agent group. */
const GLOBAL_DIRECTIVES = Object.freeze(['sitemap', 'host']);

/**
 * Parse robots.txt into user-agent groups and file-level directives.
 *
 * Consecutive `User-agent` lines share the record that follows them, per
 * RFC 9309 grouping, so each returned group carries every agent it applies
 * to alongside its rules.
 *
 * @param {string} content - Raw robots.txt content.
 * @returns {object} `{ groups, sitemaps, unknownDirectives, malformedLines, hasBom }`
 */
function parseRobotsTxt(content = '') {
  const hasBom = content.charCodeAt(0) === 0xfeff;
  const body = hasBom ? content.slice(1) : content;

  const groups = [];
  const sitemaps = [];
  const unknownDirectives = [];
  const malformedLines = [];

  let current = null;
  let expectingAgents = false;

  body.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) return;

    const separator = line.indexOf(':');
    if (separator <= 0) {
      malformedLines.push({ line: index + 1, text: line });
      return;
    }

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (!KNOWN_DIRECTIVES.includes(name)) {
      if (!unknownDirectives.includes(name)) unknownDirectives.push(name);
      return;
    }

    if (GLOBAL_DIRECTIVES.includes(name)) {
      if (name === 'sitemap' && value) sitemaps.push(value);
      return;
    }

    if (name === 'user-agent') {
      if (!expectingAgents || !current) {
        current = { userAgents: [], allow: [], disallow: [], crawlDelay: '' };
        groups.push(current);
        expectingAgents = true;
      }
      current.userAgents.push(value);
      return;
    }

    if (!current) {
      // A rule before any User-agent line has no record to attach to.
      malformedLines.push({ line: index + 1, text: line });
      return;
    }

    expectingAgents = false;
    if (name === 'allow') current.allow.push(value);
    else if (name === 'disallow') current.disallow.push(value);
    else if (name === 'crawl-delay') current.crawlDelay = value;
  });

  return { groups, sitemaps, unknownDirectives, malformedLines, hasBom };
}

module.exports = {
  readRobotsDisallows,
  isPathDisallowed,
  matchesPattern,
  parseRobotsTxt,
  KNOWN_DIRECTIVES,
  GLOBAL_DIRECTIVES,
};
