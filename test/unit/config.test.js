// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layered configuration loader tests.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cfgMod = require('../../src/lib/config');

function write(root, relative, contents) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
  return target;
}

describe('lib/config', () => {
  const roots = [];

  afterEach(() => {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  });

  function root() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bos-robotstxt-config-'));
    roots.push(dir);
    return dir;
  }

  it('falls back to the bundled marketplace baseline', () => {
    const cfg = cfgMod.resolve(root());
    assert.strictEqual(cfg.generate.includeComments, true);
    assert.strictEqual(cfg.generate.filename, 'robots.txt');
    assert.strictEqual(cfg.generate.includeSitemap, true);
    assert.strictEqual(cfg.audit.failOn, 'fail');
    assert.strictEqual(cfg.audit.maxSizeKb, 500);
    assert.strictEqual(cfg.audit.rules.require_sitemap, 'warn');
    assert.deepStrictEqual(cfg.sourcePaths, ['bundled:marketplace-config.json']);
  });

  it('starts from built-in defaults when the baseline is disabled', () => {
    const cfg = cfgMod.resolve(root(), { useMarketplaceConfig: false });
    assert.deepStrictEqual(cfg.sourcePaths, []);
    assert.strictEqual(cfg.audit.maxSizeKb, 500);
    assert.strictEqual(cfg.audit.rules.forbid_crawl_delay, 'skip');
  });

  it('discovers .github/bos-universal-config.json and merges it', () => {
    const dir = root();
    write(
      dir,
      '.github/bos-universal-config.json',
      JSON.stringify({
        robots_txt: { owner: 'blackoutsecure', audit: { rules: { require_sitemap: 'fail' } } },
      }),
    );

    const cfg = cfgMod.resolve(dir);
    assert.strictEqual(cfg.owner, 'blackoutsecure');
    assert.strictEqual(cfg.audit.rules.require_sitemap, 'fail');
    assert.strictEqual(cfg.audit.rules.require_user_agent, 'warn');
  });

  it('applies global config beneath the repository config', () => {
    const dir = root();
    write(
      dir,
      '.github/blackout-secure-robotstxt-generator-global-config.yml',
      'robots_txt:\n  audit:\n    rules:\n      require_sitemap: fail\n      forbid_disallow_all: fail\n',
    );
    write(
      dir,
      '.bos-robotstxt.yml',
      'robots_txt:\n  audit:\n    rules:\n      forbid_disallow_all: skip\n',
    );

    const cfg = cfgMod.resolve(dir);
    assert.strictEqual(cfg.audit.rules.require_sitemap, 'fail');
    assert.strictEqual(cfg.audit.rules.forbid_disallow_all, 'skip');
    assert.strictEqual(cfg.sourcePaths.length, 3);
  });

  it('honours the tri-state global config toggle', () => {
    const dir = root();
    assert.throws(() => cfgMod.resolve(dir, { useGlobalConfig: true }), cfgMod.ConfigError);
    assert.doesNotThrow(() => cfgMod.resolve(dir, { useGlobalConfig: false }));
  });

  it('accepts a bare document without the robots_txt section', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'audit:\n  fail_on: never\n');
    assert.strictEqual(cfgMod.resolve(dir).audit.failOn, 'never');
  });

  it('parses multiple user-agent groups', () => {
    const dir = root();
    write(
      dir,
      '.bos-robotstxt.yml',
      [
        'groups:',
        '  - user_agent: "*"',
        '    disallow: [/admin/, /private/]',
        '  - user_agent: Googlebot',
        '    allow: [/]',
        '    crawl_delay: 2',
        'sitemaps:',
        '  - https://example.com/sitemap-news.xml',
        '',
      ].join('\n'),
    );

    const cfg = cfgMod.resolve(dir);
    assert.strictEqual(cfg.groups.length, 2);
    assert.deepStrictEqual(cfg.groups[0].disallow, ['/admin/', '/private/']);
    assert.strictEqual(cfg.groups[1].userAgent, 'Googlebot');
    assert.strictEqual(cfg.groups[1].crawlDelay, '2');
    assert.deepStrictEqual(cfg.sitemaps, ['https://example.com/sitemap-news.xml']);
  });

  it('accepts a comma-separated string for list fields', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'groups:\n  - user_agent: "*"\n    disallow: "/a/, /b/"\n');
    assert.deepStrictEqual(cfgMod.resolve(dir).groups[0].disallow, ['/a/', '/b/']);
  });

  it('rejects an unknown field on a group entry', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'groups:\n  - user_agent: "*"\n    nofollow: true\n');
    assert.throws(() => cfgMod.resolve(dir), /unknown field/);
  });

  it('rejects a non-list groups value', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'groups:\n  user_agent: "*"\n');
    assert.throws(() => cfgMod.resolve(dir), /must be a list of mappings/);
  });

  it('rejects a negative crawl delay', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'groups:\n  - user_agent: "*"\n    crawl_delay: -1\n');
    assert.throws(() => cfgMod.resolve(dir), /non-negative number/);
  });

  it('rejects an unknown audit rule', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'audit:\n  rules:\n    require_unicorns: warn\n');
    assert.throws(() => cfgMod.resolve(dir), /unknown rule/);
  });

  it('rejects an invalid severity', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'audit:\n  rules:\n    require_sitemap: explode\n');
    assert.throws(() => cfgMod.resolve(dir), /is not one of/);
  });

  it('rejects an invalid fail_on value', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'audit:\n  fail_on: sometimes\n');
    assert.throws(() => cfgMod.resolve(dir), /audit\.fail_on/);
  });

  it('rejects a filename containing a path separator', () => {
    const dir = root();
    write(dir, '.bos-robotstxt.yml', 'generate:\n  filename: nested/robots.txt\n');
    assert.throws(() => cfgMod.resolve(dir), /bare filename/);
  });

  it('raises for a missing explicit config path', () => {
    assert.throws(() => cfgMod.resolve(root(), { configPath: 'nope.yml' }), /config not found/);
  });

  it('deep merges nested mappings and replaces lists', () => {
    const merged = cfgMod.deepMerge(
      { a: { b: 1, c: 2 }, list: [1, 2] },
      { a: { c: 3 }, list: [9] },
    );
    assert.deepStrictEqual(merged, { a: { b: 1, c: 3 }, list: [9] });
  });

  it('exposes a severity for every known rule', () => {
    const cfg = cfgMod.resolve(root());
    for (const name of Object.keys(cfgMod.RULE_DEFAULTS)) {
      assert.ok(
        cfgMod.SEVERITIES.includes(cfg.audit.rules[name]),
        `${name} resolved to a valid severity`,
      );
    }
  });
});
