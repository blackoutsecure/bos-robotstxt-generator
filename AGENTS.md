# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## What this is

`bos-robotstxt-generator` is a GitHub Marketplace JavaScript action that writes a
standards-compliant `robots.txt` into a published site directory, then audits it against
RFC 9309 and the Google robots.txt guidance. Generation assembles one or more `User-agent`
records with `Allow`, `Disallow`, and `Crawl-delay` lines, appends `Sitemap:` directives
resolved against `site_url`, and writes the file to `robots_output_dir` (defaulting to
`public_dir`). The audit runs 15 evidence-based controls (`RB001`-`RB031`) and reports
through a console table, a Markdown step summary, SARIF 2.1.0, a JSON report, a
recommendations sidecar, and a skipped-controls sidecar.

The verified consumer is `blackoutsecure/bos-automation-hub`, whose reusable
`.github/workflows/deploy-cloudflare-pages.yml` runs the "Generate robots.txt" step pinned
at `blackoutsecure/bos-robotstxt-generator@0a4523ab7fd22579799d5406247f7724b6728293 # v1.2.0`
when `inputs.generate_robots` is set. That workflow sparse-checks the org-tier default
policy from `bos-automation-hub` at
`sync-files/config/robotstxt-generator-global-config.json` and passes it as
`global_config_path`; the hub file keeps `audit.fail_on: never`, promotes ten rules to
`fail`, and disables the AI summary. The hub also lists this repository in
`.github/bos-universal-config.json` under the action-pin bumper's `repositories`.

Stack: Node.js `>=20` (`runs.using: node20`), CommonJS throughout, bundled with
`@vercel/ncc` `^0.38.1`. Runtime dependencies are `@actions/core` `^1.11.1`,
`@actions/artifact` `^2.1.2`, and `js-yaml` `^4.3.1`. Dev tooling is `eslint` `^9.12.0`
with `@eslint/js` `^9.39.1`, `prettier` `^3.3.3`, `mocha` `^10.8.2`, and `nyc` `^17.1.0`.
Package version `1.2.0`, mirrored in `src/lib/project-config.js` and kept in sync by
`src/lib/version.js`. A `bos-robotstxt` CLI (`src/cli.js`) shares every module with the
action so a local dry-run reproduces CI output.

## Commands

```bash
npm install                              # dev install; `prepare` runs the build

npm run build                            # ncc build src/index.js -o dist  (prebuild runs validate)
npm test                                 # mocha via .mocharc.json (pretest runs the build)
npx mocha test/unit/config.test.js       # one test file, bypassing the pretest build
npm run lint:check                       # eslint .
npm run lint                             # eslint . --fix
npm run format:check                     # prettier --check "**/*.{js,json,md}"
npm run format                           # prettier --write
npm run validate                         # lint:check + format:check
npm run verify                           # validate + test
npm run coverage                         # nyc npm test

npx bos-robotstxt validate                                   # print the merged config cascade
npx bos-robotstxt generate --public-dir dist --site-url https://example.com
npx bos-robotstxt audit --public-dir dist --site-url https://example.com --fail-on never
npx bos-robotstxt sarif --input a.sarif --input b.sarif --output merged.sarif
```

CLI exit codes: `0` success, `1` audit failed under the `fail` policy, `2` usage or
configuration error.

## Validating changes

CI is hub-driven. The only workflow file in this repository is
`.github/workflows/bos-universal-gatekeeper-kicker.yml`, the hub-managed single front door
that authorizes a dispatch and then routes to the hub's reusable backends in this order:
`authorize` (via `blackoutsecure/bos-workflow-gatekeeper`), `resolve-target-ref`,
`sync-check` (managed-file reconciliation), `parse-config`, then the selected operation —
`bos-universal-gatekeeper.yml`, `bos-universal-sync.yml`, `bos-universal-action-test.yml`,
`repo-metadata-sync.yml`, `bos-universal-marketplace.yml`, or `release-promote.yml`. Gate
behaviour comes from `.github/bos-universal-config.json`, not from the kicker.

Locally, work narrowest first: `npx mocha test/unit/<file>.test.js` for the module you
touched, then `npm test` for the full suite, then `npm run validate` for ESLint and
Prettier, then `npm run build` to regenerate `dist/index.js`. Commit the rebuilt bundle in
the same change as the `src/` edit. `npm test` already triggers `pretest` -> `build` ->
`prebuild` -> `validate`, so a lint or format failure blocks the test run before Mocha
starts.

