import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPrompt, listPrompts } from '../src/prompts.js';
import { fixtureRoot, runCli } from './helpers.js';

test('every prompt name resolves to non-empty text', () => {
    for (const { name } of listPrompts()) {
        const text = getPrompt(name);
        assert.ok(text && text.length > 40, `Prompt '${name}' did not resolve.`);
    }
    assert.equal(getPrompt('bogus'), null);
});

test('cli: help, unknown command, prompt list and print', () => {
    const help = runCli([]);
    assert.equal(help.code, 0);
    assert.ok(help.stdout.includes('Quick start'), 'Help missing quick start.');

    const unknown = runCli(['bogus']);
    assert.equal(unknown.code, 1, 'Unknown command should exit 1.');
    assert.ok(unknown.stderr.includes('Unknown command'), 'Unknown command missing error.');

    const list = runCli(['prompt']);
    assert.equal(list.code, 0);
    for (const { name } of listPrompts()) assert.ok(list.stdout.includes(name), `Prompt list missing ${name}.`);

    const resume = runCli(['prompt', 'resume']);
    assert.equal(resume.code, 0);
    assert.ok(resume.stdout.includes('Resume this project'), 'resume prompt text wrong.');

    const bogus = runCli(['prompt', 'bogus']);
    assert.equal(bogus.code, 1, 'Unknown prompt should exit 1.');
});

test('cli: profile creates ~/.contextspine/profile.md in a temp home', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'contextspine-home-'));
    try {
        const result = runCli(['profile'], { env: { HOME: home, USERPROFILE: home } });
        assert.equal(result.code, 0);
        const profilePath = path.join(home, '.contextspine', 'profile.md');
        assert.ok(fs.existsSync(profilePath), 'Profile not created.');
        assert.ok(result.stdout.trim().endsWith(path.join('.contextspine', 'profile.md')), 'Profile path not printed.');
        assert.ok(fs.readFileSync(profilePath, 'utf8').includes('Personal preferences'), 'Default profile content wrong.');
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test('cli end-to-end: init, idea, check PASS, prompt, export, check FAIL exit 1', () => {
    const root = fixtureRoot('contextspine-e2e');
    try {
        const project = path.join(root, 'Project');
        fs.mkdirSync(project, { recursive: true });

        let r = runCli(['init'], { cwd: project });
        assert.equal(r.code, 0, r.stderr);
        r = runCli(['idea'], { cwd: project });
        assert.equal(r.code, 0, r.stderr);
        r = runCli(['check'], { cwd: project });
        assert.equal(r.code, 0);
        assert.ok(r.stdout.includes('Result: PASS'), r.stdout);
        r = runCli(['export'], { cwd: project });
        assert.equal(r.code, 0);
        assert.ok(r.stdout.includes('# Project context packet'), 'Export header missing.');
        assert.equal((r.stdout.match(/## Source:/g) || []).length, 5, 'Compact packet sections wrong.');
        r = runCli(['export', '--history'], { cwd: project });
        assert.equal((r.stdout.match(/## Source:/g) || []).length, 7, 'History packet sections wrong.');

        fs.rmSync(path.join(project, '.context', 'state.md'));
        r = runCli(['check'], { cwd: project });
        assert.equal(r.code, 1, 'Missing state.md should exit 1.');
        assert.ok(r.stdout.includes('Missing .context/state.md'), r.stdout);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
