import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { build, PUBLIC_FILES } from '../scripts/build_static.mjs';

async function fixture(root) {
  for (const name of PUBLIC_FILES) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'synthetic public fixture', 'utf8');
  }
}

async function temporaryRoot() {
  return mkdtemp(join(tmpdir(), 'csa-static-'));
}

test('only reviewed public assets are staged', async () => {
  const root = await temporaryRoot();
  try {
    await fixture(root);
    for (const name of ['docs/internal.md', 'supabase/migrations/private.sql', '.env', 'tests/case.py', 'vercel.json', 'company/unapproved.html', 'library/private.pdf']) {
      const path = join(root, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, 'never publish', 'utf8');
    }
    const output = await build(root);
    assert.equal(await readFile(join(output, '.well-known/security.txt'), 'utf8'), 'synthetic public fixture');
    await assert.rejects(readFile(join(output, '.env'), 'utf8'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('stale output is not retained', async () => {
  const root = await temporaryRoot();
  try {
    await fixture(root);
    const output = await build(root);
    await writeFile(join(output, 'stale-secret.txt'), 'stale');
    await build(root);
    await assert.rejects(readFile(join(output, 'stale-secret.txt'), 'utf8'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing public asset fails the build', async () => {
  const root = await temporaryRoot();
  try { await assert.rejects(build(root), /Missing approved public asset/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('source symlink is rejected', async () => {
  const root = await temporaryRoot();
  try {
    await fixture(root);
    await unlink(join(root, 'index.html'));
    await symlink(join(root, '404.html'), join(root, 'index.html'));
    await assert.rejects(build(root), /Symlink is not a public asset/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('output symlink is rejected without touching its target', async () => {
  const root = await temporaryRoot();
  try {
    await fixture(root);
    await symlink(join(root, 'company'), join(root, '.static-output'), 'dir');
    await assert.rejects(build(root), /Output must not be a symlink/);
    assert.equal(await readFile(join(root, 'company/index.html'), 'utf8'), 'synthetic public fixture');
  } finally { await rm(root, { recursive: true, force: true }); }
});
