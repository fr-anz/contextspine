import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initProject } from '../src/init.js';
import { exportPacket } from '../src/export.js';
import { assertUnchanged, fixtureRoot, snapshot, writeFile } from './helpers.js';
import { readTextFile } from '../src/text.js';

function silence(fn) {
    const original = console.log;
    console.log = () => {};
    try { return fn(); } finally { console.log = original; }
}

for (const encoding of ['utf8', 'utf8-bom', 'utf16le', 'utf16be']) {
    test(`encoding ${encoding}: existing bytes preserved, section once, rerun unchanged, exports correct`, () => {
        const root = fixtureRoot('contextspine-enc');
        try {
            const project = path.join(root, `${encoding} project [saved] ' notes`);
            fs.mkdirSync(path.join(project, '.context'), { recursive: true });
            const instructionPath = path.join(project, 'AGENTS.md');
            const original = '# Team instructions\nKeep existing guidance.\n';
            const savedState = '# Previous task remains unfinished.';
            writeFile(project, 'AGENTS.md', original, encoding);
            writeFile(project, '.context/state.md', savedState);
            const beforeBytes = fs.readFileSync(instructionPath);

            silence(() => initProject({ projectPath: project, shared: true }));

            const afterBytes = fs.readFileSync(instructionPath);
            assert.deepEqual(afterBytes.subarray(0, beforeBytes.length), beforeBytes, `Original bytes changed: ${encoding}`);
            const after = readTextFile(instructionPath).content;
            assert.ok(after.includes('<!-- context-spine -->'), `Unreadable router: ${encoding}`);
            assert.equal(fs.readFileSync(path.join(project, '.context/state.md'), 'utf8'), savedState, 'Saved state overwritten.');
            assert.equal((after.match(/<!-- context-spine -->/g) || []).length, 1, 'Pi/Codex duplicated router.');
            assert.ok(fs.existsSync(path.join(project, 'CLAUDE.md')), 'claude-kiro adapter absent.');
            assert.ok(!fs.existsSync(path.join(project, '.cursor')), 'Unexpected default adapter.');

            const hashes = snapshot(project);
            silence(() => initProject({ projectPath: project, shared: true }));
            assertUnchanged(project, hashes, 'Rerun');

            const packet = exportPacket({ projectPath: project });
            const historyPacket = exportPacket({ projectPath: project, history: true });
            assert.ok(packet.includes(savedState) && !packet.includes('## Source: .context/decisions.md'), 'Compact export incorrect.');
            assert.ok(historyPacket.includes('## Source: .context/decisions.md') && historyPacket.includes('## Source: .context/knowledge.md'), 'History export incomplete.');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
}
