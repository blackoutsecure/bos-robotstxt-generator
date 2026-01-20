// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// Website: https://blackoutsecure.app
// Repository: https://github.com/blackoutsecure/bos-robotstxt-generator
// Issues: https://github.com/blackoutsecure/bos-robotstxt-generator/issues
// Docs: https://github.com/blackoutsecure/bos-robotstxt-generator#readme
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Validation helpers for robots.txt, humans.txt, and related outputs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate robots.txt content
 * @param {string} robotsContent - robots.txt text
 * @param {object} options - Validation options
 * @param {boolean} options.strict - If true, promote warnings to errors
 * @param {number} options.maxSizeKB - Maximum recommended size in KB
 * @param {boolean} options.requireSitemap - Whether a Sitemap directive is required
 * @param {string} options.publicDir - Public directory to check for sitemap files
 * @param {string} options.siteUrl - Site URL to determine local vs external sitemaps
 * @returns {Array<{type:'info'|'warning'|'error',message:string}>}
 */
function validateRobotsTxt(
  robotsContent,
  { strict = true, maxSizeKB = 500, requireSitemap = false, publicDir = null, siteUrl = null }
) {
  const results = [];
  try {
    const lines = robotsContent.split(/\r?\n/);

    const sizeKB = Buffer.byteLength(robotsContent, 'utf8') / 1024;
    if (sizeKB > maxSizeKB) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `✗ Exceeds ${maxSizeKB} KB (${sizeKB.toFixed(2)} KB)`,
      });
    } else {
      results.push({
        type: 'info',
        message: `✓ Size OK (${sizeKB.toFixed(2)} KB)`,
      });
    }

    const hasUserAgent = lines.some((line) => /^User-agent:/i.test(line.trim()));
    if (!hasUserAgent) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '✗ Missing required User-agent directive',
      });
    }

    const sitemapLines = lines.filter((line) => /^Sitemap:/i.test(line.trim()));
    if (requireSitemap && sitemapLines.length === 0) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '✗ No Sitemap directive found',
      });
    } else if (sitemapLines.length > 0) {
      const sitemapUrls = new Set();
      let duplicateCount = 0;

      for (const line of sitemapLines) {
        const match = line.match(/^Sitemap:\s*(.+)$/i);
        if (match) {
          const url = match[1].trim();
          if (sitemapUrls.has(url)) {
            duplicateCount++;
          } else {
            sitemapUrls.add(url);
          }
        }
      }

      if (duplicateCount > 0) {
        results.push({
          type: 'warning',
          message: `⚠️  Found ${duplicateCount} duplicate sitemap reference(s)`,
        });
      }

      results.push({
        type: 'info',
        message: `✓ Contains Sitemap reference (${sitemapUrls.size} unique sitemap(s))`,
      });

      let invalidSitemaps = 0;
      for (const url of sitemapUrls) {
        if (!/^https?:\/\//i.test(url)) {
          invalidSitemaps++;
        }
      }
      if (invalidSitemaps > 0) {
        results.push({
          type: 'warning',
          message: `⚠️  ${invalidSitemaps} sitemap URL(s) invalid (must start with http/https)`,
        });
      }

      // Check if sitemap files exist locally
      if (publicDir && siteUrl) {
        const fs = require('fs');
        const path = require('path');
        const missingSitemaps = [];

        for (const url of sitemapUrls) {
          // Only check local sitemaps (those belonging to the site_url domain)
          if (url.startsWith(siteUrl)) {
            // Extract the path from the URL
            const urlPath = url.substring(siteUrl.length);
            const filePath = path.join(publicDir, urlPath);

            if (!fs.existsSync(filePath)) {
              missingSitemaps.push({ url, path: filePath });
            }
          }
        }

        if (missingSitemaps.length > 0) {
          missingSitemaps.forEach(({ url, path: filePath }) => {
            results.push({
              type: 'warning',
              message: `⚠️  Sitemap file not found: ${path.basename(filePath)} (referenced as ${url})`,
            });
          });
        }
      }
    }

    let foundUserAgent = false;
    let foundDirectiveBeforeUserAgent = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (/^User-agent:/i.test(trimmed)) {
        foundUserAgent = true;
      } else if (/^(Disallow|Allow|Crawl-delay):/i.test(trimmed)) {
        if (!foundUserAgent) {
          foundDirectiveBeforeUserAgent = true;
        }
      }
    }

    if (foundDirectiveBeforeUserAgent) {
      results.push({
        type: 'warning',
        message: '⚠️  Directive found before User-agent (may not be applied correctly)',
      });
    }

    const crawlDelayLines = lines.filter((line) => /^Crawl-delay:/i.test(line.trim()));
    for (const line of crawlDelayLines) {
      const match = line.match(/^Crawl-delay:\s*(.+)$/i);
      if (match) {
        const delay = parseFloat(match[1].trim());
        if (!Number.isFinite(delay) || delay < 0) {
          results.push({
            type: 'warning',
            message: `⚠️  Invalid Crawl-delay value: ${match[1]} (must be a non-negative number)`,
          });
        }
      }
    }
  } catch (e) {
    results.push({
      type: strict ? 'error' : 'warning',
      message: `✗ Validation error: ${e.message}`,
    });
  }
  return results;
}

