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

- **Protocol Compliant**: Generates `robots.txt` following the [robots.txt specification](https://www.robotstxt.org/robotstxt.html)
- **Flexible Configuration**: Control allow/disallow rules through simple input parameters
- **Sitemap Integration**: Automatically injects `Sitemap:` entries for crawler optimization
- **Validation**: Built-in validation ensures syntax compliance and best practices
- **Artifact Support**: Uploads generated `robots.txt` to GitHub artifacts automatically
- **Zero Configuration**: Sensible defaults work out of the box for most projects
- **Wildcard Support**: Use `*` and `$` for pattern matching in disallow rules

## Inputs

| Input                     | Type    | Default              | Description                                                |
| ------------------------- | ------- | -------------------- | ---------------------------------------------------------- |
| `site_url`                | string  | required             | Base site URL (e.g., https://example.com)                  |
| `public_dir`              | string  | `dist`               | Directory to write robots.txt                              |
| `robots_output_dir`       | string  | same as `public_dir` | Override output directory                                  |
| `robots_filename`         | string  | `robots.txt`         | Output filename                                            |
| `robots_user_agent`       | string  | `*`                  | User-agent directive (all robots)                          |
| `robots_disallow`         | string  | empty                | Comma-separated disallow paths (e.g., `/admin/,/private/`) |
| `robots_allow`            | string  | empty                | Comma-separated allow paths (exceptions)                   |
| `robots_crawl_delay`      | string  | empty                | Crawl-delay in seconds                                     |
| `robots_comments`         | boolean | `true`               | Include generator comments                                 |
| `strict_validation`       | boolean | `true`               | Fail on validation errors                                  |
| `sitemap_urls`            | string  | empty                | Comma-separated sitemap URLs to reference                  |
| `debug_show_robots`       | boolean | `false`              | Display generated robots.txt                               |
| `upload_artifacts`        | boolean | `true`               | Upload to GitHub artifacts                                 |
| `artifact_name`           | string  | `robots-file`        | Artifact name                                              |
| `artifact_retention_days` | string  | empty                | Artifact retention (1-90 days)                             |

## Outputs

- `robots_path`: Path to the generated `robots.txt`

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
