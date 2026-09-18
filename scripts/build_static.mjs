import { copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_FILES = [
  'index.html', '404.html', 'a11y.css', 'app.js', 'ecosystem-globe.css',
  'favicon.svg', 'llms.txt', 'mobile-nav.css', 'robots.txt', 'site.webmanifest',
  'sitemap.xml', 'social-card.svg', 'styles.css', '.well-known/security.txt',
  'accessibility/index.html', 'company/index.html', 'contact/index.html',
  'ecosystem/index.html', 'engagement/index.html', 'governance/index.html',
  'industries/index.html', 'knowledge/index.html', 'library/index.html',
  'platforms/autto-connect/index.html', 'platforms/csia/index.html',
  'platforms/solurius/index.html', 'platforms/wardale/index.html',
  'privacy/index.html', 'research/index.html', 'security/index.html',
  'start/index.html', 'technology/index.html', 'terms/index.html', 'trust/index.html',
];

async function statOrNull(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function verifyPublicAsset(root, publicPath) {
  const parts = publicPath.split('/');
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    const stat = await statOrNull(current);
    if (!stat) throw new Error(`Missing approved public asset: ${publicPath}`);
    if (stat.isSymbolicLink()) throw new Error(`Symlink is not a public asset: ${publicPath}`);
  }
  const sourceStat = await lstat(join(root, publicPath));
  if (!sourceStat.isFile()) throw new Error(`Missing approved public asset: ${publicPath}`);
}

async function listFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push(relative(root, absolute).split('\\').join('/'));
  }
  return files;
}

export async function build(rootInput) {
  const root = resolve(rootInput);
  const output = join(root, '.static-output');
  const outputStat = await statOrNull(output);
  if (outputStat?.isSymbolicLink()) throw new Error('Output must not be a symlink');

  for (const publicPath of PUBLIC_FILES) await verifyPublicAsset(root, publicPath);

  if (outputStat) await rm(output, { recursive: true, force: true });
  await mkdir(output);

  for (const publicPath of PUBLIC_FILES) {
    const destination = join(output, publicPath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(root, publicPath), destination);
  }

  const actual = (await listFiles(output)).sort();
  const expected = [...PUBLIC_FILES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Unexpected deployment output');
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const output = await build(root);
  console.log(`Staged ${PUBLIC_FILES.length} approved public assets in ${relative(root, output)}`);
}
