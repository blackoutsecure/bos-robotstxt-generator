// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// robots.txt content builder shared by the Action and the CLI.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const { normalizeUrl } = require('./utils');
const { getRobotsTxtHeader } = require('./project-config');

/**
 * Ensure a robots.txt path value starts with `/` (wildcards pass through).
 * @param {string} input - Raw path prefix.
 * @returns {string} Normalised path prefix.
 */
function ensureLeadingSlash(input) {
  if (!input) return input;
  return input.startsWith('/') || input.startsWith('*') ? input : `/${input}`;
}

/**
 * Build robots.txt content from one or more user-agent groups.
 *
 * @param {object} options - Build options.
 * @param {Array<object>} options.groups - Groups of `{userAgent, allow, disallow, crawlDelay}`.
 * @param {string[]} [options.sitemaps] - Absolute sitemap URLs.
 * @param {boolean} [options.includeComments] - Emit the branded header.
 * @returns {string} robots.txt content.
 */
function buildRobotsTxt({ groups = [], sitemaps = [], includeComments = false }) {
  let content = includeComments ? getRobotsTxtHeader() : '';

  const records = groups.length ? groups : [{ userAgent: '*', allow: [], disallow: [] }];

  for (const group of records) {
    content += `\nUser-agent: ${group.userAgent}\n`;

    const allow = (group.allow || []).map(ensureLeadingSlash).filter(Boolean);
    const disallow = (group.disallow || []).map(ensureLeadingSlash).filter(Boolean);

    if (!allow.length && !disallow.length) {
      // An empty Disallow is the canonical "crawl everything" record.
      content += 'Disallow:\n';
    } else {
      for (const value of allow) content += `Allow: ${value}\n`;
      for (const value of disallow) content += `Disallow: ${value}\n`;
    }

    if (group.crawlDelay) content += `Crawl-delay: ${group.crawlDelay}\n`;
  }

  if (sitemaps.length) {
    content += '\n';
    for (const url of sitemaps) content += `Sitemap: ${url}\n`;
  }

  return content;
}

/**
 * Resolve the Sitemap directive values for a run.
 *
 * @param {object} options - Resolution options.
 * @param {string} options.siteUrl - Public base URL.
 * @param {boolean} options.includeSitemap - Emit the conventional sitemap.
 * @param {string} options.sitemapFilename - Conventional sitemap filename.
 * @param {string[]} [options.extra] - Additional URLs or site-relative paths.
 * @returns {string[]} De-duplicated absolute sitemap URLs.
 */
function resolveSitemaps({ siteUrl, includeSitemap, sitemapFilename, extra = [] }) {
  const urls = [];

  if (includeSitemap && sitemapFilename) {
    urls.push(normalizeUrl(siteUrl, ensureLeadingSlash(sitemapFilename)));
  }

  for (const value of extra) {
    if (/^https?:\/\//i.test(value)) urls.push(value);
    else urls.push(normalizeUrl(siteUrl, ensureLeadingSlash(value)));
  }

  return [...new Set(urls)];
}

module.exports = {
  buildRobotsTxt,
  resolveSitemaps,
  ensureLeadingSlash,
};
