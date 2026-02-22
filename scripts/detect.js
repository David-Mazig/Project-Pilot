#!/usr/bin/env node
// Project Pilot: Cross-platform project detection
// Called by /init-pilot Phase 1 to scan the project before asking questions.
// Outputs structured JSON to stdout. Zero shell dependencies — pure Node.js fs.
// Works identically on Windows (cmd/pwsh/git-bash), macOS, and Linux.

const fs   = require('fs');
const path = require('path');

const CWD = process.cwd();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exists(rel) {
  return fs.existsSync(path.join(CWD, rel));
}

function readLines(rel, max) {
  try {
    return fs.readFileSync(path.join(CWD, rel), 'utf8')
      .split('\n')
      .filter(l => l.trim())
      .slice(0, max || 999);
  } catch (_) { return []; }
}

// Walk dir, skip noise folders, collect files up to a cap
function walk(dir, opts) {
  const skip    = opts.skip    || ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor', 'target', '.venv', 'venv'];
  const maxFiles = opts.maxFiles || 2000;
  const results  = [];

  function recurse(current) {
    if (results.length >= maxFiles) return;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (skip.includes(e.name)) continue;
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        recurse(full);
      } else if (e.isFile()) {
        results.push(path.relative(CWD, full).replace(/\\/g, '/'));
        if (results.length >= maxFiles) return;
      }
    }
  }

  recurse(path.join(CWD, dir));
  return results;
}

function listDir(rel) {
  try {
    return fs.readdirSync(path.join(CWD, rel), { withFileTypes: true })
      .map(e => ({ name: e.name, isDir: e.isDirectory() }));
  } catch (_) { return []; }
}

// ─── Config File Detection ────────────────────────────────────────────────────

const CONFIG_FILES = [
  // JS/TS ecosystem
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'tsconfig.json', 'tsconfig.base.json', '.babelrc', 'babel.config.js',
  'jest.config.js', 'jest.config.ts', 'vitest.config.ts',
  'vite.config.js', 'vite.config.ts',
  'next.config.js', 'next.config.ts', 'next.config.mjs',
  'nuxt.config.js', 'nuxt.config.ts',
  'angular.json', 'webpack.config.js',
  'svelte.config.js', 'astro.config.mjs',
  'remix.config.js', 'tailwind.config.js', 'tailwind.config.ts',

  // Python
  'requirements.txt', 'requirements-dev.txt', 'Pipfile', 'Pipfile.lock',
  'pyproject.toml', 'setup.py', 'setup.cfg',
  'poetry.lock', 'uv.lock',

  // Go
  'go.mod', 'go.sum',

  // Rust
  'Cargo.toml', 'Cargo.lock',

  // Java/Kotlin/JVM
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',

  // Ruby
  'Gemfile', 'Gemfile.lock',

  // PHP
  'composer.json', 'composer.lock',

  // .NET
  'global.json',

  // Infrastructure / Container
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'docker-compose.dev.yml', 'docker-compose.prod.yml',
  '.env', '.env.example', '.env.sample',

  // Cloud / IaC
  'terraform.tf', 'main.tf', 'variables.tf',
  'serverless.yml', 'serverless.yaml',
  'cdk.json', 'pulumi.yaml',
  'fly.toml', 'vercel.json', 'netlify.toml',
  'railway.json',

  // CI/CD
  '.travis.yml', 'circle.yml', 'Jenkinsfile',
  'azure-pipelines.yml',

  // Meta
  '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
  '.prettierrc', '.prettierrc.js', '.prettierrc.json',
  '.editorconfig', '.gitignore', '.gitattributes',
  'Makefile', 'makefile', 'justfile',
  'CLAUDE.md', 'README.md', 'readme.md',
];

const foundConfigs = CONFIG_FILES.filter(exists);

// ─── Docs / Intelligence ──────────────────────────────────────────────────────

