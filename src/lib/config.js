// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layered configuration loader, schema, and defaults.
//
// Configuration is deep-merged in marketplace, global, then repository
// order before schema validation. Both the Action and the CLI resolve
// configuration here so a local dry-run matches CI exactly.
//
// Design notes:
//   * No audit rule defaults to `fail`, so adopting the audit never
//     breaks an existing pipeline on day one.
//   * Unknown top-level keys are NOT an error (forward-compat with the
//     other BOS kits that share `.github/bos-universal-config.json`).
//   * Unknown keys inside `audit.rules` or a `groups[]` entry ARE an
//     error, so a typo fails fast instead of silently doing nothing.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/** Raised when a config file parses but is semantically invalid. */
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

const SEVERITIES = ['fail', 'warn', 'skip'];
const FAIL_ON_LEVELS = ['fail', 'never'];

const CONFIG_SECTION = 'robots_txt';
const MARKETPLACE_CONFIG_FILE = 'marketplace-config.json';
const DEFAULT_GLOBAL_CONFIG_PATH = '.github/blackout-secure-robotstxt-generator-global-config.yml';

const DEFAULT_CONFIG_PATHS = [
  '.github/bos-universal-config.json',
  '.github/bos-universal-config.yml',
  '.github/bos-universal-config.yaml',
  'bos-universal-config.json',
  'bos-universal-config.yml',
  'bos-universal-config.yaml',
  '.bos-robotstxt.yml',
  '.bos-robotstxt.yaml',
  'bos-robotstxt.yml',
];

/** Every audit rule the kit knows about, with its baseline severity. */
const RULE_DEFAULTS = Object.freeze({
  require_user_agent: 'warn',
  require_sitemap: 'warn',
  sitemap_absolute_url: 'warn',
  sitemap_same_origin: 'warn',
  sitemap_https: 'warn',
  forbid_disallow_all: 'warn',
  forbid_crawl_delay: 'skip',
  valid_directives: 'warn',
  valid_path_prefixes: 'warn',
  no_duplicate_groups: 'warn',
  site_root_location: 'warn',
  file_size_limit: 'warn',
  sitemap_file_exists: 'skip',
  require_utf8_no_bom: 'warn',
  forbid_html_content: 'warn',
});

