// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// Website: https://blackoutsecure.app
// Repository: https://github.com/blackoutsecure/bos-robotstxt-generator
// Issues: https://github.com/blackoutsecure/bos-robotstxt-generator/issues
// Docs: https://github.com/blackoutsecure/bos-robotstxt-generator#readme
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generates robots.txt files for web applications with validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const core = require('@actions/core');
const path = require('path');
const fs = require('fs');

let artifactClient = null;
try {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const artifact = require('@actions/artifact');
    if (artifact?.DefaultArtifactClient) {
      artifactClient = new artifact.DefaultArtifactClient();
    } else if (artifact?.default?.uploadArtifact) {
      artifactClient = artifact.default;
    }
  }
} catch {
  // Artifact client not available in local dev
}

const { formatFileSize, findPublicDir, inferSiteUrl } = require('./lib/utils');
const { validateRobotsTxt } = require('./lib/validation');
const { printHeader, printFooter } = require('./lib/output-formatter');
const { buildRobotsTxt, resolveSitemaps } = require('./lib/robots-builder');
const cfgMod = require('./lib/config');
const auditMod = require('./lib/audit');
const sarifMod = require('./lib/sarif');
const reportMod = require('./lib/report');
const aiMod = require('./lib/ai');
const { packageMetadata } = require('./lib/metadata');

function getRobotsMaxSizeKb() {
  return parseInt(process.env.TEST_ROBOTS_MAX_SIZE_KB || '500', 10);
}

function toBool(value, fallback) {
  if (typeof value === 'string' && value.length > 0) {
    return /^true$/i.test(value);
  }
  if (typeof value === 'boolean') return value;
  return fallback;
}

/**
 * Read a boolean action input, falling back to the layered config value.
 * @param {string} name - Action input name.
 * @param {boolean} fallback - Config-derived default.
 * @returns {boolean} Resolved boolean.
 */
function boolInput(name, fallback) {
  return toBool((core.getInput(name) || '').trim(), fallback);
}

/**
 * Split a list input on commas or newlines.
 *
 * `action.yml` documents these inputs as comma-separated, so splitting on
 * newlines alone silently collapsed `"/a/,/b/"` into one bogus rule.
 *
 * @param {string} raw - Raw input value.
 * @returns {string[]} Trimmed, non-empty entries.
 */