The suite proves the config cascade and its validation errors, the robots.txt content
builder and sitemap resolver, every audit rule, the parser helpers, URL and file utilities,
findings/SARIF/report/AI rendering, and the CLI entry points. It does not prove that the
composite runs on a real runner, that artifact upload works, that GHAS accepts the SARIF,
or that a live AI provider responds — only a real dispatch through the hub covers those.

## Architecture

```text
action.yml                     Marketplace manifest: 31 inputs, 14 outputs, node20 -> dist/index.js
package.json                   Scripts, deps, engines, nyc config, bos-robotstxt bin
dist/index.js                  Committed ncc bundle; the file runners actually execute
src/index.js                   Action entrypoint: inputs, autodetect, generate, validate, audit, report
src/cli.js                     version/validate/generate/audit/sarif subcommands over the same modules
src/lib/config.js              Layered config loader, schema, ConfigError, RULE_DEFAULTS
src/lib/robots-builder.js      buildRobotsTxt + resolveSitemaps (shared by action and CLI)
src/lib/robots-parser.js       parseRobotsTxt, readRobotsDisallows, pattern matching
src/lib/validation.js          Pre-write validateRobotsTxt (size, User-agent, Sitemap sanity)
src/lib/audit.js               RFC 9309 audit; one evaluate() call per RB rule
src/lib/findings.js            Finding/AuditResult, severities, rule titles, help links, Markdown
src/lib/sarif.js               SARIF 2.1.0 emitter; drops `skip` findings
src/lib/report.js              Console table, step summary, JSON report, recommendations sidecar
src/lib/ai.js                  Optional AI summary with deterministic local fallback
src/lib/utils.js               normalizeUrl, formatFileSize, findPublicDir, inferSiteUrl
src/lib/output-formatter.js    Branded header/footer for the Actions log
src/lib/project-config.js      Maintainer-only branding, version, reference links
src/lib/metadata.js            Package identity, independent of policy config
src/lib/version.js             Syncs the version across package.json and project-config.js
src/lib/release.js             Version bump, build, test, tag, push
src/marketplace-config.json    Bundled tier-1 baseline, inlined into dist by ncc
.mocharc.json                  require test/test-helpers.js, spec test/unit/**/*.test.js
test/unit/*.test.js            The executed suite (audit, config, reporting-cli, robots-parser, url-utils, utils)
test/fixtures/                 robots/, html/, sitemaps/ inputs used instead of inline data
.github/bos-universal-config.json   Repo-owned overrides (managed_file_sync, marketplace, repo_metadata)
.github/workflows/bos-universal-gatekeeper-kicker.yml   Hub-managed dispatch front door
```

Generation flow. `src/index.js` prints the header, then calls `config.resolve()` before
reading any other input. Configuration is deep-merged lowest to highest: the bundled
`src/marketplace-config.json`, then the global tier (`global_config_path`, default
`.github/blackout-secure-robotstxt-generator-global-config.yml`, tri-state via
`use_global_config`), then the repository tier discovered in `DEFAULT_CONFIG_PATHS` order
(`.github/bos-universal-config.json|yml|yaml`, `bos-universal-config.*`,
`.bos-robotstxt.yml|yaml`, `bos-robotstxt.yml`), then any explicitly set action input.
Each tier reads the `robots_txt` section, or the document itself when that key is absent.
Mappings deep-merge; lists and scalars replace. Unknown top-level keys are ignored so the
same universal config can be shared with sibling kits, but an unknown key inside
`audit.rules` or on a `groups[]` entry is a `ConfigError`. The applied tiers are echoed to
the log and to the `config_sources` output.

With `allow_autodetect` on, `findPublicDir` and `inferSiteUrl` fill in `public_dir` and
`site_url` from a `CNAME` or GitHub Pages layout. A missing or non-`http(s)` `site_url`, or
a missing `public_dir`, fails the run. The input-defined group
(`robots_user_agent`/`robots_allow`/`robots_disallow`/`robots_crawl_delay`) is prepended to
`cfg.groups` unless config already declares that agent, in which case config wins. Config
is the only way to declare more than one group. `resolveSitemaps` combines the conventional
`sitemap_filename` (when `include_sitemap`) with `sitemap_urls` and `cfg.sitemaps`,
resolving site-relative values against `site_url` and de-duplicating. `buildRobotsTxt`
renders the file, `validateRobotsTxt` runs first and aborts under `strict_validation`, then
the file is written to `path.join(robots_output_dir, robots_filename)` and optionally
uploaded as an artifact. When `enable_audit` is on, `audit.audit()` produces findings,
`report`/`sarif`/`ai` emit the surfaces gated by `reporting.*` and the corresponding path
inputs, and `shouldFail` applies `audit_fail_on` (`fail` or `never`).

