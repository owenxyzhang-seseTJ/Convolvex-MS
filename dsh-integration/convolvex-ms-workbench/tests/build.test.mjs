import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('client bundle registers the package id and both slots', () => {
  assert.match(source, new RegExp('id: ' + JSON.stringify(pkg.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /sidebar\.panellist/);
  assert.match(source, /name: 'main'/);
  assert.match(source, /convolvex-ms-workbench/);
});

test('client bundle embeds the original web frontend without script tags', () => {
  assert.match(source, /const MARKUP = /);
  assert.match(source, /const CSS = /);
  assert.match(source, /const BOOT = \(function bootWorkbench/);
  assert.doesNotMatch(source, /<script[\s\S]*?<\/script>/i);
  assert.doesNotMatch(source, /-:host/);
  assert.match(source, /\.control-body\s*\{/);
});

test('metadata detail documents and icons exist', () => {
  for (const locale of ['zh', 'en']) {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'locale', locale + '.json'), 'utf8'));
    assert.ok(data.meta.title);
    assert.ok(data.meta.description);
    assert.ok(fs.existsSync(path.join(root, data.meta.detail)));
  }
  assert.ok(fs.existsSync(path.join(root, 'icon.svg')));
  assert.ok(fs.existsSync(path.join(root, 'docs', 'preview.svg')));
});
