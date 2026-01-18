// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blackout Secure Robots TXT Generator GitHub Action
// Copyright © 2025-2026 Blackout Secure
// Licensed under Apache License 2.0
// Website: https://blackoutsecure.app
// Repository: https://github.com/blackoutsecure/bos-robotstxt-generator
// Issues: https://github.com/blackoutsecure/bos-robotstxt-generator/issues
// Docs: https://github.com/blackoutsecure/bos-robotstxt-generator#readme
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Unit tests for URL utility helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const assert = require('assert');
const { normalizeUrl, _normalizePathToUrl } = require('../../src/lib/utils');

describe('URL Utils', () => {
  describe('normalizeUrl', () => {
    it('should normalize relative URLs correctly', () => {
      const result = normalizeUrl('https://example.com', '/page.html');
      assert.strictEqual(result, 'https://example.com/page.html');
    });

    it('should handle base URL without trailing slash', () => {
      const result = normalizeUrl('https://example.com', '/page.html');
      assert.strictEqual(result, 'https://example.com/page.html');
    });

    it('should handle base URL with trailing slash', () => {
      const result = normalizeUrl('https://example.com/', '/page.html');
      assert.strictEqual(result, 'https://example.com/page.html');
    });

    it('should handle relative paths without leading slash', () => {
      const result = normalizeUrl('https://example.com', 'page.html');
      assert.strictEqual(result, 'https://example.com/page.html');
    });

    it('should handle paths with dots', () => {
      const result = normalizeUrl('https://example.com', './page.html');
      assert.strictEqual(result, 'https://example.com/page.html');
    });

    it('should handle nested paths', () => {
      const result = normalizeUrl('https://example.com', '/blog/post.html');
      assert.strictEqual(result, 'https://example.com/blog/post.html');
    });

    it('should handle root path', () => {
      const result = normalizeUrl('https://example.com', '/');
      assert.strictEqual(result, 'https://example.com/');
    });
  });
});
