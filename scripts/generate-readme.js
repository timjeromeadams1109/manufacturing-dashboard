#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * README.md generator — reads project.meta.json + package.json
 * and outputs a polished README.md.
 *
 * Usage: node scripts/generate-readme.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function detectFromPackageJSON(pkg) {
  if (!pkg) return {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const detected = {};

  // Framework
  if (deps['next']) detected.framework = `Next.js ${deps['next'].replace(/[\^~]/g, '')}`;
  else if (deps['express']) detected.framework = `Express ${deps['express'].replace(/[\^~]/g, '')}`;

  // React
  if (deps['react']) detected.react = `React ${deps['react'].replace(/[\^~]/g, '')}`;

  // Database / Auth
  if (deps['@supabase/supabase-js'] || deps['@supabase/ssr']) detected.supabase = true;
  if (deps['drizzle-orm']) detected.drizzle = true;
  if (deps['@neondatabase/serverless']) detected.neon = true;
  if (deps['knex']) detected.knex = true;
  if (deps['sqlite3']) detected.sqlite = true;

  // AI
  if (deps['@anthropic-ai/sdk']) detected.claude = true;

  // Payments
  if (deps['stripe'] || deps['@stripe/stripe-js']) detected.stripe = true;

  // Cache / Queue
  if (deps['bullmq']) detected.bullmq = true;
  if (deps['ioredis'] || deps['@upstash/redis']) detected.redis = true;

  // Styling
  if (deps['tailwindcss']) detected.tailwind = true;

  // Testing
  if (deps['@playwright/test']) detected.playwright = true;
  if (deps['jest']) detected.jest = true;

  // Communication
  if (deps['twilio']) detected.twilio = true;
  if (deps['resend']) detected.resend = true;

  // Auth
  if (deps['next-auth']) detected.nextAuth = true;

  // Scripts
  detected.scripts = pkg.scripts || {};

  return detected;
}

function buildTechStackTable(meta, detected) {
  const rows = [];
  if (meta.techStack) {
    for (const [layer, tech] of Object.entries(meta.techStack)) {
      rows.push(`| ${layer} | ${tech} |`);
    }
  }
  if (rows.length === 0) return '';
  return `## Tech Stack\n\n| Layer | Technology |\n|-------|------------|\n${rows.join('\n')}\n`;
}

function buildFeatures(meta) {
  if (!meta.features || meta.features.length === 0) return '';
  const items = meta.features.map(f => `- **${f.name}** — ${f.description}`).join('\n');
  return `## Features\n\n${items}\n`;
}

function buildArchitecture(meta) {
  if (!meta.architecture) return '';
  return `## Architecture\n\n\`\`\`\n${meta.architecture}\n\`\`\`\n`;
}

function buildGettingStarted(meta, detected) {
  const sections = [];
  sections.push('## Getting Started\n');

  // Prerequisites
  const prereqs = ['- Node.js 18+'];
  if (detected.supabase) prereqs.push('- Supabase account');
  if (detected.neon) prereqs.push('- Neon PostgreSQL database');
  if (detected.claude) prereqs.push('- Anthropic API key');
  if (detected.stripe) prereqs.push('- Stripe account');
  if (detected.redis || detected.bullmq) prereqs.push('- Redis instance');
  if (meta.prerequisites) meta.prerequisites.forEach(p => prereqs.push(`- ${p}`));
  sections.push(`### Prerequisites\n\n${prereqs.join('\n')}\n`);

  // Install
  sections.push(`### Installation\n\n\`\`\`bash\ngit clone https://github.com/timjeromeadams1109/${meta.repoName || meta.name}.git\ncd ${meta.name}\nnpm install\n\`\`\`\n`);

  // Env vars
  if (meta.envVars && meta.envVars.length > 0) {
    const envRows = meta.envVars.map(e => `| \`${e.name}\` | ${e.description} |`).join('\n');
    sections.push(`### Environment Variables\n\nCopy \`.env.local.example\` to \`.env.local\` and configure:\n\n| Variable | Description |\n|----------|-------------|\n${envRows}\n`);
  }

  // Run
  sections.push(`### Run\n\n\`\`\`bash\nnpm run dev\n\`\`\`\n`);

  return sections.join('\n');
}

function buildProjectStructure(meta) {
  if (!meta.projectStructure) return '';
  return `## Project Structure\n\n\`\`\`\n${meta.projectStructure}\n\`\`\`\n`;
}

function buildScripts(detected) {
  const scripts = detected.scripts || {};
  const keys = Object.keys(scripts);
  if (keys.length === 0) return '';
  const rows = keys.map(k => `| \`npm run ${k}\` | ${scripts[k]} |`).join('\n');
  return `## Scripts\n\n| Command | Description |\n|---------|-------------|\n${rows}\n`;
}

function buildDeployment(meta) {
  if (!meta.deployment) return '';
  return `## Deployment\n\n${meta.deployment}\n`;
}

function buildLinks(meta) {
  if (!meta.links || Object.keys(meta.links).length === 0) return '';
  const items = Object.entries(meta.links).map(([label, url]) => `- [${label}](${url})`).join('\n');
  return `## Links\n\n${items}\n`;
}

function generate() {
  const meta = readJSON(path.join(ROOT, 'project.meta.json'));
  if (!meta) {
    console.error('Error: project.meta.json not found in', ROOT);
    process.exit(1);
  }

  // Try root package.json, then frontend/package.json
  let pkg = readJSON(path.join(ROOT, 'package.json'));
  if (!pkg) pkg = readJSON(path.join(ROOT, 'frontend', 'package.json'));
  const detected = detectFromPackageJSON(pkg);

  const sections = [];

  // Title + description
  sections.push(`# ${meta.displayName || meta.name}`);
  if (meta.description) sections.push(meta.description);

  // Body sections
  sections.push(buildTechStackTable(meta, detected));
  sections.push(buildFeatures(meta));
  sections.push(buildArchitecture(meta));
  sections.push(buildGettingStarted(meta, detected));
  sections.push(buildProjectStructure(meta));
  sections.push(buildScripts(detected));
  sections.push(buildDeployment(meta));
  sections.push(buildLinks(meta));

  // Footer
  if (meta.license) sections.push(`## License\n\n${meta.license}`);
  sections.push('---\n*Auto-generated from project.meta.json — do not edit manually.*');

  const readme = sections.filter(Boolean).join('\n\n') + '\n';

  if (DRY_RUN) {
    console.log(readme);
  } else {
    fs.writeFileSync(path.join(ROOT, 'README.md'), readme);
    console.log('README.md generated successfully.');
  }
}

generate();
