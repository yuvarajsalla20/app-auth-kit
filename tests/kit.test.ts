import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIT_NAME, KIT_VERSION } from '../src/kit';

describe('kit version', () => {
  it('matches package.json, so it cannot drift', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(KIT_VERSION).toBe(pkg.version);
    expect(KIT_NAME).toBe(pkg.name);
  });
  it('lets a bundler drop what is not imported', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).sideEffects).toBe(false);
  });
});

describe('package entry', () => {
  it('exports the public pieces an app imports', async () => {
    const api = await import('../src/index');
    expect(Object.keys(api).sort()).toEqual(['DEFAULT_MESSAGES', 'DEFAULT_STRINGS', 'DEFAULT_THEME', 'KIT_NAME', 'KIT_VERSION', 'SignInScreen', 'createAuthKit']);
  });
});
