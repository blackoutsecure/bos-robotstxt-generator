// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Finding model, severity semantics, and Markdown report rendering.
//
// Severities:
//   pass  — control satisfied the configured policy
//   warn  — review recommended, not a hard block on its own
//   fail  — required control failed and should be remediated
//   error — the audit itself could not complete for this control
//   skip  — the control was disabled or lacked the evidence to assess
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const crypto = require('crypto');

const SPEC = 'https://www.rfc-editor.org/rfc/rfc9309';
const GOOGLE_DOCS = 'https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt';

/**
 * Rule family display order — drives the section banners in reports.
 * Entries are `[idPrefix, header, blurb]`.
 */
const RULE_FAMILIES = Object.freeze([
  ['RB00', 'Directives', 'User-agent records and Sitemap discovery'],
  ['RB01', 'Crawl policy', 'Allow/Disallow correctness and group hygiene'],
  ['RB02', 'File placement', 'Site-root location, size, and sitemap reachability'],
  ['RB03', 'Encoding', 'Plain-text and byte-order-mark compliance'],
]);

const RULE_TITLES = Object.freeze({
  RB001: 'At least one User-agent record',
  RB002: 'Sitemap directive present',
  RB003: 'Sitemap values are absolute URLs',
  RB004: 'Sitemap host matches the site origin',
  RB005: 'Sitemap URLs use HTTPS',
  RB010: 'Site is not fully disallowed',
  RB011: 'No Crawl-delay directive',
  RB012: 'Only recognised directives',
  RB013: 'Allow/Disallow values are valid path prefixes',
  RB014: 'No duplicate User-agent groups',
  RB020: 'Served from the site root',
  RB021: 'File size within limits',
  RB022: 'Referenced sitemap files exist',
  RB030: 'UTF-8 encoded without a byte-order mark',
  RB031: 'File is plain text, not HTML',
});

const RULE_HELP = Object.freeze({
  RB001: `${SPEC}#name-the-user-agent-line`,
  RB002: 'https://www.sitemaps.org/protocol.html#submit_robots',
  RB003: 'https://www.sitemaps.org/protocol.html#submit_robots',
  RB004: 'https://www.sitemaps.org/protocol.html#submit_robots',
  RB005: 'https://developers.google.com/search/docs/crawling-indexing/https',
  RB010: GOOGLE_DOCS,
  RB011: GOOGLE_DOCS,
  RB012: `${SPEC}#name-other-records`,
  RB013: `${SPEC}#name-the-allow-and-disallow-lines`,
  RB014: `${SPEC}#name-grouping-of-rules`,
  RB020: `${SPEC}#name-access-method`,
  RB021: GOOGLE_DOCS,
  RB022: 'https://www.sitemaps.org/protocol.html',
  RB030: `${SPEC}#name-file-format`,
  RB031: `${SPEC}#name-file-format`,
});

const DEFAULT_REMEDIATIONS = Object.freeze({
  RB001:
    'Declare at least one `User-agent:` record — a robots.txt with no group tells crawlers nothing.',
  RB002: 'Add a `Sitemap:` directive so crawlers discover the sitemap without manual submission.',
  RB003:
    'Write every `Sitemap:` value as an absolute URL; relative sitemap paths are ignored by crawlers.',
  RB004:
    'Point `Sitemap:` at the same host the robots.txt is served from, or remove the off-origin entry.',
  RB005: 'Serve the sitemap over HTTPS and reference the https:// URL.',
  RB010:
    'Remove `Disallow: /` from the `*` group unless the site is intentionally hidden from all crawlers.',
  RB011:
    'Drop `Crawl-delay` — Google ignores it. Use Search Console crawl-rate settings or server-side rate limiting instead.',
  RB012:
    'Remove the unrecognised directive; crawlers ignore unknown lines and they often mask a typo.',
  RB013:
    'Start every Allow/Disallow value with `/` (or `*`), which is the only form crawlers match against.',
  RB014:
    'Merge the duplicate `User-agent` records — most crawlers honour only the first matching group.',
  RB020: 'Write robots.txt to the published site root; crawlers only fetch `/robots.txt`.',
  RB021:
    'Trim the file. Google truncates robots.txt beyond 500 KiB, silently dropping later rules.',
  RB022: 'Publish the referenced sitemap file, or correct the `Sitemap:` URL to one that resolves.',
  RB030: 'Write the file as UTF-8 without a byte-order mark; a BOM can break the first directive.',
  RB031:
    'Serve robots.txt as plain text — an HTML error page at /robots.txt is treated as "allow all".',
});

