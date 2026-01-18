const assert = require('assert');
const path = require('path');
const {
  readRobotsDisallows,
  isPathDisallowed,
} = require('../../src/lib/robots-parser');

describe('Robots Parser', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/robots');

  describe('readRobotsDisallows', () => {
    it('should parse disallow rules from robots.txt', () => {
      const robotsPath = path.join(fixturesDir, 'with-disallows.txt');
      const disallows = readRobotsDisallows(robotsPath);

      assert.ok(Array.isArray(disallows));
      assert.ok(disallows.includes('/admin/'));
      assert.ok(disallows.includes('/private/'));
      assert.ok(disallows.includes('/temp/'));
    });

    it('should return empty array for robots.txt without disallows', () => {
      const robotsPath = path.join(fixturesDir, 'empty.txt');
      const disallows = readRobotsDisallows(robotsPath);

      assert.ok(Array.isArray(disallows));
      assert.strictEqual(disallows.length, 0);
    });

    it('should return empty array for non-existent robots.txt', () => {
      const robotsPath = path.join(fixturesDir, 'nonexistent.txt');
      const disallows = readRobotsDisallows(robotsPath);

      assert.ok(Array.isArray(disallows));
      assert.strictEqual(disallows.length, 0);
    });

    it('should ignore comments and empty lines', () => {
      const robotsPath = path.join(fixturesDir, 'with-disallows.txt');
      const disallows = readRobotsDisallows(robotsPath);

      // Should only have actual disallow paths, not comments
      assert.ok(!disallows.some((d) => d.includes('#')));
    });
  });

  describe('isPathDisallowed', () => {
    it('should detect disallowed paths', () => {
      const disallows = ['/admin/', '/private/', '/temp/'];

      assert.ok(isPathDisallowed('/admin/panel', disallows));
      assert.ok(isPathDisallowed('/private/data', disallows));
      assert.ok(isPathDisallowed('/temp/file.txt', disallows));
    });

    it('should allow non-disallowed paths', () => {
      const disallows = ['/admin/', '/private/'];

      assert.ok(!isPathDisallowed('/public/page', disallows));
      assert.ok(!isPathDisallowed('/about', disallows));
      assert.ok(!isPathDisallowed('/', disallows));
    });

    it('should handle root disallow', () => {
      const disallows = ['/'];

      assert.ok(isPathDisallowed('/any/path', disallows));
      assert.ok(isPathDisallowed('/admin', disallows));
    });

    it('should return false for empty disallow list', () => {
      const disallows = [];

      assert.ok(!isPathDisallowed('/admin/panel', disallows));
      assert.ok(!isPathDisallowed('/any/path', disallows));
    });

    it('should handle exact prefix matching', () => {
      const disallows = ['/admin/'];

      assert.ok(isPathDisallowed('/admin/', disallows));
      assert.ok(isPathDisallowed('/admin/panel', disallows));
      assert.ok(!isPathDisallowed('/administrator', disallows));
    });
  });
});
