import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createServer } from '../src/server.js';
import app from '../api/index.js';

describe('Module 2: Edge Web & Assets Adaptability & HTTPS Edge Vercel Test Suite', () => {
  const rootDir = process.cwd();
  const publicDir = path.resolve(rootDir, 'public');

  describe('1. Public Static Asset Paths & Directory Structure Integrity', () => {
    const requiredFiles = [
      'index.html',
      'favicon.svg',
      'manifest.json',
      'js/main.js',
      'js/game.js',
      'js/audio/soundEngine.js',
      'js/config/vfxConfig.js',
      'js/engine/camera.js',
      'js/engine/spatialGrid.js',
      'js/entities/boss.js',
      'js/entities/drops.js',
      'js/entities/enemies.js',
      'js/entities/player.js',
      'js/entities/weapons.js',
      'js/entities/worldObjects.js',
      'js/vfx/lighting.js',
      'js/vfx/particles.js',
    ];

    it('should have all required client-side static asset files in public directory', () => {
      for (const relFile of requiredFiles) {
        const fullPath = path.resolve(publicDir, relFile);
        assert.ok(
          fs.existsSync(fullPath),
          `Missing required public static asset: ${relFile}`
        );
      }
    });

    it('should have index.html referencing ./js/main.js module correctly', () => {
      const htmlPath = path.resolve(publicDir, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      assert.match(
        html,
        /<script\s+type="module"\s+src="\.\/js\/main\.js"><\/script>/i,
        'index.html must load main entry point using type="module" and relative path'
      );
    });

    it('should define cyberpunk neon favicon and PWA manifest links in index.html', () => {
      const htmlPath = path.resolve(publicDir, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      assert.match(html, /<link\s+rel="icon"[^>]+href="\.\/favicon\.svg"/i);
      assert.match(html, /<link\s+rel="manifest"[^>]+href="\.\/manifest\.json"/i);
    });
  });

  describe('2. ES Module Import Resolution & Linux Case-Sensitivity', () => {
    function getAllJsFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...getAllJsFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          results.push(full);
        }
      }
      return results;
    }

    it('should verify all relative imports in public/js resolve to real files with exact case and .js extension', () => {
      const jsFiles = getAllJsFiles(path.resolve(publicDir, 'js'));
      assert.ok(jsFiles.length >= 10, 'Must have at least 10 public JS files');

      const importRegex = /(?:import|export)\s+.*?\s+from\s+['"](\.[^'"]+)['"]/g;

      for (const filePath of jsFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const specifier = match[1];

          // 1. Must explicitly include .js extension (required by browser native ESM)
          assert.ok(
            specifier.endsWith('.js'),
            `Import in ${path.relative(rootDir, filePath)} must include .js extension: ${specifier}`
          );

          // 2. Target must exist on disk
          const targetPath = path.resolve(path.dirname(filePath), specifier);
          assert.ok(
            fs.existsSync(targetPath),
            `Import target does not exist: ${specifier} in ${path.relative(rootDir, filePath)}`
          );

          // 3. Exact case-sensitivity check for Linux/Vercel Edge compatibility
          const dirOfTarget = path.dirname(targetPath);
          const baseName = path.basename(targetPath);
          const realEntries = fs.readdirSync(dirOfTarget);
          assert.ok(
            realEntries.includes(baseName),
            `Case mismatch detected in ${path.relative(rootDir, filePath)}: '${baseName}' not found in [${realEntries.join(', ')}]`
          );
        }
      }
    });
  });

  describe('3. HTTPS Edge & Zero Mixed Content Audit', () => {
    it('should ensure index.html contains ZERO insecure http:// references', () => {
      const htmlPath = path.resolve(publicDir, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      // Check for any http:// (excluding xmlns if any)
      const matches = html.match(/http:\/\/(?!www\.w3\.org)/gi);
      assert.equal(
        matches,
        null,
        `Detected insecure http:// links in index.html: ${JSON.stringify(matches)}`
      );
    });

    it('should verify all external CDNs in index.html use HTTPS with secure attributes', () => {
      const htmlPath = path.resolve(publicDir, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      // Tailwind CDN
      assert.match(html, /src="https:\/\/cdn\.tailwindcss\.com"/);

      // Google Fonts
      assert.match(html, /href="https:\/\/fonts\.googleapis\.com"/);
      assert.match(html, /href="https:\/\/fonts\.gstatic\.com"\s+crossorigin/);

      // FontAwesome 6 CDN with integrity and crossorigin
      assert.match(html, /href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/);
      assert.match(html, /integrity="sha512-[^"]+"/);
      assert.match(html, /crossorigin="anonymous"/);
    });

    it('should verify all frontend API calls in public/js use root-relative paths without hardcoded http origin', () => {
      const mainJsPath = path.resolve(publicDir, 'js/main.js');
      const content = fs.readFileSync(mainJsPath, 'utf8');

      // Check fetch calls
      const fetchMatches = content.match(/fetch\(['"]([^'"]+)['"]/g) || [];
      for (const fetchCall of fetchMatches) {
        assert.ok(
          !fetchCall.includes('http://'),
          `Found insecure http:// in fetch call: ${fetchCall}`
        );
        assert.ok(
          fetchCall.includes('/api/'),
          `Fetch call should target relative /api/*: ${fetchCall}`
        );
      }
    });
  });

  describe('4. Vercel Configuration & HTTPS Edge Security Headers', () => {
    it('should have a valid vercel.json with version 2 and API rewrites', () => {
      const vercelPath = path.resolve(rootDir, 'vercel.json');
      assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist');
      const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

      assert.equal(config.version, 2);
      assert.ok(Array.isArray(config.rewrites));

      const apiRewrite = config.rewrites.find(
        (r: any) => r.source === '/api/(.*)' && r.destination === '/api'
      );
      assert.ok(apiRewrite, 'vercel.json must rewrite /api/(.*) to /api');
    });

    it('should configure HTTPS Edge security headers and static asset caching in vercel.json', () => {
      const vercelPath = path.resolve(rootDir, 'vercel.json');
      const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

      assert.ok(Array.isArray(config.headers), 'vercel.json must define headers array');

      // Find global security headers
      const globalHeader = config.headers.find((h: any) => h.source === '/(.*)');
      assert.ok(globalHeader, 'Must define global headers for /(.*)');

      const headerMap: Record<string, string> = {};
      for (const item of globalHeader.headers) {
        headerMap[item.key.toLowerCase()] = item.value;
      }

      assert.ok(headerMap['strict-transport-security']?.includes('max-age=31536000'));
      assert.equal(headerMap['x-content-type-options'], 'nosniff');
      assert.equal(headerMap['x-frame-options'], 'SAMEORIGIN');
      assert.equal(headerMap['referrer-policy'], 'strict-origin-when-cross-origin');

      // Find JS caching headers
      const jsHeader = config.headers.find((h: any) => h.source === '/js/(.*)');
      assert.ok(jsHeader, 'Must define caching headers for /js/(.*)');
      const jsCacheControl = jsHeader.headers.find((h: any) => h.key.toLowerCase() === 'cache-control');
      assert.ok(jsCacheControl?.value.includes('stale-while-revalidate'));
    });

    it('should serve Edge & HTTPS security headers from the Express server', async () => {
      const testApp = createServer();
      const res = await request(testApp).get('/api/health');

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.equal(res.headers['x-xss-protection'], '1; mode=block');
      assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    });

    it('should support dual routing (/api/health and /health) on Serverless Express app', async () => {
      const res1 = await request(app).get('/api/health');
      assert.equal(res1.status, 200);
      assert.equal(res1.body.status, 'ok');

      const res2 = await request(app).get('/health');
      assert.equal(res2.status, 200);
      assert.equal(res2.body.status, 'ok');
    });
  });

  describe('5. Mobile Web & Edge Adaptability Assets (Favicon & Manifest)', () => {
    it('should have a valid, well-formed favicon.svg with cyberpunk neon colors', () => {
      const svgPath = path.resolve(publicDir, 'favicon.svg');
      assert.ok(fs.existsSync(svgPath));
      const svg = fs.readFileSync(svgPath, 'utf8');

      assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(svg, /#00f0ff/i, 'Favicon should include neon cyan');
      assert.match(svg, /#ff0080/i, 'Favicon should include neon magenta');
    });

    it('should have a valid manifest.json with PWA configuration for edge web installability', () => {
      const manifestPath = path.resolve(publicDir, 'manifest.json');
      assert.ok(fs.existsSync(manifestPath));
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      assert.equal(manifest.name, 'Cyberpunk Neon Survivors');
      assert.equal(manifest.short_name, 'NeonSurvivors');
      assert.equal(manifest.display, 'standalone');
      assert.equal(manifest.theme_color, '#05070f');
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
    });
  });
});