function defaultTitle(ruleId) {
  return RULE_TITLES[ruleId] || ruleId;
}

function defaultRemediation(ruleId, message) {
  return (
    DEFAULT_REMEDIATIONS[ruleId] ||
    message ||
    'Review the robots.txt configuration and apply the recommended control.'
  );
}

/** A single evidence-backed audit result. */
class Finding {
  /**
   * @param {object} options - Finding fields.
   * @param {string} options.ruleId - Stable rule identifier (e.g. `RB001`).
   * @param {string} options.severity - One of pass/warn/fail/error/skip.
   * @param {string} options.message - Evidence describing what was observed.
   * @param {string} [options.location] - File path or directive name.
   * @param {string} [options.title] - Human-readable control name.
   * @param {object} [options.evidence] - Machine-readable evidence payload.
   * @param {string} [options.remediation] - Recommended remediation text.
   * @param {string} [options.source] - Emitting subsystem.
   */
  constructor({
    ruleId,
    severity,
    message,
    location = '',
    title = '',
    evidence = {},
    remediation = '',
    source = 'robotstxt-audit',
  }) {
    this.ruleId = ruleId;
    this.severity = severity;
    this.message = message;
    this.location = location;
    this.title = title || defaultTitle(ruleId);
    this.evidence = evidence || {};
    this.remediation = remediation || defaultRemediation(ruleId, message);
    this.remediationConfidence = 'deterministic';
    this.remediationSource = 'Blackout Secure Recommended Remediation';
    this.source = source;
    this.helpUri = RULE_HELP[ruleId] || SPEC;
  }

  /** Identity that stays stable as recommendation wording changes. */
  get findingKey() {
    const identity = `${this.ruleId}|${this.location || '(robots.txt)'}`;
    const digest = crypto.createHash('sha256').update(identity, 'utf8').digest('hex').slice(0, 16);
    return `${this.ruleId.toLowerCase()}-${digest}`;
  }

  /** @returns {object} JSON-serialisable representation. */
  toJSON() {
    return {
      finding_key: this.findingKey,
      rule_id: this.ruleId,
      severity: this.severity,
      title: this.title,
      message: this.message,
      source: this.source,
      location: this.location,
      evidence: this.evidence,
      remediation: this.remediation,
      remediation_confidence: this.remediationConfidence,
      remediation_source: this.remediationSource,
      help_uri: this.helpUri,
    };
  }

  /** @returns {object} Machine-readable recommendation contract. */
  recommendation() {
    return {
      finding_key: this.findingKey,
      rule_id: this.ruleId,
      title: this.title,
      location: this.location,
      recommendation: this.remediation,
      confidence: this.remediationConfidence,
      source: this.remediationSource,
      patch_status: 'unavailable',
    };
  }
}

/** Aggregate of every finding emitted by one audit run. */
class AuditResult {
  /**
   * @param {Finding[]} [findings] - Findings in emission order.
   * @param {object} [context] - Run context echoed into reports.
   */
  constructor(findings = [], context = {}) {
    this.findings = findings;
    this.context = context;
  }

  get passed() {
    return this.findings.filter((f) => f.severity === 'pass');
  }

  get warned() {
    return this.findings.filter((f) => f.severity === 'warn');
  }

  get failed() {
    return this.findings.filter((f) => f.severity === 'fail');
  }

  get errored() {
    return this.findings.filter((f) => f.severity === 'error');
  }

  get skipped() {
    return this.findings.filter((f) => f.severity === 'skip');
  }