Action contract. Inputs default as follows: `public_dir` `dist`, `robots_filename`
`robots.txt`, `allow_autodetect` `true`, `robots_user_agent` `*`, `robots_disallow`/
`robots_allow`/`robots_crawl_delay` empty, `robots_comments` `true`, `strict_validation`
`true`, `include_sitemap` `true`, `sitemap_filename` `sitemap.xml`, `debug_show_robots`
`false`, `upload_artifacts` `true`, `artifact_name` `robots-file`, `global_config_path`
`.github/blackout-secure-robotstxt-generator-global-config.yml`, `use_global_config`
`auto`, `use_marketplace_config` `true`, `enable_audit` `true`, `step_summary` `true`,
`enable_ai_summary` `true`, `ai_provider` `auto`. `site_url`, `robots_output_dir`,
`sitemap_urls`, `artifact_retention_days`, `config_path`, `audit_fail_on`, `sarif_output`,
`report_json`, `recommendations_json`, and `skips_json` have no default; the four report
path inputs disable their artefact when empty. Outputs: `robots_path`, `group_count`, `sitemap_count`,
`config_sources`, `audit_verdict`, `audit_pass_count`, `audit_warn_count`,
`audit_fail_count`, `audit_error_count`, `audit_skip_count`, `sarif_path`,
`report_json_path`, `recommendations_json_path`, `ai_summary`.

`src/` to `dist/` relationship. `dist/index.js` is committed build output produced solely by
`npm run build`, which is `ncc build src/index.js -o dist`. It is never hand-edited. Runners
execute it directly with no dependency install, so any change under `src/` — including
`src/marketplace-config.json`, which ncc inlines through a `require` rather than a runtime
file read — must ship with a rebuilt `dist/index.js` in the same commit. `dist` is listed in
both `marketplace.allowlist_paths` and `marketplace.required_paths` in
`.github/bos-universal-config.json`, so a promotion with a stale bundle publishes stale code.
ESLint and Prettier both ignore `dist/`, so nothing else will catch drift.

## Conventions

CommonJS only (`require`/`module.exports`), matching `sourceType: 'commonjs'` in
`eslint.config.js`; there is no ESM entrypoint and ncc bundles the CJS graph. ESLint runs
`js.configs.recommended` plus `semi`, single quotes with `avoidEscape`, `prefer-const`,
`no-var`, and `no-unused-vars` as a warning with a leading-underscore escape hatch;
Prettier enforces single quotes, trailing commas, semicolons, and a 100-column width.
Modules are single-purpose and export named functions; every exported function carries a
JSDoc block with `@param`/`@returns`. Comments explain why a non-obvious choice exists
rather than restating the code. Errors surface as `ConfigError` from `src/lib/config.js` or
as `core.setFailed` in `src/index.js`; audit outcomes are data (`Finding`), not exceptions.
Inputs are always read through `@actions/core`, never `process.env`, and list inputs go
through the shared splitter so both separators documented in `action.yml` work:

```js
function splitList(raw) {
  return (raw || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
```

Boolean inputs go through `boolInput(name, fallback)` so an unset input falls through to
the resolved config value instead of forcing a hard-coded default; `use_global_config` is
tri-state and resolved by `globalConfigMode()` to `true`/`false`/`null`.

Adding a new option, end to end: declare it in `action.yml` with a description and default;
add the matching key to the schema in `src/lib/config.js` (and to
`src/marketplace-config.json` when it needs a baseline, plus `RULE_DEFAULTS` and the
`RULE_TITLES`/`RULE_HELP` tables in `src/lib/findings.js` when it is a new audit rule);
read it in `src/index.js` through `core.getInput`/`boolInput` with the config value as the
fallback, and wire it into the CLI in `src/cli.js` if it belongs there; add a test under
`test/unit/`; document it in the `README.md` input or rule table; then run `npm run build`
and commit the regenerated `dist/index.js`.

