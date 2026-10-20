import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import vercelHandler from '../api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Module 3: Git Repo & Deployment Pipeline Verification Suite', () => {
  describe('1. Git Repository & .gitignore Configuration', () => {
    it('should have .gitignore containing critical build and sensitive exclusions', () => {
      const gitignorePath = path.join(rootDir, '.gitignore');
      assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      assert.ok(content.includes('node_modules/'), '.gitignore must ignore node_modules/');
      assert.ok(content.includes('dist/'), '.gitignore must ignore dist/');
      assert.ok(content.includes('.vercel/'), '.gitignore must ignore .vercel/');
      assert.ok(content.includes('.env'), '.gitignore must ignore .env files');
      assert.ok(content.includes('*.log'), '.gitignore must ignore log files');
    });
  });

  describe('2. Vercel Configuration (.vercelignore & vercel.json)', () => {
    it('should have .vercelignore excluding test suites, git internals, and dev configs', () => {
      const vercelignorePath = path.join(rootDir, '.vercelignore');
      assert.ok(fs.existsSync(vercelignorePath), '.vercelignore must exist');

      const content = fs.readFileSync(vercelignorePath, 'utf-8');
      assert.ok(content.includes('tests/'), '.vercelignore must exclude tests directory');
      assert.ok(content.includes('.git/'), '.vercelignore must exclude .git directory');
      assert.ok(content.includes('*.test.ts'), '.vercelignore must exclude test files');
      assert.ok(content.includes('.github/'), '.vercelignore must exclude .github directory');
    });

    it('should have valid vercel.json with version 2, rewrites, and security headers', () => {
      const vercelJsonPath = path.join(rootDir, 'vercel.json');
      assert.ok(fs.existsSync(vercelJsonPath), 'vercel.json must exist');

      const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
      assert.equal(config.version, 2, 'vercel.json should be version 2');
      assert.ok(Array.isArray(config.rewrites), 'vercel.json must specify rewrites array');

      // Verify API rewrite
      const apiRewrite = config.rewrites.find((r: any) => r.source === '/api/(.*)');
      assert.ok(apiRewrite, 'vercel.json must have rewrite for /api/(.*)');
      assert.equal(apiRewrite.destination, '/api', 'rewrite must route to /api serverless function');

      // Verify Security Headers
      assert.ok(Array.isArray(config.headers), 'vercel.json must specify security headers');
      const rootHeaders = config.headers.find((h: any) => h.source === '/(.*)');
      assert.ok(rootHeaders, 'Must include global security headers');

      const headerKeys = rootHeaders.headers.map((h: any) => h.key);
      assert.ok(headerKeys.includes('X-Content-Type-Options'), 'Must include X-Content-Type-Options');
      assert.ok(headerKeys.includes('X-Frame-Options'), 'Must include X-Frame-Options');
      assert.ok(headerKeys.includes('X-XSS-Protection'), 'Must include X-XSS-Protection');
    });
  });

  describe('3. Vercel Serverless Function (api/index.ts)', () => {
    it('should handle /api/health and return 200 OK with server status', async () => {
      const res = await request(vercelHandler).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.game, 'Cyberpunk Neon Survivors');
      assert.ok(typeof res.body.uptime === 'number');
    });

    it('should normalize URLs stripped of /api prefix and return 200 OK', async () => {
      const res = await request(vercelHandler).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
    });

    it('should handle /api/highscores GET and return leaderboard list', async () => {
      const res = await request(vercelHandler).get('/api/highscores');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('should handle /api/highscores POST submission', async () => {
      const res = await request(vercelHandler)
        .post('/api/highscores')
        .send({
          playerName: 'DEPLOY_BOT',
          avatar: 'ninja',
          score: 99999,
          wave: 25,
          kills: 450,
          maxCombo: 80,
          favoriteWeapon: 'plasma'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.playerName, 'DEPLOY_BOT');
      assert.equal(res.body.data.score, 99999);
    });
  });

  describe('4. NPM Scripts & CI/CD Pipelines', () => {
    it('should have package.json with standard build and deploy scripts', () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      assert.ok(packageJson.scripts.build, 'Missing "build" script');
      assert.ok(packageJson.scripts.typecheck, 'Missing "typecheck" script');
      assert.ok(packageJson.scripts.test, 'Missing "test" script');
      assert.ok(packageJson.scripts['start:prod'], 'Missing "start:prod" script');
      assert.ok(packageJson.scripts.deploy, 'Missing "deploy" script');
      assert.ok(packageJson.scripts['deploy:vercel'], 'Missing "deploy:vercel" script');
    });

    it('should have cross-platform deploy scripts and GitHub Actions workflow', () => {
      assert.ok(fs.existsSync(path.join(rootDir, 'scripts/deploy.js')), 'scripts/deploy.js must exist');
      assert.ok(fs.existsSync(path.join(rootDir, 'scripts/deploy.ps1')), 'scripts/deploy.ps1 must exist');
      assert.ok(
        fs.existsSync(path.join(rootDir, '.github/workflows/ci-cd.yml')),
        '.github/workflows/ci-cd.yml must exist'
      );
    });
  });
});
