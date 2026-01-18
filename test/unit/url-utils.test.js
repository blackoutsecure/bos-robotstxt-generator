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
