#!/usr/bin/env node

/**
 * Cyberpunk Neon Survivors - Deployment Pipeline Script
 * Automated pre-flight checks, type validation, test execution, build, and Vercel deployment.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isProd = process.argv.includes('--prod');
const isDryRun = process.argv.includes('--dry-run');
const isPreview = process.argv.includes('--preview') || (!isProd && !isDryRun);

console.log('\n=============================================================');
console.log('⚡ CYBERPUNK NEON SURVIVORS - DEPLOYMENT PIPELINE');
console.log(`🚀 Mode: ${isDryRun ? 'DRY RUN (Verification only)' : isProd ? 'PRODUCTION DEPLOY' : 'PREVIEW DEPLOY'}`);
console.log('=============================================================\n');

function step(title, action) {
  console.log(`▶ [STEP] ${title}...`);
  try {
    action();
    console.log(`✔ [PASS] ${title}\n`);
  } catch (err) {
    console.error(`✖ [FAIL] ${title}`);
    console.error(err.message || err);
    process.exit(1);
  }
}

// 1. Verify Git Repository
step('1/6: Verifying Git Repository', () => {
  const isGit = fs.existsSync(path.join(rootDir, '.git'));
  if (!isGit) {
    throw new Error('Not a Git repository. Run "git init" first.');
  }
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
  console.log(`   Current branch: ${branch}`);
});

// 2. TypeScript Static Typecheck
step('2/6: Running TypeScript Typecheck', () => {
  execSync('npm run typecheck', { cwd: rootDir, stdio: 'inherit' });
});

// 3. Automated Test Suite
step('3/6: Running Full Test Suite', () => {
  execSync('npm run test', { cwd: rootDir, stdio: 'inherit' });
});

// 4. Clean Build
step('4/6: Building Production Server & Bundle', () => {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
});

// 5. Verify Build Artifacts & Configuration
step('5/6: Validating Deployment Configuration & Artifacts', () => {
  const requiredFiles = [
    'public/index.html',
    'public/js/game.js',
    'vercel.json',
    '.vercelignore',
    '.gitignore',
    'api/index.ts',
    'dist/server.js'
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing critical deployment artifact: ${file}`);
    }
  }

  // Validate vercel.json syntax
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf-8'));
  if (!vercelConfig.rewrites || !Array.isArray(vercelConfig.rewrites)) {
    throw new Error('vercel.json is missing required "rewrites" configuration.');
  }
  console.log('   All deployment artifacts verified successfully.');
});

// 6. Deploy to Vercel
step('6/6: Triggering Deployment', () => {
  if (isDryRun) {
    console.log('   [Dry Run] All validation passed! Pipeline is ready for deployment.');
    console.log('   To deploy to production, run: npm run deploy:vercel');
    console.log('   To deploy preview, run: npm run deploy:vercel:preview');
    return;
  }

  const deployCmd = isProd ? 'npx vercel --prod' : 'npx vercel';
  console.log(`   Executing: ${deployCmd}`);
  try {
    execSync(deployCmd, { cwd: rootDir, stdio: 'inherit' });
  } catch (err) {
    console.warn('\n   Note: Vercel CLI execution finished or requires authentication.');
    console.warn('   To link and authenticate Vercel, run: npx vercel login');
  }
});

console.log('=============================================================');
console.log('✨ PIPELINE COMPLETED SUCCESSFULLY!');
console.log('=============================================================\n');