function splitList(raw) {
  return (raw || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Resolve the tri-state `use_global_config` input.
 * @returns {boolean|null} true = require, false = disable, null = auto.
 */
function globalConfigMode() {
  const raw = (core.getInput('use_global_config') || 'auto').trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

async function run() {
  try {
    printHeader(core);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Layered configuration
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Precedence: action input (when set) > repository config > global
    // config > bundled marketplace baseline > built-in default.
    let cfg;
    try {
      cfg = cfgMod.resolve(process.cwd(), {
        configPath: core.getInput('config_path') || '',
        globalConfigPath: core.getInput('global_config_path') || cfgMod.DEFAULT_GLOBAL_CONFIG_PATH,
        useGlobalConfig: globalConfigMode(),
        useMarketplaceConfig: boolInput('use_marketplace_config', true),
        repoName: (process.env.GITHUB_REPOSITORY || '').split('/')[1] || '',
      });
    } catch (configError) {
      core.setFailed(`❌ Configuration error: ${configError.message}`);
      return;
    }

    const pkg = packageMetadata();
    core.info(`⚙️  ${pkg.name} v${pkg.version}`);
    core.info('   Config cascade:');
    for (const source of cfg.sourcePaths) {
      core.info(`      - ${source}`);
    }
    core.setOutput('config_sources', cfg.sourcePaths.join(','));

    const ROBOTS_MAX_SIZE_KB = getRobotsMaxSizeKb();
    const allowAutodetect = toBool(core.getInput('allow_autodetect') || 'true', true);
    const strictValidation = toBool(core.getInput('strict_validation') || 'true', true);

    // Get robots.txt configuration
    let siteUrl = (core.getInput('site_url') || '').trim();
    let publicDir = core.getInput('public_dir') || 'dist';
    const robotsOutputDir = core.getInput('robots_output_dir') || publicDir;
    const robotsFilename = core.getInput('robots_filename') || cfg.generate.filename;
    const robotsUserAgent = core.getInput('robots_user_agent') || '*';
    const robotsDisallow = splitList(core.getInput('robots_disallow'));
    const robotsAllow = splitList(core.getInput('robots_allow'));
    const robotsCrawlDelay = (core.getInput('robots_crawl_delay') || '').trim();
    const robotsComments = boolInput('robots_comments', cfg.generate.includeComments);
    const sitemapUrls = splitList(core.getInput('sitemap_urls'));
    const includeSitemap = boolInput('include_sitemap', cfg.generate.includeSitemap);
    const sitemapFilename = core.getInput('sitemap_filename') || cfg.generate.sitemapFilename;
    const debugShowRobots = toBool(core.getInput('debug_show_robots'), false);
    const uploadArtifacts = toBool(core.getInput('upload_artifacts') || 'true', true);
    const artifactName = core.getInput('artifact_name') || 'robots-file';
    const artifactRetentionDays =
      parseInt(core.getInput('artifact_retention_days') || '0', 10) || undefined;

    // Auto-detect public_dir and site_url
    if (allowAutodetect) {
      const detectedDir = findPublicDir(publicDir);
      if (detectedDir && detectedDir !== publicDir) {
        core.info(`🔧 Auto-detected public_dir: ${detectedDir}`);
        publicDir = detectedDir;
      }

      if (!siteUrl) {
        const inferred = inferSiteUrl(publicDir);
        if (inferred) {
          siteUrl = inferred;
          core.info(`🔧 Auto-inferred site_url: ${siteUrl}`);
        }
      }
    }

    // Validate inputs
    if (!siteUrl) {
      core.setFailed('❌ site_url is required or could not be auto-detected');
      return;
    }

    if (!/^https?:\/\//i.test(siteUrl)) {
      core.setFailed('❌ site_url must start with http:// or https://');
      return;
    }

    if (!fs.existsSync(publicDir)) {
      core.setFailed(`❌ public_dir not found: ${publicDir}`);
      return;
    }

    if (!fs.existsSync(robotsOutputDir)) {
      fs.mkdirSync(robotsOutputDir, { recursive: true });
      core.info(`📁 Created robots_output_dir: ${robotsOutputDir}`);
    }

    core.info('\n⚙️  Configuration:');
    core.info(`   Site URL:            ${siteUrl}`);
    core.info(`   Public Directory:    ${publicDir}`);
    core.info(`   Robots Output Dir:   ${robotsOutputDir}`);
    core.info(`   Robots Filename:     ${robotsFilename}`);
    core.info(`   User-Agent:          ${robotsUserAgent}`);

    if (robotsDisallow.length > 0) {
      core.info(`   Disallow Paths:      ${robotsDisallow.join(', ')}`);
    } else {
      core.info('   Disallow Paths:      (none - allow all)');
    }

    if (robotsAllow.length > 0) {
      core.info(`   Allow Paths:         ${robotsAllow.join(', ')}`);
    }

    if (robotsCrawlDelay) {
      core.info(`   Crawl Delay:         ${robotsCrawlDelay}s`);
    }

    if (includeSitemap) {
      core.info(`   Default Sitemap:     ${sitemapFilename}`);
    }

    if (sitemapUrls.length > 0) {
      core.info(`   Additional Sitemaps: ${sitemapUrls.length} URL(s)`);
      sitemapUrls.forEach((url) => core.info(`      - ${url}`));
    }

    if (robotsComments) {
      core.info(`   Custom Comments:     Yes`);
    }

    core.info(`   Strict Validation:   ${strictValidation ? 'Enabled' : 'Disabled'}`);
    core.info(`   Upload Artifacts:    ${uploadArtifacts ? 'Enabled' : 'Disabled'}`);

    core.info('\n📝 Generating robots.txt...\n');

    // The action inputs describe one group; config can declare more, and
    // an explicitly configured group for the same agent wins.
    const inputGroup = {
      userAgent: robotsUserAgent,
      allow: robotsAllow,
      disallow: robotsDisallow,
      crawlDelay: robotsCrawlDelay,
    };
    const configuredAgents = new Set(cfg.groups.map((group) => group.userAgent.toLowerCase()));
    const groups = configuredAgents.has(inputGroup.userAgent.toLowerCase())
      ? cfg.groups.map((group) => ({ ...group }))
      : [inputGroup, ...cfg.groups.map((group) => ({ ...group }))];

    const normalizedSitemaps = resolveSitemaps({
      siteUrl,
      includeSitemap,
      sitemapFilename,
      extra: [...sitemapUrls, ...cfg.sitemaps],
    });

    const robotsContent = buildRobotsTxt({
      groups,
      sitemaps: normalizedSitemaps,
      includeComments: robotsComments,
    });

    const robotsPath = path.join(robotsOutputDir, robotsFilename);

    // Validate robots.txt content
    const validationResults = validateRobotsTxt(robotsContent, {
      strict: strictValidation,
      maxSizeKB: ROBOTS_MAX_SIZE_KB,
      requireSitemap: false,
      publicDir: publicDir,
      siteUrl: siteUrl,
    });

    core.info('\n🔍 Validation:');
    let hasErrors = false;
    for (const result of validationResults) {
      if (result.type === 'error') {
        core.error(`   ${result.message}`);
        hasErrors = true;
      } else if (result.type === 'warning') {
        core.warning(`   ${result.message}`);
      } else {
        core.info(`   ${result.message}`);
      }
    }

    if (hasErrors && strictValidation) {
      core.setFailed('❌ Robots.txt validation failed (see errors above)');
      return;
    }

    // Write robots.txt to disk
    fs.writeFileSync(robotsPath, robotsContent);
    const robotsSize = fs.statSync(robotsPath).size;
    core.info(`✅ robots.txt written: ${robotsPath}`);
    core.info(`   Size: ${formatFileSize(robotsSize)}`);

    // Debug output
    if (debugShowRobots) {
      core.info('\n📋 Generated robots.txt:');
      core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      robotsContent.split('\n').forEach((line) => core.info(line));
      core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Optional artifact upload
    if (uploadArtifacts && artifactClient) {
      try {
        const files = [robotsPath];
        const uploadOptions = { retentionDays: artifactRetentionDays };
        core.info('\n📦 Uploading artifacts...');
        await artifactClient.uploadArtifact(artifactName, files, robotsOutputDir, uploadOptions);
        core.info(`✅ Artifact uploaded: ${artifactName}`);
      } catch (err) {
        core.warning(
          `⚠️  Failed to upload artifacts: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    printFooter(core);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RFC 9309 Audit + Reporting
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (boolInput('enable_audit', cfg.audit.enable)) {
      const auditResult = auditMod.audit({
        cfg,
        content: robotsContent,
        filePath: robotsPath,
        siteUrl,
        publicDir,
        outputDir: robotsOutputDir,
      });

      reportMod.printAuditTable(core, auditResult);

      const failOnInput = (core.getInput('audit_fail_on') || '').trim();
      const failOn = cfgMod.FAIL_ON_LEVELS.includes(failOnInput) ? failOnInput : cfg.audit.failOn;
      if (failOnInput && !cfgMod.FAIL_ON_LEVELS.includes(failOnInput)) {
        core.warning(
          `audit_fail_on: '${failOnInput}' is not one of ${cfgMod.FAIL_ON_LEVELS.join(', ')}; using '${failOn}'.`,
        );
      }
      const failRun = auditMod.shouldFail(auditResult, failOn);
      reportMod.annotate(core, auditResult, failRun);

      const remediation = {
        ...cfg.remediation,
        enableAiFindingsSummary: boolInput(
          'enable_ai_summary',
          cfg.remediation.enableAiFindingsSummary,
        ),
        aiFindingsSummaryProvider:
          core.getInput('ai_provider') || cfg.remediation.aiFindingsSummaryProvider,
      };
      const summary = await aiMod.buildSummary(auditResult, remediation);
      if (summary.text) {
        core.info('');
        core.info(`🤖 Findings summary (${summary.provider}):`);
        for (const line of summary.text.split('\n')) {
          core.info(`   ${line}`);
        }
      }

      const sarifPath = core.getInput('sarif_output') || '';
      if (cfg.reporting.sarif && sarifPath) {
        try {
          sarifMod.dump(
            sarifMod.merge({
              runs: [sarifMod.auditRun(auditResult.findings, { baseDir: process.cwd() })],
            }),
            sarifPath,
          );
          core.info(`   ✓ SARIF written: ${sarifPath}`);
          core.setOutput('sarif_path', sarifPath);
        } catch (err) {
          core.warning(`   ⚠️  Failed to write SARIF: ${err.message}`);
        }
      }

      const reportPath = core.getInput('report_json') || '';
      if (cfg.reporting.jsonReport && reportPath) {
        try {
          reportMod.writeJsonReport(auditResult, reportPath, {
            ai_summary: summary.text,
            ai_provider: summary.provider,
            config_sources: [...cfg.sourcePaths],
            package: pkg,
          });
          core.info(`   ✓ JSON report written: ${reportPath}`);
          core.setOutput('report_json_path', reportPath);
        } catch (err) {
          core.warning(`   ⚠️  Failed to write JSON report: ${err.message}`);
        }
      }

      const recommendationsPath = core.getInput('recommendations_json') || '';
      if (cfg.reporting.recommendations && recommendationsPath) {
        try {
          reportMod.writeRecommendations(auditResult, recommendationsPath);
          core.info(`   ✓ Recommendations written: ${recommendationsPath}`);
          core.setOutput('recommendations_json_path', recommendationsPath);
        } catch (err) {
          core.warning(`   ⚠️  Failed to write recommendations: ${err.message}`);
        }
      }

      const skipsPath = core.getInput('skips_json') || '';
      if (skipsPath) {
        try {
          reportMod.writeSkips(auditResult, skipsPath);
          core.info(`   ✓ Skips written: ${skipsPath}`);
        } catch (err) {
          core.warning(`   ⚠️  Failed to write skips: ${err.message}`);
        }
      }

      if (boolInput('step_summary', cfg.reporting.stepSummary)) {
        reportMod.writeStepSummary(auditResult, {
          aiSummary: summary.text,
          aiProvider: summary.provider,
        });
      }

      const totals = auditResult.totals();
      core.setOutput('audit_verdict', auditResult.toJSON().verdict);
      core.setOutput('audit_pass_count', String(totals.pass));
      core.setOutput('audit_warn_count', String(totals.warn));
      core.setOutput('audit_fail_count', String(totals.fail));
      core.setOutput('audit_error_count', String(totals.error));
      core.setOutput('audit_skip_count', String(totals.skip));
      core.setOutput('ai_summary', summary.text);
    } else {
      core.info('');
      core.info('🤖 robots.txt Audit: Disabled');
    }

    // Set output
    core.setOutput('robots_path', robotsPath);
    core.setOutput('group_count', String(groups.length));
    core.setOutput('sitemap_count', String(normalizedSitemaps.length));
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
