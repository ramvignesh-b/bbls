import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const CONFIG_FILES = [
  'package.json',
  'src/manifest.chrome.json',
  'src/manifest.firefox.json'
];

function getNewVersion(currentVersion, type) {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid current version: ${currentVersion}`);
  }

  let [major, minor, patch] = parts;

  switch (type) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
    default:
      patch++;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const bumpType = args[0] || 'patch'; // patch, minor, major OR a specific version
    
    // 1. Read current version from package.json
    const pkgPath = path.resolve('package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const currentVersion = pkg.version;
    
    let newVersion;
    if (['major', 'minor', 'patch'].includes(bumpType)) {
      newVersion = getNewVersion(currentVersion, bumpType);
    } else if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
      newVersion = bumpType;
    } else {
      console.error('❌ Error: Argument must be patch, minor, major, or a semver string (e.g., 1.2.3).');
      process.exit(1);
    }

    console.log(`📦 Bumping version: ${currentVersion} ➔ ${newVersion}`);

    // 2. Update all config files
    for (const file of CONFIG_FILES) {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Warning: ${file} not found, skipping.`);
        continue;
      }
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      content.version = newVersion;
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
      console.log(`  ✔ Updated ${file}`);
    }

    // 3. Git operations
    console.log('\n🚀 Running Git operations...');
    
    const tagName = `v${newVersion}`;
    const commitMsg = `chore: release ${tagName}`;

    execSync('git add .');
    execSync(`git commit -m "${commitMsg}"`);
    execSync(`git tag ${tagName}`);

    console.log(`  ✔ Committed: "${commitMsg}"`);
    console.log(`  ✔ Tagged: ${tagName}`);
    console.log('\n✅ Done! Run "git push origin main --tags" to trigger the release pipeline.');

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