/** Keys accepted on a `groups[]` entry. */
const GROUP_KEYS = ['user_agent', 'allow', 'disallow', 'crawl_delay'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Discovery / resolution
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Find the preferred repository config file.
 * @param {string} cwd - Repository root.
 * @returns {string|null} Absolute path, or null when absent.
 */
function discover(cwd) {
  for (const relative of DEFAULT_CONFIG_PATHS) {
    const candidate = path.resolve(cwd, relative);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve the marketplace, optional global, and repository config tiers.
 *
 * `useGlobalConfig` is tri-state: `null`/`undefined` auto-loads the
 * conventional path when present, `true` requires it, `false` disables it.
 *
 * @param {string} root - Repository root.
 * @param {object} [options] - Resolution options.
 * @param {string} [options.configPath] - Explicit repository config path.
 * @param {string} [options.globalConfigPath] - Global config path.
 * @param {boolean|null} [options.useGlobalConfig] - Tri-state global toggle.
 * @param {boolean} [options.useMarketplaceConfig] - Apply bundled baseline.
 * @param {string} [options.repoName] - Fallback for `project_name`.
 * @returns {object} Resolved config.
 */
function resolve(root, options = {}) {
  const {
    configPath = '',
    globalConfigPath = DEFAULT_GLOBAL_CONFIG_PATH,
    useGlobalConfig = null,
    useMarketplaceConfig = true,
    repoName = '',
  } = options;

  const resolvedRoot = path.resolve(root || '.');

  let repoPath = null;
  if (configPath) {
    repoPath = fromRoot(resolvedRoot, configPath);
    if (!isFile(repoPath)) {
      throw new ConfigError(`config not found: ${repoPath}`);
    }
  } else {
    repoPath = discover(resolvedRoot);
  }

  let globalPath = null;
  if (useGlobalConfig !== false) {
    const candidate = fromRoot(resolvedRoot, globalConfigPath || DEFAULT_GLOBAL_CONFIG_PATH);
    if (isFile(candidate)) {
      globalPath = candidate;
    } else if (useGlobalConfig === true) {
      throw new ConfigError(`global config not found: ${candidate}`);
    }
  }

  return load(repoPath, { globalPath, useMarketplaceConfig, repoName });
}

/**
 * Load and merge the bundled marketplace, global, and repository tiers.
 * @param {string|null} configPath - Repository config path.
 * @param {object} [options] - Load options.
 * @param {string|null} [options.globalPath] - Global config path.
 * @param {boolean} [options.useMarketplaceConfig] - Apply bundled baseline.
 * @param {string} [options.repoName] - Fallback for `project_name`.
 * @returns {object} Resolved config.
 */
function load(configPath, options = {}) {
  const { globalPath = null, useMarketplaceConfig = true, repoName = '' } = options;

  let merged = {};
  const sourcePaths = [];

  if (useMarketplaceConfig) {
    merged = loadMarketplaceSection();
    sourcePaths.push(`bundled:${MARKETPLACE_CONFIG_FILE}`);
  }

  if (globalPath) {
    merged = deepMerge(merged, loadSection(globalPath));
    sourcePaths.push(globalPath);
  }

  if (configPath) {
    merged = deepMerge(merged, loadSection(configPath));
    sourcePaths.push(configPath);
  }

  return fromObject(merged, {
    sourcePath: configPath || globalPath || '',
    sourcePaths,
    repoName,
  });
}

function fromRoot(root, candidate) {
  return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
}

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function loadMarketplaceSection() {
  let doc;
  try {
    // Required (not read from disk) so `ncc` inlines the baseline into the
    // bundled `dist/index.js` instead of resolving a path at runtime.
    doc = require('../marketplace-config.json');
  } catch (err) {
    throw new ConfigError(`failed to load marketplace config: ${err.message}`);
  }
  return extractSection(doc, `bundled:${MARKETPLACE_CONFIG_FILE}`, { clone: true });
}

function loadSection(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ConfigError(`config not found: ${filePath}`);
    }
    throw new ConfigError(`failed to read config ${filePath}: ${err.message}`);
  }

  let doc;
  try {
    doc = yaml.load(text) || {};
  } catch (err) {
    throw new ConfigError(`invalid YAML/JSON in ${filePath}: ${err.message}`);
  }
  return extractSection(doc, filePath);
}

function extractSection(doc, source, { clone = false } = {}) {
  if (!isPlainObject(doc)) {
    throw new ConfigError(`${source}: top-level must be a mapping`);
  }
  const section = Object.prototype.hasOwnProperty.call(doc, CONFIG_SECTION)
    ? doc[CONFIG_SECTION]
    : doc;
  if (!isPlainObject(section)) {
    throw new ConfigError(`${source}: \`${CONFIG_SECTION}\` must be a mapping`);
  }
  // Clone the bundled baseline so a caller mutating the resolved config
  // cannot poison the module-level require cache.
  return clone ? structuredClone(section) : section;
}

/**
 * Recursively merge mappings; lists and scalars are replaced wholesale.
 * @param {object} base - Lower-precedence mapping.
 * @param {object} override - Higher-precedence mapping.
 * @returns {object} Merged mapping.
 */
function deepMerge(base, override) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    const current = merged[key];
    merged[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return merged;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Schema
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function fromObject(doc, { sourcePath = '', sourcePaths = [], repoName = '' }) {
  return Object.freeze({
    owner: readString(doc, 'owner'),
    projectName: readString(doc, 'project_name') || repoName,
    email: readString(doc, 'email'),
    generate: generateFromObject(readMapping(doc, 'generate')),
    groups: Object.freeze(groupsFromObject(doc)),
    sitemaps: readStringList(doc, 'sitemaps'),
    audit: auditFromObject(readMapping(doc, 'audit')),
    reporting: reportingFromObject(readMapping(doc, 'reporting')),
    redaction: redactionFromObject(readMapping(doc, 'redaction')),
    remediation: remediationFromObject(readMapping(doc, 'remediation')),
    sourcePath,
    sourcePaths: Object.freeze([...sourcePaths]),
  });
}

function generateFromObject(d) {
  const filename = readString(d, 'filename', 'robots.txt');
  if (filename.includes('/') || filename.includes('\\') || filename.startsWith('.')) {
    throw new ConfigError(
      `generate.filename: '${filename}' must be a bare filename without path separators`,
    );
  }
  return Object.freeze({
    includeComments: readBool(d, 'include_comments', true),
    filename,
    includeSitemap: readBool(d, 'include_sitemap', true),
    sitemapFilename: readString(d, 'sitemap_filename', 'sitemap.xml'),
  });
}

/**
 * Read the multi-group crawler policy.
 *
 * robots.txt supports one record per user-agent; the config expresses that
 * as a list so a repository can ship distinct rules for `*`, `Googlebot`,
 * and so on rather than a single flattened group.
 *
 * @param {object} doc - Resolved `robots_txt` section.
 * @returns {object[]} Normalised groups.
 */
function groupsFromObject(doc) {
  const value = doc.groups;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ConfigError('groups: must be a list of mappings');
  }

  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new ConfigError(`groups[${index}]: must be a mapping`);
    }
    for (const name of Object.keys(entry)) {
      if (!GROUP_KEYS.includes(name)) {
        throw new ConfigError(
          `groups[${index}].${name}: unknown field (allowed: ${GROUP_KEYS.join(', ')})`,
        );
      }
    }

    const userAgent = readString(entry, 'user_agent', '*');
    if (!userAgent) {
      throw new ConfigError(`groups[${index}].user_agent: must not be empty`);
    }

    const crawlDelay = entry.crawl_delay;
    let normalisedDelay = '';
    if (crawlDelay !== undefined && crawlDelay !== null && crawlDelay !== '') {
      const numeric = Number(crawlDelay);
      if (!Number.isFinite(numeric) || numeric < 0) {
        throw new ConfigError(
          `groups[${index}].crawl_delay: '${crawlDelay}' must be a non-negative number`,
        );
      }
      normalisedDelay = String(crawlDelay);
    }

    return Object.freeze({
      userAgent,
      allow: readStringList(entry, 'allow'),
      disallow: readStringList(entry, 'disallow'),
      crawlDelay: normalisedDelay,
    });
  });
}

