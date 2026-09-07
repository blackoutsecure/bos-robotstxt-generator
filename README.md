# Blackout Secure Robots TXT Generator

**Copyright © 2025-2026 Blackout Secure | Apache License 2.0**

[![Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-blue?logo=github)](https://github.com/marketplace/actions/robots-txt-generator)
[![GitHub release](https://img.shields.io/github/v/release/blackoutsecure/bos-robotstxt-generator?sort=semver)](https://github.com/blackoutsecure/bos-robotstxt-generator/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

**Blackout Secure Robots TXT Generator** - Automated `robots.txt` generation for static sites, SSG frameworks (Next.js, Gatsby, Hugo, Jekyll), and dynamic applications. Control crawler access with ease through a simple GitHub Action.

## Quick Start

Add a workflow using this action to automatically generate a `robots.txt` file:

```yaml
name: Generate Robots.txt
on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  generate-robots:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Generate robots.txt
        uses: blackoutsecure/bos-robotstxt-generator@v1
        with:
          site_url: https://example.com
          public_dir: dist
          robots_disallow: /admin/,/private/
```

## Features

- **Protocol Compliant**: Generates `robots.txt` following [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) and the [robots.txt specification](https://www.robotstxt.org/robotstxt.html)
- **Multiple User-agent Groups**: Ship distinct rules for `*`, `Googlebot`, and any other crawler
- **Flexible Configuration**: Control allow/disallow rules through simple input parameters
- **Layered Configuration**: Bundled marketplace baseline → org global config → repo config → action inputs
- **Crawl-policy Audit**: 15 evidence-based controls with per-rule `fail`/`warn`/`skip` severities
- **Enterprise Reporting**: Markdown step summary, SARIF 2.1.0 for code scanning, JSON report, recommendations sidecar
- **AI Findings Summary**: Optional GitHub Models summary with a deterministic local fallback
- **Local CLI**: `bos-robotstxt validate|generate|audit|sarif` reproduces CI output on your machine
- **Sitemap Integration**: Automatically injects `Sitemap:` entries for crawler optimization
- **Validation**: Built-in validation ensures syntax compliance and best practices
- **Artifact Support**: Uploads generated `robots.txt` to GitHub artifacts automatically
- **Zero Configuration**: Sensible defaults work out of the box for most projects
- **Wildcard Support**: Use `*` and `$` for pattern matching in disallow rules

## Inputs

| Input                     | Type    | Default              | Description                                                            |
| ------------------------- | ------- | -------------------- | ---------------------------------------------------------------------- |
| `site_url`                | string  | required             | Base site URL (e.g., https://example.com)                              |
| `public_dir`              | string  | `dist`               | Directory to write robots.txt                                          |
| `robots_output_dir`       | string  | same as `public_dir` | Override output directory                                              |
| `robots_filename`         | string  | `robots.txt`         | Output filename                                                        |
| `robots_user_agent`       | string  | `*`                  | User-agent directive for the input-defined group                       |
| `robots_disallow`         | string  | empty                | Comma- or newline-separated disallow paths (e.g., `/admin/,/private/`) |
| `robots_allow`            | string  | empty                | Comma- or newline-separated allow paths (exceptions)                   |
| `robots_crawl_delay`      | string  | empty                | Crawl-delay in seconds                                                 |
| `robots_comments`         | boolean | from config          | Include generator comments                                             |
| `strict_validation`       | boolean | `true`               | Fail on validation errors                                              |
| `sitemap_urls`            | string  | empty                | Comma- or newline-separated sitemap URLs or site-relative paths        |
| `debug_show_robots`       | boolean | `false`              | Display generated robots.txt                                           |
| `upload_artifacts`        | boolean | `true`               | Upload to GitHub artifacts                                             |
| `artifact_name`           | string  | `robots-file`        | Artifact name                                                          |
| `artifact_retention_days` | string  | empty                | Artifact retention (1-90 days)                                         |

### Configuration, Audit & Reporting Inputs

| Input                    | Description                                              | Default                                                         |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------- |
| `config_path`            | Explicit repository config file                          | auto-discover                                                   |
| `global_config_path`     | Organization-level global config                         | `.github/blackout-secure-robotstxt-generator-global-config.yml` |
| `use_global_config`      | Global tier: `auto`, `true` (require), `false` (disable) | `auto`                                                          |
| `use_marketplace_config` | Apply the bundled marketplace baseline                   | `true`                                                          |
| `enable_audit`           | Run the RFC 9309 crawl-policy audit                      | `true`                                                          |
| `audit_fail_on`          | `fail` or `never`; empty uses `robots_txt.audit.fail_on` | from config                                                     |
| `sarif_output`           | Write SARIF 2.1.0 for GitHub code scanning               | disabled                                                        |
| `report_json`            | Write the machine-readable JSON audit report             | disabled                                                        |
| `redact_sensitive`       | Redact credential-shaped values from report surfaces     | true                                                            |
| `redaction_placeholder`  | Replacement text for redacted values                     | `***`                                                           |
| `recommendations_json`   | Write structured remediation recommendations             | disabled                                                        |
| `skips_json`             | Write the skipped-controls sidecar                       | disabled                                                        |
| `step_summary`           | Append the Markdown report to `$GITHUB_STEP_SUMMARY`     | `true`                                                          |
| `enable_ai_summary`      | Generate a natural-language findings summary             | `true`                                                          |
| `ai_provider`            | `auto`, `none`, or a named provider                      | `auto`                                                          |

## Outputs

| Output                      | Description                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `robots_path`               | Path to the generated `robots.txt`                                                 |
| `group_count`               | Number of User-agent groups written                                                |
| `sitemap_count`             | Number of Sitemap directives written                                               |
| `config_sources`            | Applied config tiers, in precedence order                                          |
| `audit_verdict`             | `Pass`, `Review recommended`, `Action required`, `Inconclusive`, or `Not assessed` |
| `audit_pass_count`          | Controls that passed                                                               |
| `audit_warn_count`          | Controls that warned                                                               |
| `audit_fail_count`          | Controls that failed                                                               |
| `audit_error_count`         | Controls that could not be evaluated                                               |
| `audit_skip_count`          | Controls that were not assessed                                                    |
| `sarif_path`                | Written SARIF file, when `sarif_output` is set                                     |
| `report_json_path`          | Written JSON report, when `report_json` is set                                     |
| `recommendations_json_path` | Written recommendations sidecar, when `recommendations_json` is set                |
| `ai_summary`                | Short natural-language summary of the audit findings                               |

## 🗂️ Layered Configuration

Configuration is deep-merged, then validated. Precedence, lowest to highest:

1. **Bundled marketplace baseline** — `src/marketplace-config.json`, shipped with the action
2. **Organization global config** — `.github/blackout-secure-robotstxt-generator-global-config.yml`
3. **Repository config** — first match of `.github/bos-universal-config.json|yml|yaml`, `bos-universal-config.*`, or `.bos-robotstxt.yml|yaml`
4. **Action inputs** — any input you explicitly set wins over every config tier

Unknown top-level keys are ignored so the same `bos-universal-config.json` can be shared
with other Blackout Secure kits. Unknown keys **inside** `robots_txt.audit.rules`, or an
unknown field on a `groups[]` entry, are rejected so a typo fails fast.

Config is the only way to declare **more than one User-agent group** — the action inputs
describe a single group, which is prepended unless config already defines that agent.

```yaml
# .github/bos-universal-config.json (YAML shown for readability)
robots_txt:
  owner: blackoutsecure

  generate:
    include_comments: true
    filename: robots.txt
    include_sitemap: true
    sitemap_filename: sitemap.xml

  groups:
    - user_agent: '*'
      disallow:
        - /admin/
        - /private/
    - user_agent: Googlebot
      allow:
        - /
    - user_agent: GPTBot
      disallow:
        - /

  sitemaps:
    - https://example.com/sitemap-news.xml

  audit:
    enable: true
    fail_on: fail # or `never` to keep the audit advisory
    max_size_kb: 500
    rules:
      require_sitemap: fail
      forbid_disallow_all: fail
      sitemap_file_exists: warn

  reporting:
    step_summary: true
    sarif: true
    json_report: true
    recommendations: true

  remediation:
    enable_ai_findings_summary: true
    ai_findings_summary_provider: auto
    local_heuristic_fallback: true
```

## 🤖 robots.txt Compliance Audit

Every control is evidence-based and configurable through `robots_txt.audit.rules.<name>`.
A rule set to `skip` still emits a finding, so the report records that the control was
deliberately not assessed.

| Rule    | Config key             | Checks                                                     | Default |
| ------- | ---------------------- | ---------------------------------------------------------- | ------- |
| `RB001` | `require_user_agent`   | At least one `User-agent` record exists                    | `warn`  |
| `RB002` | `require_sitemap`      | At least one `Sitemap:` directive is declared              | `warn`  |
| `RB003` | `sitemap_absolute_url` | Sitemap values are absolute URLs                           | `warn`  |
| `RB004` | `sitemap_same_origin`  | Sitemap host matches the declared `site_url`               | `warn`  |
| `RB005` | `sitemap_https`        | Sitemap URLs use HTTPS                                     | `warn`  |
| `RB010` | `forbid_disallow_all`  | The `*` group does not contain `Disallow: /`               | `warn`  |
| `RB011` | `forbid_crawl_delay`   | No `Crawl-delay` (Google ignores it)                       | `skip`  |
| `RB012` | `valid_directives`     | No unrecognised directives or malformed lines              | `warn`  |
| `RB013` | `valid_path_prefixes`  | Allow/Disallow values start with `/` or `*`                | `warn`  |
| `RB014` | `no_duplicate_groups`  | No `User-agent` appears in two groups                      | `warn`  |
| `RB020` | `site_root_location`   | File is written to the published site root                 | `warn`  |
| `RB021` | `file_size_limit`      | File stays within `audit.max_size_kb` (Google caps at 500) | `warn`  |
| `RB022` | `sitemap_file_exists`  | Same-origin `Sitemap:` URLs resolve to a published file    | `skip`  |
| `RB030` | `require_utf8_no_bom`  | UTF-8 encoded without a byte-order mark                    | `warn`  |
| `RB031` | `forbid_html_content`  | File is plain text, not an HTML error page                 | `warn`  |

No rule defaults to `fail`, so adopting the audit never breaks an existing pipeline on
day one. Opt individual rules up to `fail` once your file is clean.

### Reporting example

```yaml
- name: Generate and audit robots.txt
  id: robotstxt
  uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    sarif_output: 'robotstxt-audit.sarif'
    report_json: 'robotstxt-audit.json'
    audit_fail_on: 'never'

- name: Upload audit findings to code scanning
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: robotstxt-audit.sarif

- run: echo "Verdict: ${{ steps.robotstxt.outputs.audit_verdict }}"
```

`skip` findings are intentionally omitted from SARIF — they would clutter the Security
tab with controls that were never assessed. Use `skips_json` when you need that record.

## 🤖 AI Findings Summary

When `enable_ai_summary` is on, the action asks a model for a three-bullet triage summary
of the non-passing findings and appends it to the step summary and JSON report.

- `ai_provider: auto` (default) uses **GitHub Models** whenever `GITHUB_MODELS_TOKEN` or
  `GITHUB_TOKEN` is exposed to the job. Grant `models: read` in the job permissions.
- `ai_provider: none` disables the model call.
- Any other name uses `<NAME>_API_KEY` plus `<NAME>_API_ENDPOINT` from the environment.

AI is never on the critical path: any missing credential, authorization failure, timeout,
or transport error falls back to a deterministic local summary, and the run continues.

## 🖥️ Local CLI

The CLI shares every module with the Action, so a local dry-run produces the same report
as CI — including auditing a `robots.txt` this action did not generate.

```bash
npm install

# Resolve and print the merged configuration cascade
npx bos-robotstxt validate

# Write robots.txt from the resolved configuration
npx bos-robotstxt generate --public-dir dist --site-url https://example.com

# Audit any existing robots.txt and write every report artefact
npx bos-robotstxt audit \
  --public-dir dist \
  --site-url https://example.com \
  --sarif robotstxt-audit.sarif \
  --json robotstxt-audit.json \
  --recommendations robotstxt-recommendations.json \
  --fail-on never

# Merge SARIF logs before a single code-scanning upload
npx bos-robotstxt sarif --input a.sarif --input b.sarif --output merged.sarif
```

Exit codes: `0` success, `1` audit failed under the `fail` policy, `2` usage or
configuration error.

## Usage Examples

### Basic Usage

Allow all robots (default):

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
```

### Block Specific Paths

Disallow admin and private directories:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    robots_disallow: /admin/,/private/
```

Generated output:

```
User-agent: *
Disallow: /admin/
Disallow: /private/
```

### Allow Exceptions

Allow exceptions within disallowed paths:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    robots_disallow: /admin/
    robots_allow: /admin/public/
```

Generated output:

```
User-agent: *
Allow: /admin/public/
Disallow: /admin/
```

### Wildcard Patterns

Use wildcards for pattern matching:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    robots_disallow: /private/*.pdf,/temp*
```

Generated output:

```
User-agent: *
Disallow: /private/*.pdf
Disallow: /temp*
```

Supported patterns:

- `*` - Wildcard (matches any characters)
- `$` - End of URL anchor

### Crawl Delay

Set crawl delay for bot request frequency:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    robots_crawl_delay: 10
```

Generated output:

```
User-agent: *
Disallow:
Crawl-delay: 10
```

**Note**: Google ignores `Crawl-delay`. Use [Google Search Console](https://search.google.com/search-console) instead.

### Block Specific Bot

Block a specific bot while allowing others:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    robots_user_agent: BadBot
    robots_disallow: /
```

Generated output:

```
User-agent: BadBot
Disallow: /
```

### Reference Sitemaps

Include sitemap URLs for crawler optimization:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    sitemap_urls: https://example.com/sitemap.xml,https://example.com/sitemap-mobile.xml
```

Generated output:

```
User-agent: *
Disallow:
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-mobile.xml
```

### Disable Artifacts

Skip automatic GitHub artifact upload:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    upload_artifacts: false
```

### Custom Output Directory

Override where robots.txt is written:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    public_dir: build
    robots_output_dir: public
```

## Configuration Examples

### Next.js Project

```yaml
name: Generate robots.txt for Next.js
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - uses: blackoutsecure/bos-robotstxt-generator@v1
        with:
          site_url: https://example.com
          public_dir: .next/static
```

### Hugo Site

```yaml
name: Generate robots.txt for Hugo
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: peaceiris/actions-hugo@v2
      - run: hugo --minify
      - uses: blackoutsecure/bos-robotstxt-generator@v1
        with:
          site_url: https://example.com
          public_dir: public
```

### Gatsby Site

```yaml
name: Generate robots.txt for Gatsby
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - uses: blackoutsecure/bos-robotstxt-generator@v1
        with:
          site_url: https://example.com
          public_dir: public
```

### Jekyll Site

```yaml
name: Generate robots.txt for Jekyll
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
      - run: bundle install && bundle exec jekyll build
      - uses: blackoutsecure/bos-robotstxt-generator@v1
        with:
          site_url: https://example.com
          public_dir: _site
```

## Protocol Compliance

This action generates `robots.txt` files compliant with the following standards:

- [Robots Exclusion Protocol (robots.txt)](https://www.robotstxt.org/robotstxt.html)
- [Google Search Central - robots.txt Documentation](https://developers.google.com/search/docs/crawling-indexing/robots-txt)
- [RFC 9309 - Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309)

## Local Development

### Setup

```bash
npm install
npm run build
```

### Testing

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run coverage     # Coverage report
npm run lint         # Lint code
npm run format       # Format files
npm run check        # Lint + format + test
```

### Building

```bash
npm run build  # Compile src/index.js to dist/index.js
```

## Releasing a New Version

Use the built-in scripts; they bump versions, run checks, build `dist`, tag, and push.

- Patch: `npm run release patch`
- Minor: `npm run release minor`
- Major: `npm run release major`
- Specific: `npm run release 1.2.3`

Quick version utilities (no release):

- Show: `npm run ver`
- Set: `npm run ver:set 1.2.3`
- Bump: `npm run ver:patch | ver:minor | ver:major`

Publish to Marketplace after tags push:

1. Open the Releases page and draft for your tag (e.g., `v1.2.3`).
2. Check "Publish this Action to the GitHub Marketplace" and pick the category.
3. Publish the release.

## Why `dist/` is Committed

GitHub Actions runners execute the bundled `dist/index.js` directly without installing dependencies. By committing `dist/`:

- ✅ Action runs instantly without network requests
- ✅ No dependency installation failures
- ✅ Reproducible execution across all runners
- ✅ Follows GitHub Actions JavaScript action best practices

Always rebuild and commit `dist/` when publishing a new version.

## Contributing

Thank you for considering a contribution!

### Workflow

1. Fork the repository
2. Create a topic branch: `git checkout -b feat/your-feature`
3. Install dependencies: `npm install`
4. Make changes (update `action.yml` if adding inputs)
5. Build: `npm run build`
6. Run quality checks:
   ```bash
   npm run lint
   npm test
   npm run coverage
   ```
7. Update documentation
8. Commit with conventional style:
   - `feat: add new feature`
   - `fix: correct issue`
   - `docs: update documentation`
   - `refactor: improve code`
9. Push and open a Pull Request

### Testing Guidelines

- Unit tests: Add in `test/unit/` for pure functions
- Integration tests: Add to `test/` directory
- Use fixtures in `test/fixtures/` instead of inline test data
- Ensure `npm run coverage` shows good coverage

### Adding a New Input

1. Add input definition to `action.yml`
2. Handle in `src/index.js` (use `core.getInput`)
3. Add unit tests
4. Update README with examples
5. Rebuild: `npm run build`

## Release Process

Releases use semantic versioning (MAJOR.MINOR.PATCH). Each release includes:

| File            | Update                       |
| --------------- | ---------------------------- |
| `package.json`  | Version number               |
| `dist/index.js` | Compiled action bundle       |
| Git tags        | `vX.Y.Z` and moving tag `vX` |

Users can then use:

- `uses: blackoutsecure/bos-robotstxt-generator@v1.0.0` (specific version)
- `uses: blackoutsecure/bos-robotstxt-generator@v1` (latest v1.x.x)

## FAQ

**Q: How do I exclude a path from crawling?**
A: Use the `robots_disallow` input:

```yaml
robots_disallow: /admin/,/private/,/temp/
```

**Q: Can I allow specific paths within disallowed areas?**
A: Yes, use `robots_allow` for exceptions:

```yaml
robots_disallow: /admin/
robots_allow: /admin/public/
```

**Q: What if I need multiple `robots.txt` files for different sections?**
A: You can run this action multiple times with different `robots_output_dir` values and custom `robots_filename`.

**Q: Does Google respect crawl delays?**
A: No. Google ignores `Crawl-delay`. Use [Google Search Console](https://search.google.com/search-console) to control Google's crawl rate.

**Q: Can I validate my robots.txt before using it?**
A: Yes. This action includes built-in validation. Enable `strict_validation: true` to fail on errors.

**Q: Do I need to commit the generated robots.txt?**
A: It depends on your deployment strategy. GitHub Actions artifacts are temporary (default 35 days). For persistence, commit to your repository or deploy directly to your web server.

## Troubleshooting

### Action fails with "site_url is required"

The `site_url` input is mandatory. Provide it in your workflow:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
```

### Generated robots.txt doesn't appear in artifacts

1. Check that `upload_artifacts: true` (default)
2. Verify `public_dir` or `robots_output_dir` exists
3. Check artifact retention settings
4. Review workflow logs for errors

### Validation fails

Enable debug output to see issues:

```yaml
- uses: blackoutsecure/bos-robotstxt-generator@v1
  with:
    site_url: https://example.com
    debug_show_robots: true
    strict_validation: false
```

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

## Support

- 📖 [Robots.txt Specification](https://www.robotstxt.org/)
- 🔍 [Google Search Central](https://developers.google.com/search)
- 💬 [GitHub Issues](https://github.com/blackoutsecure/bos-robotstxt-generator/issues)
- 🤝 [Contributing Guide](CONTRIBUTING.md)

---

Made with ❤️ by [Blackout Secure](https://github.com/blackoutsecure)

<!-- >>> managed-file-sync:security_readme_pointer >>> -->

## Security & secrets

This repository is built with Blackout Secure's reusable GitHub Actions
workflows. If you fork or self-host these workflows and need to provision
your own credentials (GitHub App vs. PAT guidance, secret tiers, Docker
Hub/Cloudflare/Balena setup walkthroughs), see the
["Secrets pipelining strategy"](https://github.com/blackoutsecure/bos-automation-hub#secrets-pipelining-strategy)
section of `bos-automation-hub`. To report a vulnerability, see
[SECURITY.md](https://github.com/blackoutsecure/.github/blob/main/SECURITY.md).

<!-- <<< managed-file-sync:security_readme_pointer <<< -->
