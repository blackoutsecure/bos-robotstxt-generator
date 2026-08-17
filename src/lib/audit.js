// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Deterministic RFC 9309 / crawler-policy audit.
//
// Every rule is driven by `robots_txt.audit.rules.<name>` in the layered
// configuration. A rule configured as `skip` still emits a finding so the
// report records that the control was deliberately not assessed rather
// than silently dropped.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const fs = require('fs');
const path = require('path');

const { Finding, AuditResult } = require('./findings');
const { parseRobotsTxt } = require('./robots-parser');

const MAX_EVIDENCE_SAMPLES = 5;

/**
 * Run the full robots.txt audit against generated content.
 *
 * @param {object} options - Audit inputs.
 * @param {object} options.cfg - Resolved configuration.
 * @param {string} options.content - robots.txt content.
 * @param {string} options.filePath - Path the file was written to.
 * @param {string} [options.siteUrl] - Declared public base URL.
 * @param {string} [options.publicDir] - Published site directory.
 * @param {string} [options.outputDir] - Directory robots.txt was written to.
 * @returns {AuditResult} Findings plus run context.
 */
function audit({ cfg, content, filePath, siteUrl = '', publicDir = '', outputDir = '' }) {
  const rules = cfg.audit.rules;
  const findings = [];
  const baseDir = outputDir || publicDir || process.cwd();
  const location = filePath ? relativeTo(baseDir, filePath) : cfg.generate.filename;

  /**
   * Evaluate one rule against a boolean outcome.
   * @param {string} ruleId - Rule identifier.
   * @param {string} ruleName - Config key under `audit.rules`.
   * @param {object} outcome - Evaluation outcome.
   * @param {boolean} outcome.ok - Whether the control is satisfied.
   * @param {string} outcome.passMessage - Evidence when satisfied.
   * @param {string} outcome.failMessage - Evidence when violated.
   * @param {object} [outcome.evidence] - Machine-readable evidence.
   */
  const evaluate = (ruleId, ruleName, outcome) => {
    const severity = rules[ruleName];
    if (severity === 'skip') {
      findings.push(
        new Finding({
          ruleId,
          severity: 'skip',
          message: `Control disabled via \`robots_txt.audit.rules.${ruleName}: skip\`.`,
          location,
          evidence: { rule: ruleName },
        }),
      );
      return;
    }
    findings.push(
      new Finding({
        ruleId,
        severity: outcome.ok ? 'pass' : severity,
        message: outcome.ok ? outcome.passMessage : outcome.failMessage,
        location,
        evidence: outcome.evidence || {},
      }),
    );
  };

  const parsed = parseRobotsTxt(content || '');
  const site = safeUrl(siteUrl);

  // ── RB00x: directives ────────────────────────────────────────────
  evaluate('RB001', 'require_user_agent', {
    ok: parsed.groups.length > 0,
    passMessage: `${parsed.groups.length} User-agent record(s) declared.`,
    failMessage: 'No User-agent record found; the file gives crawlers no rules.',
    evidence: { group_count: parsed.groups.length },
  });

  evaluate('RB002', 'require_sitemap', {
    ok: parsed.sitemaps.length > 0,
    passMessage: `${parsed.sitemaps.length} Sitemap directive(s) declared.`,
    failMessage: 'No Sitemap directive found; crawlers must discover the sitemap manually.',
    evidence: { sitemap_count: parsed.sitemaps.length },
  });

  const relativeSitemaps = parsed.sitemaps.filter((value) => !safeUrl(value));
  evaluate('RB003', 'sitemap_absolute_url', {
    ok: relativeSitemaps.length === 0,
    passMessage: parsed.sitemaps.length
      ? 'Every Sitemap value is an absolute URL.'
      : 'No Sitemap directive to validate.',
    failMessage: `${relativeSitemaps.length} Sitemap value(s) are not absolute URLs.`,
    evidence: samples(relativeSitemaps),
  });

  const absoluteSitemaps = parsed.sitemaps.map(safeUrl).filter(Boolean);
  const offOrigin = site
    ? absoluteSitemaps.filter((url) => url.origin !== site.origin).map((url) => url.href)
    : [];
  evaluate('RB004', 'sitemap_same_origin', {
    ok: offOrigin.length === 0,
    passMessage: site
      ? `Every Sitemap URL matches the declared origin ${site.origin}.`
      : 'No site_url declared, so origin comparison is not applicable.',
    failMessage: `${offOrigin.length} Sitemap URL(s) do not match the declared origin ${site?.origin}.`,
    evidence: samples(offOrigin),
  });

  const insecureSitemaps = absoluteSitemaps
    .filter((url) => url.protocol !== 'https:')
    .map((url) => url.href);
  evaluate('RB005', 'sitemap_https', {
    ok: insecureSitemaps.length === 0,
    passMessage: absoluteSitemaps.length
      ? 'Every Sitemap URL uses HTTPS.'
      : 'No absolute Sitemap URL to validate.',
    failMessage: `${insecureSitemaps.length} Sitemap URL(s) do not use HTTPS.`,
    evidence: samples(insecureSitemaps),
  });

  // ── RB01x: crawl policy ──────────────────────────────────────────
  const blockedAll = parsed.groups
    .filter((group) => group.userAgents.includes('*'))
    .filter((group) => group.disallow.includes('/'));
  evaluate('RB010', 'forbid_disallow_all', {
    ok: blockedAll.length === 0,
    passMessage: 'The wildcard group does not disallow the entire site.',
    failMessage: 'The `*` group contains `Disallow: /`, which hides the whole site from crawlers.',
    evidence: { blocked_groups: blockedAll.length },
  });

  const withCrawlDelay = parsed.groups.filter((group) => group.crawlDelay);
  evaluate('RB011', 'forbid_crawl_delay', {
    ok: withCrawlDelay.length === 0,
    passMessage: 'No Crawl-delay directive is declared.',
    failMessage: `${withCrawlDelay.length} group(s) declare Crawl-delay, which Google ignores.`,
    evidence: samples(withCrawlDelay.map((group) => group.userAgents.join(', '))),
  });

  evaluate('RB012', 'valid_directives', {
    ok: parsed.unknownDirectives.length === 0 && parsed.malformedLines.length === 0,
    passMessage: 'Only recognised directives are present.',
    failMessage:
      `${parsed.unknownDirectives.length} unrecognised directive(s) and ` +
      `${parsed.malformedLines.length} malformed line(s) found.`,
    evidence: {
      ...samples(parsed.unknownDirectives),
      malformed_lines: parsed.malformedLines.slice(0, MAX_EVIDENCE_SAMPLES),
    },
  });

  const badPaths = [];
  for (const group of parsed.groups) {
    for (const value of [...group.allow, ...group.disallow]) {
      // An empty Disallow is the canonical "allow everything" form.
      if (value === '') continue;
      if (!value.startsWith('/') && !value.startsWith('*')) badPaths.push(value);
    }
  }
  evaluate('RB013', 'valid_path_prefixes', {
    ok: badPaths.length === 0,
    passMessage: 'Every Allow/Disallow value is a valid path prefix.',
    failMessage: `${badPaths.length} Allow/Disallow value(s) do not start with '/' or '*'.`,
    evidence: samples(badPaths),
  });

  const agentCounts = new Map();
  for (const group of parsed.groups) {
    for (const agent of group.userAgents) {
      const key = agent.toLowerCase();
      agentCounts.set(key, (agentCounts.get(key) || 0) + 1);
    }
  }
  const duplicateAgents = [...agentCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([agent]) => agent);
  evaluate('RB014', 'no_duplicate_groups', {
    ok: duplicateAgents.length === 0,
    passMessage: 'No User-agent is declared in more than one group.',
    failMessage: `${duplicateAgents.length} User-agent value(s) appear in multiple groups.`,
    evidence: samples(duplicateAgents),
  });

  // ── RB02x: file placement ────────────────────────────────────────
  const normalizedPath = (filePath || '').replace(/\\/g, '/');
  const atRoot = location === cfg.generate.filename;
  evaluate('RB020', 'site_root_location', {
    ok: atRoot,
    passMessage: `File is written to the site root as ${cfg.generate.filename}.`,
    failMessage: `File is written to ${normalizedPath || '(unknown)'}, not the site root.`,
    evidence: { path: normalizedPath, output_dir: baseDir },
  });

  const sizeBytes = Buffer.byteLength(content || '', 'utf8');
  const maxBytes = cfg.audit.maxSizeKb * 1024;
  evaluate('RB021', 'file_size_limit', {
    ok: sizeBytes <= maxBytes,
    passMessage: `File is ${sizeBytes} bytes, within the ${cfg.audit.maxSizeKb} KB limit.`,
    failMessage: `File is ${sizeBytes} bytes, beyond the ${cfg.audit.maxSizeKb} KB limit.`,
    evidence: { size_bytes: sizeBytes, max_bytes: maxBytes },
  });

  const missingSitemaps = publicDir
    ? absoluteSitemaps
        .filter((url) => !site || url.origin === site.origin)
        .map((url) => ({ url: url.href, file: path.join(publicDir, url.pathname) }))
        .filter(({ file }) => !existsFile(file))
        .map(({ url }) => url)
    : [];
  evaluate('RB022', 'sitemap_file_exists', {
    ok: missingSitemaps.length === 0,
    passMessage: absoluteSitemaps.length
      ? 'Every same-origin Sitemap URL resolves to a published file.'
      : 'No Sitemap URL to resolve.',
    failMessage: `${missingSitemaps.length} same-origin Sitemap URL(s) have no published file.`,
    evidence: samples(missingSitemaps),
  });

  // ── RB03x: encoding ──────────────────────────────────────────────
  evaluate('RB030', 'require_utf8_no_bom', {
    ok: !parsed.hasBom,
    passMessage: 'File is UTF-8 encoded without a byte-order mark.',
    failMessage: 'File starts with a UTF-8 byte-order mark, which can break the first directive.',
    evidence: { has_bom: parsed.hasBom },
  });

  const looksLikeHtml = /<\s*(!doctype\s+html|html|head|body)\b/i.test(content || '');
  evaluate('RB031', 'forbid_html_content', {
    ok: !looksLikeHtml,
    passMessage: 'File is plain text.',
    failMessage: 'File contains HTML markup; crawlers treat an HTML robots.txt as "allow all".',
    evidence: { looks_like_html: looksLikeHtml },
  });

  return new AuditResult(findings, {
    site_url: siteUrl,
    public_dir: publicDir,
    file_path: normalizedPath,
    size_bytes: sizeBytes,
    group_count: parsed.groups.length,
    sitemap_count: parsed.sitemaps.length,
  });
}

/**
 * Decide the process exit disposition for an audit result.
 * @param {AuditResult} result - Completed audit.
 * @param {string} failOn - Either `fail` or `never`.
 * @returns {boolean} True when the run should be marked failed.
 */
function shouldFail(result, failOn) {
  if (failOn === 'never') return false;
  return result.failed.length > 0 || result.errored.length > 0;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function existsFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function relativeTo(baseDir, filePath) {
  const relative = path.relative(baseDir, filePath);
  const chosen = relative && !relative.startsWith('..') ? relative : filePath;
  return chosen.replace(/\\/g, '/');
}

function samples(values) {
  if (!values || !values.length) return {};
  return {
    samples: values.slice(0, MAX_EVIDENCE_SAMPLES),
    sample_truncated: values.length > MAX_EVIDENCE_SAMPLES,
    total: values.length,
  };
}

module.exports = {
  audit,
  shouldFail,
  MAX_EVIDENCE_SAMPLES,
};
