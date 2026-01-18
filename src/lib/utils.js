/**
 * Copyright 2025 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * General utility functions for sitemap generation
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// URL Utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Normalize a URL by combining base URL and relative path
 * @param {string} base - Base URL (e.g., 'https://example.com')
 * @param {string} rel - Relative path (e.g., '/page.html')
 * @returns {string} - Normalized URL
 */
function normalizeUrl(base, rel) {
  if (!base.endsWith('/')) base += '/';
  return new URL(rel.replace(/^\./, ''), base).toString();
}

/**
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// File System Utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size (e.g., "1.5 MB")
 */
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Find the public/build directory from common candidates
 * @param {string} candidateInput - User-provided directory hint
 * @returns {string|null} - Detected directory path or null
 */
function findPublicDir(candidateInput) {
  const candidates = [];
  if (candidateInput) candidates.push(candidateInput);
  candidates.push('dist', 'build', 'out', 'public', 'website', 'static');
  const existing = candidates.filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
  if (!existing.length) return null;
  // Prefer ones containing index.html at root or many html files
  const scored = existing.map((d) => {
    const files = glob.sync('**/*.html', { cwd: d, nodir: true, dot: false });
    const hasIndex = fs.existsSync(path.join(d, 'index.html'));
    const score = (hasIndex ? 1000 : 0) + files.length;
    return { dir: d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.dir || existing[0];
}

/**
 * Infer site URL from CNAME or GitHub Pages convention
 * @param {string} publicDir - Public directory path
 * @returns {string|null} - Inferred site URL or null
 */
function inferSiteUrl(publicDir) {
  // Try CNAME in publicDir
  try {
    const cnamePath = publicDir ? path.join(publicDir, 'CNAME') : 'CNAME';
    if (fs.existsSync(cnamePath)) {
      const domain = fs.readFileSync(cnamePath, 'utf8').trim();
      if (domain) return `https://${domain.replace(/\s+/g, '')}`;
    }
  } catch {
    // Ignore CNAME read errors
  }
  // Try GitHub Pages format from repo env
  const repo = process.env.GITHUB_REPOSITORY || '';
  const [owner, repoName] = repo.split('/');
  if (owner) {
    if (repoName && repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
      return `https://${owner}.github.io/`;
    }
    if (repoName) {
      return `https://${owner}.github.io/${repoName}/`;
    }
  }
  return null;
}

module.exports = {
  // URL utilities
  normalizeUrl,
  // File system utilities
  formatFileSize,
  findPublicDir,
  inferSiteUrl,
};