function auditFromObject(d) {
  const failOn = readString(d, 'fail_on', 'fail');
  if (!FAIL_ON_LEVELS.includes(failOn)) {
    throw new ConfigError(`audit.fail_on: '${failOn}' is not one of ${FAIL_ON_LEVELS.join(', ')}`);
  }

  const rawRules = readMapping(d, 'rules');
  for (const name of Object.keys(rawRules)) {
    if (!(name in RULE_DEFAULTS)) {
      throw new ConfigError(`audit.rules.${name}: unknown rule`);
    }
  }
  const rules = {};
  for (const [name, fallback] of Object.entries(RULE_DEFAULTS)) {
    rules[name] = readSeverity(rawRules, name, fallback, 'audit.rules');
  }

  return Object.freeze({
    enable: readBool(d, 'enable', true),
    failOn,
    maxSizeKb: readPositiveInt(d, 'max_size_kb', 500),
    rules: Object.freeze(rules),
  });
}

function reportingFromObject(d) {
  return Object.freeze({
    stepSummary: readBool(d, 'step_summary', true),
    sarif: readBool(d, 'sarif', true),
    jsonReport: readBool(d, 'json_report', true),
    recommendations: readBool(d, 'recommendations', true),
  });
}

function redactionFromObject(d) {
  return Object.freeze({
    enabled: readBool(d, 'enabled', true),
    placeholder: readString(d, 'placeholder', '***'),
    extraPatterns: Object.freeze(readStringList(d, 'extra_patterns')),
  });
}

function remediationFromObject(d) {
  return Object.freeze({
    enableAiFindingsSummary: readBool(d, 'enable_ai_findings_summary', true),
    aiFindingsSummaryProvider: readString(d, 'ai_findings_summary_provider', 'auto'),
    localHeuristicFallback: readBool(d, 'local_heuristic_fallback', true),
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Typed accessors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function readMapping(d, key) {
  const value = d[key];
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    throw new ConfigError(`\`${key}\`: must be a mapping`);
  }
  return value;
}

function readString(d, key, fallback = '') {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') {
    throw new ConfigError(`\`${key}\`: must be a string`);
  }
  return value.trim();
}

function readBool(d, key, fallback) {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new ConfigError(`\`${key}\`: must be a boolean (true/false)`);
  }
  return value;
}

function readStringList(d, key) {
  const value = d[key];
  if (value === undefined || value === null) return Object.freeze([]);
  if (typeof value === 'string') {
    return Object.freeze(
      value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
  }
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ConfigError(`\`${key}\`: must be a string or a list of strings`);
  }
  return Object.freeze(value.map((v) => v.trim()).filter(Boolean));
}

function readSeverity(d, key, fallback, prefix) {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (!SEVERITIES.includes(value)) {
    throw new ConfigError(`${prefix}.${key}: '${value}' is not one of ${SEVERITIES.join(', ')}`);
  }
  return value;
}

function readPositiveInt(d, key, fallback) {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConfigError(`\`${key}\`: must be a positive integer`);
  }
  return value;
}

module.exports = {
  ConfigError,
  SEVERITIES,
  FAIL_ON_LEVELS,
  CONFIG_SECTION,
  MARKETPLACE_CONFIG_FILE,
  DEFAULT_GLOBAL_CONFIG_PATH,
  DEFAULT_CONFIG_PATHS,
  RULE_DEFAULTS,
  GROUP_KEYS,
  discover,
  resolve,
  load,
  deepMerge,
};
