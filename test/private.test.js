import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { initProject } from '../src/init.js';
import { fixtureRoot, readFile, snapshot, assertUnchanged } from './helpers.js';
import { wordCount } from '../src/text.js';

function silence(fn) {
    const original = console.log;
    console.log = () => {};
    try { return fn(); } finally { console.log = original; }
}

function git(project, ...args) {
    return execFileSync('git', ['-C', project, ...args], { encoding: 'utf8' });
}

const hasGit = (() => { try { execFileSync('git', ['--version']); return true; } catch { return false; } })();

test('private setup: git excludes, nested prefix, team files, tracked rejection, budgets', { skip: !hasGit && 'git not available' }, () => {
    const root = fixtureRoot('contextspine-private');
    try {
        // Pre-git project: .gitignore entries apply once git is initialized.
        const current = path.join(root, "Current project [saved] & ' notes");
        fs.mkdirSync(current, { recursive: true });
        silence(() => initProject({ projectPath: current }));
        for (const file of ['.context/state.md', 'AGENTS.override.md', 'CLAUDE.local.md', '.gitignore']) {
            assert.ok(fs.existsSync(path.join(current, file)), `Missing ${file}`);
        }
        assert.ok(!fs.existsSync(path.join(current, 'AGENTS.md')), 'Unexpected shared adapter.');
        const router = readFile(current, 'AGENTS.override.md');
        assert.ok(router.includes('Read existing `AGENTS.md`') && router.includes('update state.md following'), 'Team instructions/checkpoint missing.');
        let activeWords = 0;
        for (const name of ['preferences', 'project', 'state']) {
            activeWords += wordCount(readFile(current, `.context/${name}.md`));
        }
        assert.ok(activeWords <= 400, 'New context exceeds lean target.');
        assert.ok(wordCount(readFile(current, '.context/protocol.md')) <= 150, 'Protocol exceeds lean target.');
        git(current, 'init', '-q');
        const status = git(current, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean);
        assert.equal(status.length, 1, 'Pre-Git workflow was not ignored.');
        assert.match(status[0], /\.gitignore$/, 'Pre-Git workflow was not ignored.');

        // Existing repository: excludes go to .git/info/exclude, nothing tracked changes.
        const repo = path.join(root, 'Existing repository');
        fs.mkdirSync(repo, { recursive: true });
        git(repo, 'init', '-q');
        for (const file of ['AGENTS.md', 'CLAUDE.md', '.gitignore']) {
            fs.writeFileSync(path.join(repo, file), `# Existing team file: ${file}\n`);
        }
        git(repo, '-c', 'core.autocrlf=false', 'add', '--', 'AGENTS.md', 'CLAUDE.md', '.gitignore');
        const beforeStatus = git(repo, 'status', '--porcelain', '--untracked-files=all');
        const teamHashes = snapshot(repo);
        silence(() => initProject({ projectPath: repo }));
        const nested = path.join(repo, "Nested [saved] & ' notes");
        fs.mkdirSync(nested, { recursive: true });
        silence(() => initProject({ projectPath: nested }));
        for (const file of ['AGENTS.md', 'CLAUDE.md', '.gitignore']) {
            const p = path.join(repo, file);
            assert.equal(fs.readFileSync(p).toString('base64'), teamHashes.get(p), `Team file changed: ${file}`);
        }
        assert.equal(git(repo, 'status', '--porcelain', '--untracked-files=all'), beforeStatus, 'Private setup polluted Git status.');
        const ignoredPaths = ['.context/state.md', 'AGENTS.override.md', 'CLAUDE.local.md',
            "Nested [saved] & ' notes/.context/state.md", "Nested [saved] & ' notes/AGENTS.override.md",
            "Nested [saved] & ' notes/CLAUDE.local.md"];
        const ignored = git(repo, 'check-ignore', '--', ...ignoredPaths).split('\n').filter(Boolean);
        assert.equal(ignored.length, ignoredPaths.length, 'Private paths not ignored.');

        const excludePath = path.join(repo, '.git/info/exclude');
        const statePath = path.join(repo, '.context/state.md');
        fs.writeFileSync(statePath, '# Saved checkpoint must survive initialization.');
        const excludeBefore = fs.readFileSync(excludePath).toString('base64');
        const stateBefore = fs.readFileSync(statePath).toString('base64');
        silence(() => initProject({ projectPath: repo }));
        silence(() => initProject({ projectPath: nested }));
        assert.equal(fs.readFileSync(excludePath).toString('base64'), excludeBefore, 'Rerun changed exclusions.');
        assert.equal(fs.readFileSync(statePath).toString('base64'), stateBefore, 'Rerun changed saved state.');

        git(repo, '-c', 'core.autocrlf=false', 'add', '-f', '--', '.context/state.md');
        const beforeReject = snapshot(repo);
        assert.throws(() => silence(() => initProject({ projectPath: repo })), /Already tracked workflow files/, 'Tracked memory silently treated as private.');
        assertUnchanged(repo, beforeReject, 'Rejected tracked run');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
