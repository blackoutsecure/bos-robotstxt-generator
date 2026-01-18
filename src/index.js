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

const { normalizeUrl, formatFileSize, findPublicDir, inferSiteUrl } = require('./lib/utils');
const { getRobotsTxtHeader } = require('./lib/project-config');
const { validateRobotsTxt } = require('./lib/validation');
const { printHeader, printFooter } = require('./lib/output-formatter');

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

function splitList(raw) {
  return (raw || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function ensureLeadingSlash(input) {
  return input.startsWith('/') ? input : `/${input}`;
}

async function run() {
  try {
    printHeader(core);

    const ROBOTS_MAX_SIZE_KB = getRobotsMaxSizeKb();
    const allowAutodetect = toBool(core.getInput('allow_autodetect') || 'true', true);
    const strictValidation = toBool(core.getInput('strict_validation') || 'true', true);

    // Get robots.txt configuration
    let siteUrl = (core.getInput('site_url') || '').trim();
    let publicDir = core.getInput('public_dir') || 'dist';
    const robotsOutputDir = core.getInput('robots_output_dir') || publicDir;
    const robotsFilename = core.getInput('robots_filename') || 'robots.txt';
    const robotsUserAgent = core.getInput('robots_user_agent') || '*';
    const robotsDisallow = splitList(core.getInput('robots_disallow'));
    const robotsAllow = splitList(core.getInput('robots_allow'));
    const robotsCrawlDelay = (core.getInput('robots_crawl_delay') || '').trim();
    const robotsComments = toBool(core.getInput('robots_comments') || 'true', true);
    const sitemapUrls = splitList(core.getInput('sitemap_urls'));
    const debugShowRobots = toBool(core.getInput('debug_show_robots'), false);
    const uploadArtifacts = toBool(core.getInput('upload_artifacts'), false);
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

    if (sitemapUrls.length > 0) {
      core.info(`   Sitemap URLs:        ${sitemapUrls.length} URL(s)`);
      sitemapUrls.forEach((url) => core.info(`      - ${url}`));
    }

    if (robotsComments) {
      core.info(`   Custom Comments:     Yes`);
    }

    core.info(`   Strict Validation:   ${strictValidation ? 'Enabled' : 'Disabled'}`);
    core.info(`   Upload Artifacts:    ${uploadArtifacts ? 'Enabled' : 'Disabled'}`);

    core.info('\n📝 Generating robots.txt...\n');

    // Build robots.txt content
    let robotsContent = robotsComments ? getRobotsTxtHeader() : '';

    robotsContent += `\nUser-agent: ${robotsUserAgent}\n`;

    // Build Allow/Disallow sections
    if (robotsDisallow.length === 0 && robotsAllow.length === 0) {
      robotsContent += 'Disallow:\n';
    } else {
      if (robotsAllow.length > 0) {
        robotsAllow.forEach((allow) => {
          robotsContent += `Allow: ${ensureLeadingSlash(allow)}\n`;
        });
      }
      if (robotsDisallow.length > 0) {
        robotsDisallow.forEach((disallow) => {
          robotsContent += `Disallow: ${ensureLeadingSlash(disallow)}\n`;
        });
      }
    }

    // Add Crawl-delay if specified
    if (robotsCrawlDelay) {
      robotsContent += `Crawl-delay: ${robotsCrawlDelay}\n`;
    }

    // Add Sitemap directives
    const normalizedSitemaps = sitemapUrls.map((url) => {
      // If the URL doesn't start with http, treat it as a path and prepend site_url
      if (!/^https?:\/\//i.test(url)) {
        return normalizeUrl(siteUrl, ensureLeadingSlash(url));
      }
      return url;
    });

    if (normalizedSitemaps.length > 0) {
      robotsContent += '\n';
      normalizedSitemaps.forEach((url) => {
        robotsContent += `Sitemap: ${url}\n`;
      });
    }

    const robotsPath = path.join(robotsOutputDir, robotsFilename);

    // Validate robots.txt content
    const validationResults = validateRobotsTxt(robotsContent, {
      strict: strictValidation,
      maxSizeKB: ROBOTS_MAX_SIZE_KB,
      requireSitemap: false,
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
          `⚠️  Failed to upload artifacts: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    printFooter(core);

    // Set output
    core.setOutput('robots_path', robotsPath);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
