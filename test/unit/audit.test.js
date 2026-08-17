// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RFC 9309 audit rules, the robots.txt reader, and the content builder.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cfgMod = require('../../src/lib/config');
const { audit, shouldFail } = require('../../src/lib/audit');
const { parseRobotsTxt } = require('../../src/lib/robots-parser');
const {
  buildRobotsTxt,
  resolveSitemaps,
  ensureLeadingSlash,
} = require('../../src/lib/robots-builder');

const SITE = 'https://example.com';

function configWith(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bos-robotstxt-cfg-'));
  fs.writeFileSync(
    path.join(dir, '.bos-robotstxt.yml'),
    JSON.stringify({ robots_txt: overrides }),
    'utf8',
  );
  const cfg = cfgMod.resolve(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  return cfg;
}

function compliant() {
  return [
    'User-agent: *',
    'Disallow: /admin/',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    `Sitemap: ${SITE}/sitemap.xml`,
    '',
  ].join('\n');
}

function run(
  content,
  { cfg = configWith(), filePath = 'dist/robots.txt', publicDir = 'dist' } = {},
) {
  return audit({ cfg, content, filePath, siteUrl: SITE, publicDir, outputDir: publicDir });
}

function findingFor(result, ruleId) {
  return result.findings.find((f) => f.ruleId === ruleId);
}

describe('lib/robots-parser parseRobotsTxt', () => {
  it('groups consecutive user-agent lines into one record', () => {
    const parsed = parseRobotsTxt('User-agent: a\nUser-agent: b\nDisallow: /x\n');
    assert.strictEqual(parsed.groups.length, 1);
    assert.deepStrictEqual(parsed.groups[0].userAgents, ['a', 'b']);
    assert.deepStrictEqual(parsed.groups[0].disallow, ['/x']);
  });

  it('starts a new record when rules already followed the agents', () => {
    const parsed = parseRobotsTxt('User-agent: a\nDisallow: /x\nUser-agent: b\nAllow: /\n');
    assert.strictEqual(parsed.groups.length, 2);
  });

  it('collects file-level sitemap directives', () => {
    const parsed = parseRobotsTxt(`User-agent: *\nSitemap: ${SITE}/sitemap.xml\n`);
    assert.deepStrictEqual(parsed.sitemaps, [`${SITE}/sitemap.xml`]);
  });

  it('ignores comments and blank lines', () => {
    const parsed = parseRobotsTxt('# hello\n\nUser-agent: *\nDisallow: /a # trailing\n');
    assert.deepStrictEqual(parsed.groups[0].disallow, ['/a']);
  });

  it('records unknown directives and malformed lines', () => {
    const parsed = parseRobotsTxt('User-agent: *\nNofollow: /x\nnonsense\n');
    assert.deepStrictEqual(parsed.unknownDirectives, ['nofollow']);
    assert.strictEqual(parsed.malformedLines.length, 1);
  });

  it('treats a rule before any user-agent as malformed', () => {
    const parsed = parseRobotsTxt('Disallow: /x\nUser-agent: *\n');
    assert.strictEqual(parsed.malformedLines.length, 1);
  });

  it('detects and strips a byte-order mark', () => {
    const parsed = parseRobotsTxt('\uFEFFUser-agent: *\nDisallow:\n');
    assert.strictEqual(parsed.hasBom, true);
    assert.strictEqual(parsed.groups.length, 1);
  });
});

describe('lib/robots-builder', () => {
  it('writes one record per configured group', () => {
    const content = buildRobotsTxt({
      groups: [
        { userAgent: '*', disallow: ['/admin/'] },
        { userAgent: 'Googlebot', allow: ['/'], crawlDelay: '2' },
      ],
    });
    assert.match(content, /User-agent: \*/);
    assert.match(content, /User-agent: Googlebot/);
    assert.match(content, /Crawl-delay: 2/);
  });

  it('emits an empty Disallow for a group with no rules', () => {
    assert.match(buildRobotsTxt({ groups: [{ userAgent: '*' }] }), /^Disallow:$/m);
  });

  it('defaults to a wildcard allow-all record', () => {
    const content = buildRobotsTxt({});
    assert.match(content, /User-agent: \*/);
    assert.match(content, /^Disallow:$/m);
  });

  it('normalises path prefixes but leaves wildcards alone', () => {
    assert.strictEqual(ensureLeadingSlash('admin/'), '/admin/');
    assert.strictEqual(ensureLeadingSlash('/admin/'), '/admin/');
    assert.strictEqual(ensureLeadingSlash('*.pdf'), '*.pdf');
  });

  it('resolves and de-duplicates sitemap URLs', () => {
    const urls = resolveSitemaps({
      siteUrl: SITE,
      includeSitemap: true,
      sitemapFilename: 'sitemap.xml',
      extra: ['sitemap.xml', '/news.xml', 'https://cdn.example.net/extra.xml'],
    });
    assert.deepStrictEqual(urls, [
      `${SITE}/sitemap.xml`,
      `${SITE}/news.xml`,
      'https://cdn.example.net/extra.xml',
    ]);
  });
});

describe('lib/audit', () => {
  it('emits a finding for every known rule', () => {
    const result = run(compliant());
    assert.strictEqual(result.findings.length, Object.keys(cfgMod.RULE_DEFAULTS).length);
  });

  it('passes every non-skipped control for a compliant file', () => {
    const result = run(compliant());
    const attention = result.findings.filter((f) => f.severity !== 'pass' && f.severity !== 'skip');
    assert.deepStrictEqual(
      attention.map((f) => f.ruleId),
      [],
    );
  });

  it('records disabled controls as skip rather than dropping them', () => {
    const cfg = configWith({ audit: { rules: { require_sitemap: 'skip' } } });
    const finding = findingFor(run('User-agent: *\nDisallow:\n', { cfg }), 'RB002');
    assert.strictEqual(finding.severity, 'skip');
    assert.match(finding.message, /Control disabled/);
  });

  it('flags a file with no user-agent record', () => {
    assert.strictEqual(findingFor(run(`Sitemap: ${SITE}/sitemap.xml\n`), 'RB001').severity, 'warn');
  });

  it('flags a missing sitemap directive', () => {
    assert.strictEqual(findingFor(run('User-agent: *\nDisallow:\n'), 'RB002').severity, 'warn');
  });

  it('flags relative, off-origin, and insecure sitemap URLs', () => {
    const relative = run('User-agent: *\nSitemap: /sitemap.xml\n');
    assert.strictEqual(findingFor(relative, 'RB003').severity, 'warn');

    const offOrigin = run('User-agent: *\nSitemap: https://other.test/sitemap.xml\n');
    assert.strictEqual(findingFor(offOrigin, 'RB004').severity, 'warn');

    const insecure = run('User-agent: *\nSitemap: http://example.com/sitemap.xml\n');
    assert.strictEqual(findingFor(insecure, 'RB005').severity, 'warn');
  });

  it('flags a wildcard group that disallows everything', () => {
    const result = run(`User-agent: *\nDisallow: /\nSitemap: ${SITE}/sitemap.xml\n`);
    assert.strictEqual(findingFor(result, 'RB010').severity, 'warn');
  });

  it('does not flag Disallow: / on a named agent', () => {
    const result = run(`User-agent: BadBot\nDisallow: /\nSitemap: ${SITE}/sitemap.xml\n`);
    assert.strictEqual(findingFor(result, 'RB010').severity, 'pass');
  });

  it('reports Crawl-delay when the rule is enabled', () => {
    const cfg = configWith({ audit: { rules: { forbid_crawl_delay: 'warn' } } });
    const result = run(`User-agent: *\nCrawl-delay: 10\nSitemap: ${SITE}/sitemap.xml\n`, { cfg });
    assert.strictEqual(findingFor(result, 'RB011').severity, 'warn');
  });

  it('flags unknown directives', () => {
    const result = run(`User-agent: *\nNofollow: /x\nSitemap: ${SITE}/sitemap.xml\n`);
    const finding = findingFor(result, 'RB012');
    assert.strictEqual(finding.severity, 'warn');
    assert.deepStrictEqual(finding.evidence.samples, ['nofollow']);
  });

  it('flags path prefixes that do not start with a slash', () => {
    const result = run(`User-agent: *\nDisallow: admin\nSitemap: ${SITE}/sitemap.xml\n`);
    const finding = findingFor(result, 'RB013');
    assert.strictEqual(finding.severity, 'warn');
    assert.deepStrictEqual(finding.evidence.samples, ['admin']);
  });

  it('accepts an empty Disallow and wildcard prefixes', () => {
    const result = run(`User-agent: *\nDisallow:\nAllow: *.css\nSitemap: ${SITE}/sitemap.xml\n`);
    assert.strictEqual(findingFor(result, 'RB013').severity, 'pass');
  });

  it('flags a user-agent declared in two groups', () => {
    const result = run(
      `User-agent: *\nDisallow: /a\n\nUser-agent: *\nDisallow: /b\n\nSitemap: ${SITE}/sitemap.xml\n`,
    );
    const finding = findingFor(result, 'RB014');
    assert.strictEqual(finding.severity, 'warn');
    assert.deepStrictEqual(finding.evidence.samples, ['*']);
  });

  it('requires the file at the site root', () => {
    assert.strictEqual(findingFor(run(compliant()), 'RB020').severity, 'pass');
    assert.strictEqual(
      findingFor(run(compliant(), { filePath: 'dist/meta/robots.txt' }), 'RB020').severity,
      'warn',
    );
  });

  it('enforces the configured size limit', () => {
    const cfg = configWith({ audit: { max_size_kb: 1 } });
    const result = run(`User-agent: *\n# ${'x'.repeat(2048)}\nSitemap: ${SITE}/sitemap.xml\n`, {
      cfg,
    });
    assert.strictEqual(findingFor(result, 'RB021').severity, 'warn');
  });

  it('checks that same-origin sitemap files exist when enabled', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bos-robotstxt-site-'));
    try {
      const cfg = configWith({ audit: { rules: { sitemap_file_exists: 'warn' } } });
      const missing = audit({
        cfg,
        content: compliant(),
        filePath: path.join(dir, 'robots.txt'),
        siteUrl: SITE,
        publicDir: dir,
        outputDir: dir,
      });
      assert.strictEqual(findingFor(missing, 'RB022').severity, 'warn');

      fs.writeFileSync(path.join(dir, 'sitemap.xml'), '<urlset/>', 'utf8');
      const present = audit({
        cfg,
        content: compliant(),
        filePath: path.join(dir, 'robots.txt'),
        siteUrl: SITE,
        publicDir: dir,
        outputDir: dir,
      });
      assert.strictEqual(findingFor(present, 'RB022').severity, 'pass');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags a byte-order mark', () => {
    assert.strictEqual(findingFor(run(`\uFEFF${compliant()}`), 'RB030').severity, 'warn');
  });

  it('flags HTML served as robots.txt', () => {
    const result = run('<!DOCTYPE html><html><body>404</body></html>');
    assert.strictEqual(findingFor(result, 'RB031').severity, 'warn');
  });

  it('drives the exit disposition from fail_on', () => {
    const cfg = configWith({ audit: { rules: { require_sitemap: 'fail' } } });
    const result = run('User-agent: *\nDisallow:\n', { cfg });
    assert.strictEqual(shouldFail(result, 'fail'), true);
    assert.strictEqual(shouldFail(result, 'never'), false);
  });

  it('exposes run context for reporting', () => {
    const result = run(compliant());
    assert.strictEqual(result.context.group_count, 2);
    assert.strictEqual(result.context.sitemap_count, 1);
    assert.ok(result.context.size_bytes > 0);
  });
});