## Blackout Secure conventions

These apply to every repository in the `blackoutsecure` organization.

### Branch model

- `dev` is the default branch and where all work lands.
- `main` is the promoted stable runtime that consumers reference through `@main`.
- Version tags (`vX.Y.Z` and a floating `vX`) point at promoted runtime commits.
- Promotion is driven from `bos-automation-hub` (`release-promote.yml`). Do not push
  directly to `main` and do not move tags by hand.

### Centrally managed files - do not hand-edit here

`blackoutsecure/bos-automation-hub` distributes these through
`bos-managed-file-sync-action`. Change the source under the hub's `sync-files/`, never the
copy in this repository:

- `LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`
- `.github/FUNDING.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`
- `.github/workflows/bos-universal-gatekeeper-kicker.yml`
- the `# >>> managed-file-sync:<service> >>> ... # <<< managed-file-sync:<service> <<<`
  delimited blocks inside `.editorconfig`, `.markdownlint.yaml`, `.shellcheckrc`,
  `.yamllint.yml`, `.gitignore`, and `README.md`

`.github/bos-universal-config.json` is repo-owned. It holds this repository's overrides on
top of the hub's global config and is the right place to change gate behaviour.

### CI gate

Pushes and pull requests run the hub's reusable `bos-universal-security.yml`, reported as a
single required check. It runs markdownlint, yamllint, shellcheck, and actionlint; ESLint,
Prettier, Ruff, pytest, and Bats where the repository has them; `bos-code-scanning-kit`
(secret scan, SAST, GHAS posture) and CodeQL; dependency review; and compliance checks for
the canonical README header and a conventional-commit PR title
(`feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert: subject`).

Every `uses:` reference in a workflow must be a commit SHA with a trailing version comment,
for example `actions/checkout@<sha> # v4.2.2`.

## Boundaries

### Always

- Rebuild `dist/index.js` with `npm run build` and commit it in the same change as any
  `src/` edit, including edits to `src/marketplace-config.json`.
- Run `npm run validate` and `npm test` before finishing, and add a test under `test/unit/`
  for every new rule, config key, or branch.
- Keep the action and the CLI on the same modules so a local dry-run matches CI.
- Keep every audit control evidence-based, and keep `skip` emitting a finding so an
  unassessed control is recorded rather than silently dropped.
- Keep the AI summary off the critical path: any missing credential, timeout, or transport
  error must fall back to the deterministic local summary.
- Read action inputs through `@actions/core` and default them to the resolved config value.

### Ask first

- Renaming, removing, or re-defaulting an `action.yml` input or output. The hub pins this
  action by SHA in `deploy-cloudflare-pages.yml`, so this is a breaking change for every
  Cloudflare Pages consumer.
- Renumbering or renaming an existing `RB###` rule, or changing a default severity in
  `src/marketplace-config.json` — the hub's org-tier config maps rule names to `fail`.
- Changing the config tier order, `DEFAULT_CONFIG_PATHS`, the `robots_txt` section name, or
  the `fail_on` contract.
- Adding a runtime dependency, a new network call, or a new AI provider.
- Changing the SARIF tool name, rule IDs, or the JSON report and recommendations shapes
  that downstream automation consumes.
- Editing `marketplace.allowlist_paths`, `blocked_paths`, or `required_paths` in
  `.github/bos-universal-config.json`.

### Never

- Never hand-edit `dist/`. It is generated output; regenerate it with `npm run build`.
- Never commit secrets, tokens, API keys, or real credentials to config, tests, or fixtures.
- Never hand-edit centrally managed files or the `managed-file-sync` marker blocks listed
  above, including `.prettierrc.yaml`, which carries its own hub-managed banner.
- Never use an unpinned `uses:` ref; every action reference is a 40-character commit SHA
  with a trailing version comment.
- Never push directly to `main` or move a version tag by hand; promotion runs from the hub.
- Never weaken or disable a check to make a build pass — do not lower a rule severity, add
  an ESLint disable, or set `audit_fail_on: never` to get green.
- Never edit `src/lib/project-config.js` branding or version by hand; use `npm run ver:set`.
- Never commit generated site output (`robots.txt`, `sitemap*.xml`, `humans.txt`) or
  coverage artefacts produced by a local run.