module.exports = { validateRobotsTxt };

/**
 * Validate humans.txt file
 * @param {string} humansContent - Content of humans.txt
 * @param {object} options - Validation options
 * @param {boolean} options.strict - Strict mode (errors vs warnings)
 * @param {number} options.maxSizeKB - Maximum file size in KB
 * @returns {array} - Validation results
 */
function validateHumansTxt(humansContent, { strict, maxSizeKB }) {
  const results = [];
  try {
    // Check file size
    const sizeKB = Buffer.byteLength(humansContent, 'utf8') / 1024;
    if (sizeKB > maxSizeKB) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `      ✗ Exceeds ${maxSizeKB} KB (${sizeKB.toFixed(2)} KB)`,
      });
    } else {
      results.push({
        type: 'info',
        message: `      ✓ Size OK (${sizeKB.toFixed(2)} KB)`,
      });
    }

    // Check for standard sections
    const hasTeamSection = humansContent.includes('/* TEAM */');
    const hasSiteSection = humansContent.includes('/* SITE */');
    const hasThanksSection = humansContent.includes('/* THANKS */');

    if (!hasTeamSection && !hasSiteSection && !hasThanksSection) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '      ✗ Missing standard sections (TEAM, SITE, or THANKS)',
      });
    } else {
      const sections = [];
      if (hasTeamSection) sections.push('TEAM');
      if (hasSiteSection) sections.push('SITE');
      if (hasThanksSection) sections.push('THANKS');
      results.push({
        type: 'info',
        message: `      ✓ Contains standard sections: ${sections.join(', ')}`,
      });
    }

    // Check for common fields
    const hasContent =
      humansContent.includes('Name:') ||
      humansContent.includes('Title:') ||
      humansContent.includes('Last update:') ||
      humansContent.includes('Standards:') ||
      humansContent.includes('Software:');

    if (!hasContent) {
      results.push({
        type: 'warning',
        message: '      ⚠️  No standard fields detected (Name, Title, etc.)',
      });
    }

    // Check encoding (should be UTF-8)
    // eslint-disable-next-line no-control-regex
    const hasNonAscii = /[^\x00-\x7F]/.test(humansContent);
    if (hasNonAscii) {
      results.push({
        type: 'info',
        message: '      ℹ️  Contains non-ASCII characters (ensure UTF-8 encoding)',
      });
    }

    results.push({
      type: 'info',
      message: '      ✓ Valid humans.txt format',
    });
  } catch (e) {
    results.push({
      type: strict ? 'error' : 'warning',
      message: `      ✗ Validation error: ${e.message}`,
    });
  }
  return results;
}

module.exports.validateHumansTxt = validateHumansTxt;

/**
 * Validate security.txt file per RFC 9116
 * @param {string} securityContent - Content of security.txt
 * @param {object} options - Validation options
 * @param {boolean} options.strict - Strict mode (errors vs warnings)
 * @param {number} options.maxSizeKB - Maximum file size in KB
 * @returns {array} - Validation results
 */