const docsPresent = {
  readmeMd      : exists('README.md') || exists('readme.md'),
  claudeMd      : exists('CLAUDE.md'),
  docsDir       : exists('docs'),
  claudeDir     : exists('.claude'),
  pilotDir      : exists('.pilot'),
  changelogMd   : exists('CHANGELOG.md') || exists('changelog.md'),
};

// ─── Directory Structure ──────────────────────────────────────────────────────

const KNOWN_DIRS = [
  'src', 'app', 'lib', 'libs', 'packages',
  'api', 'apis',
  'components', 'pages', 'views', 'layouts', 'screens',
  'hooks', 'utils', 'helpers', 'services', 'middleware',
  'models', 'schemas', 'types', 'interfaces',
  'routes', 'controllers', 'handlers',
  'config', 'configs',
  'tests', 'test', '__tests__', 'spec', 'specs', 'e2e',
  'scripts', 'tools', 'bin',
  'public', 'static', 'assets',
  'styles', 'css', 'scss',
  'docs', 'documentation',
  'migrations', 'seeds',
  'infra', 'infrastructure', 'deploy', 'k8s', 'terraform',
  '.github',
];

const presentDirs = KNOWN_DIRS.filter(exists);

// Root-level entries (shallow look at project shape)
const rootEntries = listDir('.');

// ─── File Count + Language Detection ─────────────────────────────────────────

const EXT_TO_LANG = {
  '.js':    'JavaScript',  '.mjs':  'JavaScript', '.cjs':  'JavaScript',
  '.jsx':   'JavaScript',
  '.ts':    'TypeScript',  '.tsx':  'TypeScript',  '.mts':  'TypeScript',
  '.py':    'Python',      '.pyw':  'Python',
  '.go':    'Go',
  '.rs':    'Rust',
  '.java':  'Java',        '.kt':   'Kotlin',       '.kts':  'Kotlin',
  '.rb':    'Ruby',
  '.php':   'PHP',
  '.cs':    'C#',          '.vb':   'VB.NET',
  '.c':     'C',           '.h':    'C',
  '.cpp':   'C++',         '.cc':   'C++',          '.cxx':  'C++',  '.hpp': 'C++',
  '.swift': 'Swift',
  '.dart':  'Dart',
  '.scala': 'Scala',
  '.clj':   'Clojure',     '.cljs': 'ClojureScript',
  '.ex':    'Elixir',      '.exs':  'Elixir',
  '.erl':   'Erlang',
  '.hs':    'Haskell',
  '.lua':   'Lua',
  '.r':     'R',           '.R': 'R',
  '.sh':    'Shell',       '.bash': 'Shell',        '.zsh':  'Shell',
  '.ps1':   'PowerShell',  '.psm1': 'PowerShell',
  '.sql':   'SQL',
  '.html':  'HTML',        '.htm':  'HTML',
  '.css':   'CSS',         '.scss': 'SCSS',         '.sass': 'SASS', '.less': 'LESS',
  '.vue':   'Vue',
  '.svelte':'Svelte',
  '.astro': 'Astro',
  '.tf':    'Terraform',   '.hcl':  'HCL',
  '.yaml':  'YAML',        '.yml':  'YAML',
  '.json':  'JSON',
  '.toml':  'TOML',
  '.md':    'Markdown',    '.mdx':  'MDX',
  '.graphql':'GraphQL',    '.gql':  'GraphQL',
};

// Walk the root to get all files
const allFiles = walk('.', { maxFiles: 2000 });
const fileCount = allFiles.length;

const langCounts = {};
for (const f of allFiles) {
  const ext = path.extname(f).toLowerCase();
  const lang = EXT_TO_LANG[ext];
  if (lang) langCounts[lang] = (langCounts[lang] || 0) + 1;
}
const languages = Object.entries(langCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([lang, count]) => ({ lang, count }));

// ─── package.json Metadata ─────────────────────────────────────────────────

let packageMeta = null;
if (exists('package.json')) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(CWD, 'package.json'), 'utf8'));
    packageMeta = {
      name:        pkg.name        || null,
      description: pkg.description || null,
      version:     pkg.version     || null,
      scripts:     pkg.scripts     ? Object.keys(pkg.scripts) : [],
      deps:        Object.keys(pkg.dependencies        || {}),
      devDeps:     Object.keys(pkg.devDependencies     || {}),
    };
  } catch (_) {}
}

