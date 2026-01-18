// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// Website: https://blackoutsecure.app
// Repository: https://github.com/blackoutsecure/bos-robotstxt-generator
// Issues: https://github.com/blackoutsecure/bos-robotstxt-generator/issues
// Docs: https://github.com/blackoutsecure/bos-robotstxt-generator#readme
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTML parsing helpers for canonical URLs and internal link discovery
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const fs = require('fs');
const { parse: parseHtml } = require('node-html-parser');

/**
 * Extract canonical URL from HTML file
 * @param {string} htmlPath - Path to HTML file
 * @returns {string|null} - Canonical URL or null
 */
function extractCanonicalUrl(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const root = parseHtml(html);
    const linkCanonical = root.querySelector('link[rel="canonical"]');
    return linkCanonical?.getAttribute('href') || null;
  } catch {
    return null;
  }
}

/**
 * Discover internal links from HTML file
 * @param {string} htmlPath - Path to HTML file
 * @returns {string[]} - Array of internal link hrefs
 */
function discoverInternalLinks(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const root = parseHtml(html);
    const anchors = root.querySelectorAll('a[href]') || [];
    const links = [];

    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href) continue;
      // Skip external links
      if (/^https?:\/\//i.test(href)) continue;
      // Skip anchor links
      if (href.startsWith('#')) continue;
      links.push(href);
    }

    return links;
  } catch {
    return [];
  }
}

module.exports = {
  extractCanonicalUrl,
  discoverInternalLinks,
};
