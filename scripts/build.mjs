/**
 * scripts/build.mjs
 *
 * Builds all distribution artifacts for Bring Back Live Seek:
 *   dist/bbls.user.js   — Tampermonkey / GreasyFork userscript
 *   dist/chrome.zip     — Chrome Web Store package (Manifest V3)
 *   dist/firefox.zip    — Firefox AMO package    (Manifest V3)
 *
 * Requirements: Node ≥ 18, `zip` CLI available on PATH.
 * No npm dependencies — uses Node built-ins only.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Paths ─────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dirname, '..');
const SRC   = resolve(ROOT, 'src');
const DIST  = resolve(ROOT, 'dist');
const ICONS = resolve(ROOT, 'icons');

// ─── Helpers ───────────────────────────────────────────────────────────────

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function rimraf(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function getVersion() {
  const pkg = JSON.parse(read(resolve(ROOT, 'package.json')));
  return pkg.version;
}

// ─── Userscript Header ─────────────────────────────────────────────────────

/**
 * Returns the ==UserScript== metadata block for the given version.
 * @param {string} version - semver string, e.g. "1.0.0"
 */
function buildHeader(version) {
  return `\
// ==UserScript==
// @name         Bring Back Live Seek
// @namespace    https://github.com/ramvignesh-b/bbls
// @version      ${version}
// @description  Restores seek (rewind/forward) buttons on Hotstar live streams with a glassmorphism UI.
// @author       RamVignesh B
// @homepageURL  https://github.com/ramvignesh-b/bbls
// @supportURL   https://github.com/ramvignesh-b/bbls/issues
// @match        https://www.hotstar.com/*
// @icon         https://raw.githubusercontent.com/ramvignesh-b/bbls/main/icons/icon-48.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==
`;
}

// ─── Build Targets ─────────────────────────────────────────────────────────

/** Produces dist/bbls.user.js — header + core script concatenated. */
function buildUserscript(version) {
  const header = buildHeader(version);
  const core   = read(resolve(SRC, 'core.js'));
  const output = `${header}\n${core}`;

  write(resolve(DIST, 'bbls.user.js'), output);
  console.log('  ✔  dist/bbls.user.js');
}

/** Icon sizes to bundle with extensions. */
const ICON_SIZES = [16, 32, 48, 128];

/**
 * Produces dist/<target>/ and dist/<target>.zip.
 * @param {'chrome' | 'firefox'} target
 */
function buildExtension(target) {
  const extDir = resolve(DIST, target);
  ensureDir(resolve(extDir, 'icons'));

  // manifest
  copyFileSync(
    resolve(SRC, `manifest.${target}.json`),
    resolve(extDir, 'manifest.json'),
  );

  // content script (same core.js for both targets)
  copyFileSync(resolve(SRC, 'core.js'), resolve(extDir, 'content.js'));

  // icons
  for (const size of ICON_SIZES) {
    const name = `icon-${size}.png`;
    copyFileSync(resolve(ICONS, name), resolve(extDir, 'icons', name));
  }

  // zip (using the system `zip` command available on all CI runners)
  // Zip from inside the dir so the zip root contains manifest.json + icons/ directly
  const zipPath = resolve(DIST, `${target}.zip`);
  execSync(`(cd "${extDir}" && zip -r "${zipPath}" .)`, { stdio: 'inherit' });
  console.log(`  ✔  dist/${target}.zip`);
}

// ─── Entry Point ───────────────────────────────────────────────────────────

(function main() {
  const args = process.argv.slice(2);
  const target = args[0]; // chrome, firefox or userscript

  console.log(`\n📦 Building Bring Back Live Seek [${target || 'all'}]…\n`);

  // Ensure dist exists
  ensureDir(DIST);

  const version = getVersion();
  console.log(`  version: ${version}\n`);

  let builtAny = false;

  if (!target || target === 'userscript') {
    buildUserscript(version);
    builtAny = true;
  }
  
  if (!target || target === 'chrome') {
    buildExtension('chrome');
    builtAny = true;
  }

  if (!target || target === 'firefox') {
    buildExtension('firefox');
    builtAny = true;
  }

  if (!builtAny) {
    console.error(`❌ Error: Unknown target "${target}". Use: chrome, firefox, or userscript.`);
    process.exit(1);
  }

  console.log('\n✅ Build complete.\n');
})();