// ─── pyproject.toml / setup.py Metadata ──────────────────────────────────────

let pythonMeta = null;
if (exists('pyproject.toml')) {
  const raw = fs.readFileSync(path.join(CWD, 'pyproject.toml'), 'utf8');
  const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m);
  const descMatch = raw.match(/^description\s*=\s*"([^"]+)"/m);
  pythonMeta = {
    name:        nameMatch ? nameMatch[1] : null,
    description: descMatch ? descMatch[1] : null,
  };
}

// ─── Git History ──────────────────────────────────────────────────────────────

let gitInfo = { hasGit: false, branch: null, recentCommits: [], remoteUrl: null };

if (exists('.git')) {
  gitInfo.hasGit = true;

  // Branch: read .git/HEAD directly — no shell needed
  try {
    const head = fs.readFileSync(path.join(CWD, '.git', 'HEAD'), 'utf8').trim();
    if (head.startsWith('ref: refs/heads/')) {
      gitInfo.branch = head.replace('ref: refs/heads/', '');
    } else {
      gitInfo.branch = head.substring(0, 8); // detached HEAD
    }
  } catch (_) {}

  // Recent commits: read .git/logs/HEAD directly — no shell needed
  try {
    const logPath = path.join(CWD, '.git', 'logs', 'HEAD');
    const logLines = fs.readFileSync(logPath, 'utf8')
      .split('\n')
      .filter(l => l.trim())
      .slice(-20)
      .reverse();
    gitInfo.recentCommits = logLines.map(line => {
      // Format: <old-sha> <new-sha> <author> <timestamp> <tz> \t<message>
      const tabIdx = line.indexOf('\t');
      return tabIdx !== -1 ? line.substring(tabIdx + 1).trim() : '';
    }).filter(Boolean).slice(0, 10);
  } catch (_) {}

  // Remote URL: read .git/config directly — no shell needed
  try {
    const gitConfig = fs.readFileSync(path.join(CWD, '.git', 'config'), 'utf8');
    const urlMatch = gitConfig.match(/url\s*=\s*(.+)/);
    if (urlMatch) gitInfo.remoteUrl = urlMatch[1].trim();
  } catch (_) {}
}

// ─── Readme Snippet ──────────────────────────────────────────────────────────

let readmeSnippet = null;
for (const name of ['README.md', 'readme.md', 'Readme.md']) {
  if (exists(name)) {
    readmeSnippet = readLines(name, 20).join('\n');
    break;
  }
}

// ─── Complexity Tier Suggestion ───────────────────────────────────────────────

// Tier 1: <20 source files, single primary language, simple structure
// Tier 2: everything else
const sourceExtensions = new Set(['.js','.mjs','.jsx','.ts','.tsx','.py','.go','.rs','.java','.kt','.rb','.php','.cs','.swift','.dart','.vue','.svelte','.ex','.exs']);
const sourceFiles = allFiles.filter(f => sourceExtensions.has(path.extname(f).toLowerCase()));
const primaryLangs = languages.filter(l => sourceExtensions.has(Object.keys(EXT_TO_LANG).find(k => EXT_TO_LANG[k] === l.lang) || ''));
const suggestedTier = (sourceFiles.length < 20 && primaryLangs.length <= 1) ? 1 : 2;

// ─── Output ───────────────────────────────────────────────────────────────────

const result = {
  configFiles:    foundConfigs,
  docs:           docsPresent,
  directories:    presentDirs,
  rootEntries:    rootEntries.map(e => e.name + (e.isDir ? '/' : '')),
  fileCount:      fileCount,
  sourceFileCount: sourceFiles.length,
  languages:      languages,
  packageMeta:    packageMeta,
  pythonMeta:     pythonMeta,
  git:            gitInfo,
  readmeSnippet:  readmeSnippet,
  suggestedTier:  suggestedTier,
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
