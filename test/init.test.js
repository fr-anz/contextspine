import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    LEGACY_END_MARKER, LEGACY_MARKER, MARKER,
    getAdapterPaths, getRulesBody, newWorkflowBlock,
} from '../src/adapters.js';
import { initProject } from '../src/init.js';
import { checkProject } from '../src/check.js';
import { exportPacket } from '../src/export.js';
import { assertUnchanged, countMarker, fixtureRoot, readFile, snapshot, writeFile } from './helpers.js';
import { wordCount } from '../src/text.js';

function capture(fn) {
    const lines = [];
    const original = console.log;
    console.log = (msg) => lines.push(String(msg));
    try {
        const code = fn();
        return { text: lines.join('\n'), code };
    } finally {
        console.log = original;
    }
}

const invokeCheck = (project, opts = {}) => capture(() => checkProject({ projectPath: project, ...opts }));

test('six tools in both modes: embedded rules, budgets, export, clean check, idempotent rerun/sync', () => {
    const root = fixtureRoot('contextspine-init');
    try {
        for (const shared of [false, true]) {
            for (const tool of ['pi', 'codex', 'claude-kiro', 'claude', 'cursor', 'copilot']) {
                const project = path.join(root, `${tool}-shared-${shared}`);
                fs.mkdirSync(project, { recursive: true });
                capture(() => initProject({ projectPath: project, tools: [tool], shared }));
                const [adapter] = getAdapterPaths([tool], shared);
                const text = readFile(project, adapter);
                assert.equal(countMarker(text, MARKER), 1, `Expected one workflow section for ${tool}.`);
                const expected = newWorkflowBlock(getRulesBody(path.join(project, '.context/rules.md')), adapter);
                assert.ok(text.includes(expected.replace(/\n/g, text.includes('\r\n') ? '\r\n' : '\n')), `Adapter for ${tool} does not embed the rules.`);
                assert.ok(text.includes('Never claim unrun checks passed'), 'Rules text missing from adapter.');
                assert.equal(text.includes('Read existing `AGENTS.md`'), adapter === 'AGENTS.override.md', 'Override preamble placement wrong.');
                assert.ok(!fs.existsSync(path.join(project, '.context/index.md')), 'New setup created index.md.');
                assert.ok(wordCount(readFile(project, '.context/rules.md')) <= 150, 'Default rules exceed 150 words.');
                let sessionWords = 0;
                for (const f of ['project', 'preferences', 'state']) sessionWords += wordCount(readFile(project, `.context/${f}.md`));
                assert.ok(sessionWords <= 400, `Session files exceed 400 words (${sessionWords}).`);
                const packet = exportPacket({ projectPath: project });
                assert.ok(packet.includes('## Source: .context/rules.md'), 'Export omitted rules.');
                assert.equal((packet.match(/## Source:/g) || []).length, 5, 'Unexpected compact packet sections.');
                const check = invokeCheck(project);
                assert.equal(check.code, 0);
                assert.ok(check.text.includes('Result: PASS'), `Fresh ${tool} setup failed check: ${check.text}`);
                const before = snapshot(project);
                capture(() => initProject({ projectPath: project, tools: [tool], shared }));
                capture(() => initProject({ projectPath: project, tools: [tool], shared, sync: true }));
                assertUnchanged(project, before, `Rerun for ${tool}`);
            }
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('sync updates only the generated section; preserves BOM, CRLF, team and trailing text', () => {
    const root = fixtureRoot('contextspine-sync');
    try {
        const project = path.join(root, `Sync [saved] & ' project`);
        fs.mkdirSync(project, { recursive: true });
        writeFile(project, 'AGENTS.md', '# Team café rules\r\nKeep this.\r\n', 'utf8-bom');
        capture(() => initProject({ projectPath: project, shared: true, tools: ['pi'] }));
        const trailer = "\r\n\r\n<!-- project-quality:v1 -->\r\nQuality text.\r\n<!-- /project-quality:v1 -->\r\n";
        fs.appendFileSync(path.join(project, 'AGENTS.md'), trailer);
        writeFile(project, '.context/rules.md', readFile(project, '.context/rules.md') + '- Project rule: never deploy from a laptop.\n');
        let check = invokeCheck(project);
        assert.ok(check.text.includes('out of date with .context/rules.md'), 'Checker missed stale adapter.');
        const before = snapshot(project);
        capture(() => initProject({ projectPath: project, shared: true, tools: ['pi'] }));
        assertUnchanged(project, before, 'Plain rerun after rules edit');
        capture(() => initProject({ projectPath: project, shared: true, tools: ['pi'], sync: true }));
        const bytes = fs.readFileSync(path.join(project, 'AGENTS.md'));
        assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'Sync dropped the BOM.');
        const synced = Buffer.from(bytes.subarray(3)).toString('utf8');
        assert.ok(synced.startsWith('# Team café rules\r\nKeep this.\r\n'), 'Sync changed team text.');
        assert.ok(synced.endsWith(trailer), 'Sync changed text after the section.');
        assert.ok(synced.includes('never deploy from a laptop.\r\n'), 'Sync did not apply rules with file newlines.');
        assert.equal(countMarker(synced, MARKER), 1, 'Sync duplicated the section.');
        assert.ok(invokeCheck(project).text.includes('Result: PASS'), 'Synced project not clean.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('mixing private and shared modes rejected without writes in both directions', () => {
    const root = fixtureRoot('contextspine-modes');
    try {
        const privateFirst = path.join(root, 'Private first');
        fs.mkdirSync(privateFirst, { recursive: true });
        capture(() => initProject({ projectPath: privateFirst }));
        let before = snapshot(privateFirst);
        assert.throws(() => initProject({ projectPath: privateFirst, shared: true }), /already uses private workflow adapters/);
        assertUnchanged(privateFirst, before, 'Rejected shared run');

        const sharedFirst = path.join(root, 'Shared first');
        fs.mkdirSync(sharedFirst, { recursive: true });
        capture(() => initProject({ projectPath: sharedFirst, shared: true }));
        before = snapshot(sharedFirst);
        assert.throws(() => initProject({ projectPath: sharedFirst }), /already uses shared workflow adapters/);
        assertUnchanged(sharedFirst, before, 'Rejected private run');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('checker reports mixed modes, import double-load, knowledge size, broken links; fails on missing files', () => {
    const root = fixtureRoot('contextspine-check');
    try {
        const privateFirst = path.join(root, 'Private');
        fs.mkdirSync(privateFirst, { recursive: true });
        capture(() => initProject({ projectPath: privateFirst }));
        fs.copyFileSync(path.join(privateFirst, 'CLAUDE.local.md'), path.join(privateFirst, 'CLAUDE.md'));
        assert.ok(invokeCheck(privateFirst).text.includes('Mixed modes'), 'Checker missed mixed modes.');

        const sharedFirst = path.join(root, 'Shared');
        fs.mkdirSync(sharedFirst, { recursive: true });
        capture(() => initProject({ projectPath: sharedFirst, shared: true }));
        writeFile(sharedFirst, 'CLAUDE.md', '@AGENTS.md\n\n' + readFile(sharedFirst, 'CLAUDE.md'));
        assert.ok(invokeCheck(sharedFirst).text.includes('imports AGENTS.md'), 'Checker missed double load via import.');
        writeFile(sharedFirst, '.context/knowledge.md', 'word '.repeat(801) + '\nSee [gone](missing.md) and [web](https://example.com).');
        let check = invokeCheck(sharedFirst);
        assert.ok(check.text.includes('knowledge.md has'), 'Checker missed knowledge size.');
        assert.ok(check.text.includes('Broken link in .context/knowledge.md: missing.md'), 'Checker missed broken link.');
        assert.ok(!check.text.includes('example.com'), 'Checker flagged an external link.');
        fs.rmSync(path.join(sharedFirst, '.context/state.md'));
        check = invokeCheck(sharedFirst);
        assert.equal(check.code, 1, 'Checker did not fail on missing state.');
        assert.ok(check.text.includes('Missing .context/state.md'), 'Checker missed missing state.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('missing rules rejects export without partial packet; history export adds two sections', () => {
    const root = fixtureRoot('contextspine-export');
    try {
        const project = path.join(root, 'Export');
        fs.mkdirSync(project, { recursive: true });
        capture(() => initProject({ projectPath: project }));
        fs.renameSync(path.join(project, '.context/rules.md'), path.join(project, '.context/rules.saved.md'));
        assert.throws(() => exportPacket({ projectPath: project }), /Missing .*rules\.md/, 'Export accepted missing rules.');
        fs.renameSync(path.join(project, '.context/rules.saved.md'), path.join(project, '.context/rules.md'));
        assert.equal((exportPacket({ projectPath: project, history: true }).match(/## Source:/g) || []).length, 7, 'History packet missing sections.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('customized rules are preserved and embedded; unknown tool rejected', () => {
    const root = fixtureRoot('contextspine-custom');
    try {
        const project = path.join(root, 'Customized rules');
        writeFile(project, '.context/rules.md', '# Rules\nPreserve this project-specific rule.');
        capture(() => initProject({ projectPath: project, tools: ['codex'], sync: true }));
        assert.ok(readFile(project, '.context/rules.md').includes('Preserve this project-specific rule.'), 'Custom rules replaced.');
        assert.ok(readFile(project, 'AGENTS.override.md').includes('Preserve this project-specific rule.'), 'Custom rules not embedded.');
        assert.throws(() => initProject({ projectPath: project, tools: ['bogus'] }), /Unknown tool 'bogus'/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('legacy workflow:v2 block: plain init keeps bytes, --sync replaces once preserving BOM/CRLF/surrounding text', () => {
    const root = fixtureRoot('frnzkit-legacy');
    try {
        const project = path.join(root, 'Legacy');
        fs.mkdirSync(project, { recursive: true });
        capture(() => initProject({ projectPath: project, tools: ['pi'] }));
        // Rebuild the adapter as a legacy-marked file with surrounding user text.
        const generated = readFile(project, 'AGENTS.override.md');
        const legacyBlock = generated
            .replaceAll('<!-- context-spine -->', LEGACY_MARKER)
            .replaceAll('<!-- /context-spine -->', LEGACY_END_MARKER);
        writeFile(project, 'AGENTS.override.md', `# Team rules\r\nKeep this.\r\n\r\n${legacyBlock.replace(/\n/g, '\r\n')}\r\n\r\nTrailer text.\r\n`, 'utf8-bom');
        const before = snapshot(project);
        capture(() => initProject({ projectPath: project, tools: ['pi'] }));
        assertUnchanged(project, before, 'Plain rerun on legacy marker');
        capture(() => initProject({ projectPath: project, tools: ['pi'], sync: true }));
        const bytes = fs.readFileSync(path.join(project, 'AGENTS.override.md'));
        assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'Sync dropped the BOM.');
        const text = bytes.subarray(3).toString('utf8');
        assert.ok(!text.includes('workflow:v2'), 'Legacy marker remains.');
        assert.equal(countMarker(text, MARKER), 1, 'New marker not written once.');
        assert.ok(text.startsWith('# Team rules\r\nKeep this.\r\n'), 'Surrounding text before the block changed.');
        assert.ok(text.endsWith('Trailer text.\r\n'), 'Trailer text changed.');
        const check = invokeCheck(project);
        assert.ok(check.text.includes('Result: PASS'), `Post-sync check: ${check.text}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('check on a legacy workflow:v2 adapter warns without failing; legacy shared adapter blocks private init', () => {
    const root = fixtureRoot('frnzkit-legacy-check');
    try {
        const project = path.join(root, 'LegacyWarn');
        fs.mkdirSync(project, { recursive: true });
        capture(() => initProject({ projectPath: project, tools: ['pi'] }));
        const adapter = readFile(project, 'AGENTS.override.md');
        writeFile(project, 'AGENTS.override.md', adapter
            .replaceAll('<!-- context-spine -->', LEGACY_MARKER)
            .replaceAll('<!-- /context-spine -->', LEGACY_END_MARKER));
        const check = invokeCheck(project);
        assert.equal(check.code, 0, `Legacy check exit: ${check.text}`);
        assert.ok(check.text.includes('uses the older workflow:v2 marker'), 'Missing legacy warning.');
        assert.ok(!check.text.includes('No initialized adapter'), 'Legacy adapter not counted initialized.');

        const conflict = path.join(root, 'Conflict');
        fs.mkdirSync(conflict, { recursive: true });
        writeFile(conflict, 'CLAUDE.md', `${LEGACY_MARKER}\nold block\n${LEGACY_END_MARKER}\n`);
        assert.throws(() => initProject({ projectPath: conflict }), /already uses shared workflow adapters/, 'Legacy shared adapter did not block private init.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('v1 adapter: init rejects with and without --sync, writes nothing, check warns', () => {
    const root = fixtureRoot('contextspine-v1');
    try {
        const project = path.join(root, 'V1');
        writeFile(project, 'AGENTS.override.md', '<!-- persistent-context:v1 -->\nOld routine.\n<!-- /persistent-context:v1 -->\n');
        for (const sync of [false, true]) {
            const before = snapshot(project);
            assert.throws(() => initProject({ projectPath: project, tools: ['codex'], sync }), /uses the older v1 workflow format.*No files changed/, 'v1 adapter not rejected.');
            assertUnchanged(project, before, `Rejected v1 run (sync=${sync})`);
            assert.ok(!fs.existsSync(path.join(project, '.context')), 'Rejected run created .context.');
        }
        writeFile(project, 'CLAUDE.local.md', '<!-- agent-run-rules:v1 -->\nOld rules.\n<!-- /agent-run-rules:v1 -->\n');
        assert.throws(() => initProject({ projectPath: project }), /uses the older v1 workflow format/, 'v1 rules marker not rejected.');
        const check = invokeCheck(project);
        assert.ok(check.text.includes('older v1 workflow format'), 'Checker missed v1 adapter.');
        assert.equal(check.code, 1, 'v1-only project should fail check.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
