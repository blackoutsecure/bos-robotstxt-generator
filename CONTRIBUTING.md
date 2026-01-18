# Contributing

Thank you for considering a contribution!

## Workflow Overview

1. Fork the repository and create a topic branch: `git checkout -b feat/your-feature`.
2. Install dependencies: `npm install`.
3. Make changes (add inputs? update `action.yml`, implement logic in `src/index.js`).
4. Build: `npm run build` (updates `dist/`).
5. Run quality checks:

```bash
npm run lint
npm test
npm run coverage
```

6. Update documentation (`README.md`) if you add or change inputs.
7. Commit using conventional style (examples below).
8. Push and open a Pull Request.

## Conventional Commit Examples

- `feat: support lastmod git strategy`
- `fix: correct URL normalization for windows paths`
- `docs: clarify strict_validation behavior`
- `refactor: extract html parsing into lib module`
- `chore: update dev dependencies`

## Testing Guidelines

- Unit tests: add in `test/unit/` for pure functions.
- Integration tests: extend `test/sitemap.test.js` for end-to-end scenarios.
- Edge cases: add to `test/edge-cases.test.js` for limits or unusual inputs.
- Use fixtures under `test/fixtures/` instead of inline large strings.

## Adding a New Input

1. Add input definition to `action.yml`.
2. Handle it in `src/index.js` (parse from `core.getInput`).
3. Add unit tests if logic isolated; integration test if affects full run.
4. Document in README (Inputs section + example workflow).
5. Rebuild `dist/` (`npm run build`).

## Release Process

Releases are performed via the `Release` workflow:

- Provide a semantic version (e.g. `v1.2.0`).
- Workflow builds, commits dist (if changed), creates annotated tag, updates moving major tag.
- GitHub Release generated with notes.

Do not manually push tags without running the workflow (ensures consistent build artifact).

## Code Style

- ESLint + Prettier enforce formatting.
- Avoid large inline HTML/XML in tests; store in fixtures.
- Keep functions small and focused.

## Security

See `SECURITY.md` for reporting instructions.

## Need Help?

Open a draft PR early for feedback or create an issue describing the proposal.