  /** @returns {object} Per-severity counts. */
  totals() {
    return {
      pass: this.passed.length,
      warn: this.warned.length,
      fail: this.failed.length,
      error: this.errored.length,
      skip: this.skipped.length,
    };
  }

  /** @returns {object[]} Recommendation contracts for non-pass findings. */
  recommendations() {
    return this.findings
      .filter((f) => f.severity !== 'pass' && f.remediation.trim())
      .map((f) => f.recommendation());
  }

  /** @returns {object} Full JSON report payload. */
  toJSON() {
    return {
      schema_version: 1,
      context: this.context,
      totals: this.totals(),
      verdict: verdict(this.totals())[0],
      findings: this.findings.map((f) => f.toJSON()),
      recommendations: this.recommendations(),
    };
  }

  /** @returns {string} GitHub-flavoured Markdown audit report. */
  summaryMarkdown() {
    return renderMarkdown(this);
  }
}

function verdict(totals) {
  if (totals.error) {
    return [
      'Inconclusive',
      'One or more controls could not be evaluated. Re-run after resolving the audit errors below.',
    ];
  }
  if (totals.fail) {
    return [
      'Action required',
      'At least one required robots.txt control failed and should be remediated before release.',
    ];
  }
  if (totals.warn) {
    return [
      'Review recommended',
      'No blocking failures. The warnings below are worth reviewing before release.',
    ];
  }
  if (totals.pass) {
    return ['Pass', 'Every configured robots.txt control satisfied its policy.'];
  }
  return ['Not assessed', 'No controls produced an assessable result for this run.'];
}

function severityLabel(severity) {
  switch (severity) {
    case 'pass':
      return '✅ Pass';
    case 'warn':
      return '⚠️ Warning';
    case 'fail':
      return '🔴 High';
    case 'error':
      return '🔥 Critical';
    default:
      return '⚪ Not Assessed';
  }
}