function validateSecurityTxt(securityContent, { strict, maxSizeKB }) {
  const results = [];
  try {
    const lines = securityContent.split(/\r?\n/);

    // Check file size (RFC recommends < 32 KB)
    const sizeKB = Buffer.byteLength(securityContent, 'utf8') / 1024;
    if (sizeKB > maxSizeKB) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `      ✗ Exceeds recommended ${maxSizeKB} KB (${sizeKB.toFixed(2)} KB)`,
      });
    } else {
      results.push({
        type: 'info',
        message: `      ✓ Size OK (${sizeKB.toFixed(2)} KB)`,
      });
    }

    // Check for required Contact field
    const contactLines = lines.filter((line) => /^Contact:/i.test(line.trim()));
    if (contactLines.length === 0) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '      ✗ Missing required Contact field (RFC 9116)',
      });
    } else {
      results.push({
        type: 'info',
        message: `      ✓ Contains Contact field (${contactLines.length} contact(s))`,
      });

      // Validate Contact URIs
      let invalidContacts = 0;
      for (const line of contactLines) {
        const match = line.match(/^Contact:\s*(.+)$/i);
        if (match) {
          const uri = match[1].trim();
          // Must be mailto:, tel:, or https:// URI
          if (!/^(mailto:|tel:|https:\/\/)/i.test(uri) && !/^https?:\/\//i.test(uri)) {
            invalidContacts++;
          }
        }
      }
      if (invalidContacts > 0) {
        results.push({
          type: 'warning',
          message: `      ⚠️  ${invalidContacts} contact(s) may have invalid URI format (should use mailto:, tel:, or https://)`,
        });
      }
    }

    // Check for required Expires field
    const expiresLines = lines.filter((line) => /^Expires:/i.test(line.trim()));
    if (expiresLines.length === 0) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '      ✗ Missing required Expires field (RFC 9116)',
      });
    } else if (expiresLines.length > 1) {
      results.push({
        type: 'warning',
        message: '      ⚠️  Multiple Expires fields found (must appear only once)',
      });
    } else {
      // Validate Expires date format (ISO 8601)
      const match = expiresLines[0].match(/^Expires:\s*(.+)$/i);
      if (match) {
        const dateStr = match[1].trim();
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          results.push({
            type: 'warning',
            message: '      ⚠️  Invalid Expires date format (should be ISO 8601)',
          });
        } else {
          // Check if expired
          const now = new Date();
          if (date < now) {
            results.push({
              type: 'warning',
              message: `      ⚠️  File has expired (${dateStr})`,
            });
          } else {
            // Check if expires > 1 year (not recommended)
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            if (date > oneYearFromNow) {
              results.push({
                type: 'info',
                message: '      ℹ️  Expires more than 1 year in the future (not recommended)',
              });
            } else {
              results.push({
                type: 'info',
                message: `      ✓ Valid Expires field (${dateStr})`,
              });
            }
          }
        }
      }
    }

    // Check for Preferred-Languages (should appear only once)
    const langLines = lines.filter((line) => /^Preferred-Languages:/i.test(line.trim()));
    if (langLines.length > 1) {
      results.push({
        type: 'warning',
        message: '      ⚠️  Multiple Preferred-Languages fields (must appear only once)',
      });
    }

    // Check for optional but recommended fields
    const hasEncryption = lines.some((line) => /^Encryption:/i.test(line.trim()));
    const hasPolicy = lines.some((line) => /^Policy:/i.test(line.trim()));
    const hasCanonical = lines.some((line) => /^Canonical:/i.test(line.trim()));

    const optionalFields = [];
    if (hasEncryption) optionalFields.push('Encryption');
    if (hasPolicy) optionalFields.push('Policy');
    if (hasCanonical) optionalFields.push('Canonical');

    if (optionalFields.length > 0) {
      results.push({
        type: 'info',
        message: `      ✓ Optional fields present: ${optionalFields.join(', ')}`,
      });
    }

    // Validate HTTPS URIs for web resources
    const webUriFields = ['Acknowledgments', 'Canonical', 'Encryption', 'Hiring', 'Policy'];
    for (const field of webUriFields) {
      const fieldLines = lines.filter((line) => new RegExp(`^${field}:`, 'i').test(line.trim()));
      for (const line of fieldLines) {
        const match = line.match(new RegExp(`^${field}:\\s*(.+)$`, 'i'));
        if (match) {
          const uri = match[1].trim();
          // If it looks like a web URL, it must use https://
          if (
            /^https?:\/\//i.test(uri) &&
            !/^https:\/\//i.test(uri) &&
            !uri.startsWith('dns:') &&
            !uri.startsWith('openpgp4fpr:')
          ) {
            results.push({
              type: 'warning',
              message: `      ⚠️  ${field} uses http:// instead of https:// (not recommended)`,
            });
          }
        }
      }
    }

    // Check for digital signature
    const isSigned =
      securityContent.includes('-----BEGIN PGP SIGNED MESSAGE-----') &&
      securityContent.includes('-----BEGIN PGP SIGNATURE-----');
    if (isSigned) {
      results.push({
        type: 'info',
        message: '      ✓ File is digitally signed (OpenPGP)',
      });
    } else {
      results.push({
        type: 'info',
        message: '      ℹ️  File is not digitally signed (signing is recommended)',
      });
    }

    results.push({
      type: 'info',
      message: '      ✓ Valid security.txt format (RFC 9116)',
    });
  } catch (e) {
    results.push({
      type: strict ? 'error' : 'warning',
      message: `      ✗ Validation error: ${e.message}`,
    });
  }
  return results;
}

module.exports.validateSecurityTxt = validateSecurityTxt;