function mdEscape(text) {
  return String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function familyFor(ruleId) {
  return RULE_FAMILIES.findIndex(([prefix]) => ruleId.startsWith(prefix));
}

function recommendedActions(totals) {
  const actions = [];
  if (totals.fail) {
    actions.push('Remediate every 🔴 High finding — these are required controls that failed.');
  }
  if (totals.error) {
    actions.push(
      'Investigate every 🔥 Critical finding — the audit could not collect evidence for those controls.',
    );
  }
  if (totals.warn) {
    actions.push(
      'Triage the ⚠️ Warning findings and either remediate them or set the rule to `skip` in config once accepted.',
    );
  }
  if (totals.skip) {
    actions.push(
      'Review ⚪ Not Assessed controls — enable them in `robots_txt.audit.rules` when they are relevant.',
    );
  }
  if (!actions.length) {
    actions.push('No action required. Keep the audit wired into CI to catch regressions.');
  }
  return actions;
}

function renderMarkdown(result) {
  const totals = result.totals();
  const [headline, detail] = verdict(totals);
  const ctx = result.context || {};

  const lines = [
    '# Blackout Secure Robots TXT Generator Audit Report',
    '',
    '**Provided by [Blackout Secure](https://blackoutsecure.app)**',
    '',
    '## Summary',
    '',
    `**Verdict:** ${mdEscape(headline)}`,
    '',
    detail,
    '',
    `**Totals:** ✅ ${totals.pass} pass · ⚠️ ${totals.warn} warning · ` +
      `🔴 ${totals.fail} high · 🔥 ${totals.error} critical · ` +
      `⚪ ${totals.skip} not assessed`,
    '',
    '| Severity | Count | Meaning |',
    '| -------- | ----- | ------- |',
    `| ✅ Pass | ${totals.pass} | Control satisfied the configured policy. |`,
    `| ⚠️ Warning | ${totals.warn} | Review recommended; not usually a hard block by itself. |`,
    `| 🔴 High | ${totals.fail} | Required control failed and should be remediated. |`,
    `| 🔥 Critical | ${totals.error} | Audit execution or evidence collection error. |`,
    `| ⚪ Not Assessed | ${totals.skip} | Check was skipped or lacked sufficient evidence. |`,
    '',
  ];

  if (Object.keys(ctx).length) {
    lines.push('## Run Context', '');
    lines.push('| Field | Value |', '| ----- | ----- |');
    for (const [key, value] of Object.entries(ctx)) {
      lines.push(`| ${mdEscape(key)} | ${mdEscape(value)} |`);
    }
    lines.push('');
  }

  lines.push('## Recommended Actions', '');
  for (const action of recommendedActions(totals)) {
    lines.push(`- ${action}`);
  }
  lines.push('');

  lines.push(
    '## Scope and Methodology',
    '',
    'This automated audit reviews the generated robots.txt against RFC 9309 and mainstream search-engine guidance — user-agent records, Allow/Disallow correctness, sitemap discovery, file placement, size limits, and encoding. Results are evidence-based at run time and are intended to support release, SEO, and crawl-governance review.',
    '',
  );

  const recommendations = result.findings.filter(
    (f) => f.severity !== 'pass' && f.remediation.trim(),
  );
  lines.push(
    '## Recommendations',
    '',
    '| Finding Key | Rule | Assessment | Location | Evidence / Why | Recommended Action |',
    '| ----------- | ---- | ---------- | -------- | -------------- | ------------------ |',
  );
  if (recommendations.length) {
    for (const f of recommendations) {
      lines.push(
        `| \`${f.findingKey}\` | \`${f.ruleId}\` | ${severityLabel(f.severity)} | ` +
          `${mdEscape(f.location || '—')} | ${mdEscape(f.message)} | ${mdEscape(f.remediation)} |`,
      );
    }
  } else {
    lines.push('| — | — | — | — | — | — |');
  }
  lines.push('');

  if (!result.findings.length) {
    lines.push(
      '## Detailed Findings',
      '',
      '_No findings were emitted by the configured audit controls._',
      '',
    );
    return `${lines.join('\n')}\n`;
  }

  const buckets = new Map();
  for (const f of result.findings) {
    const idx = familyFor(f.ruleId);
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx).push(f);
  }

  lines.push('## Detailed Findings', '');
  for (const idx of [...RULE_FAMILIES.map((_, i) => i), -1]) {
    const rows = buckets.get(idx);
    if (!rows || !rows.length) continue;
    const [, header, blurb] =
      idx === -1 ? ['', 'Other', 'Uncategorised controls'] : RULE_FAMILIES[idx];
    lines.push(`### ${header}`, `_${blurb}_`, '');

    const attention = rows.filter((f) => f.severity !== 'pass');
    const passed = rows.filter((f) => f.severity === 'pass');

    if (attention.length) {
      lines.push(
        '#### Findings Requiring Attention',
        '',
        '| Rule | Severity | Location | Control | Evidence | Recommended Remediation |',
        '| ---- | -------- | -------- | ------- | -------- | ----------------------- |',
      );
      for (const f of attention) {
        lines.push(
          `| \`${f.ruleId}\` | ${severityLabel(f.severity)} | ${mdEscape(f.location || '—')} | ` +
            `${mdEscape(f.title)} | ${mdEscape(f.message)} | ${mdEscape(f.remediation)} |`,
        );
      }
      lines.push('');
    }

    if (passed.length) {
      lines.push(
        '#### Passed Controls',
        '',
        '| Rule | Severity | Location | Control | Evidence |',
        '| ---- | -------- | -------- | ------- | -------- |',
      );
      for (const f of passed) {
        lines.push(
          `| \`${f.ruleId}\` | ${severityLabel(f.severity)} | ${mdEscape(f.location || '—')} | ` +
            `${mdEscape(f.title)} | ${mdEscape(f.message)} |`,
        );
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  Finding,
  AuditResult,
  RULE_FAMILIES,
  RULE_TITLES,
  RULE_HELP,
  DEFAULT_REMEDIATIONS,
  severityLabel,
  verdict,
  mdEscape,
  familyFor,
};
