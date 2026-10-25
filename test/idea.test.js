import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initProject } from '../src/init.js';
import { initIdea } from '../src/idea.js';
import { checkProject } from '../src/check.js';
import { assertUnchanged, countMarker, fixtureRoot, readFile, snapshot, writeFile } from './helpers.js';

const PIPELINE_DOCS = ['IDEA.md', 'RESEARCH.md', 'PRD.md', 'DSD.md', 'SDD.md', 'QAD.md', 'BUILD.md'];

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

const invokeCheck = (project, docsPath) => capture(() => checkProject({ projectPath: project, docsPath }));

function newProject(root, name) {
    const project = path.join(root, name);
    fs.mkdirSync(project, { recursive: true });
    capture(() => initProject({ projectPath: project, tools: ['pi'] }));
    return project;
}

test('init + idea: 7 docs created, placeholders substituted, routed once, clean check', () => {
    const root = fixtureRoot('contextspine-idea');
    try {
        const project = newProject(root, 'Fresh');
        capture(() => initIdea({ projectPath: project }));
        for (const name of PIPELINE_DOCS) {
            const filePath = path.join(project, 'docs', name);
            assert.ok(fs.existsSync(filePath), `Missing docs/${name}.`);
            const text = fs.readFileSync(filePath, 'utf8');
            assert.ok(!text.includes('{{'), `Unresolved placeholder in docs/${name}.`);
            assert.ok(text.includes('# Fresh '), `Project name not substituted in docs/${name}.`);
        }
        const projectMd = readFile(project, '.context/project.md');
        assert.equal(countMarker(projectMd, '- Idea pipeline or planning work:'), 1, 'Pipeline bullet missing or duplicated.');
        assert.equal(countMarker(projectMd, '- Building or picking the next milestone:'), 1, 'Build bullet missing or duplicated.');
        const check = invokeCheck(project);
        assert.equal(check.code, 0);
        assert.ok(!/^WARN/m.test(check.text), `Fresh pipeline check output: ${check.text}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('rerun keeps every doc and project.md byte-identical', () => {
    const root = fixtureRoot('contextspine-idea-rerun');
    try {
        const project = newProject(root, 'Rerun');
        capture(() => initIdea({ projectPath: project }));
        const before = snapshot(project);
        capture(() => initIdea({ projectPath: project }));
        assertUnchanged(project, before, 'idea rerun');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('existing docs/PRD.md preserved byte-for-byte; remaining docs created', () => {
    const root = fixtureRoot('contextspine-idea-keep');
    try {
        const project = newProject(root, 'Kept');
        writeFile(project, 'docs/PRD.md', '# Custom PRD\nDo not overwrite.\n');
        const prdBefore = fs.readFileSync(path.join(project, 'docs/PRD.md'));
        capture(() => initIdea({ projectPath: project }));
        assert.deepEqual(fs.readFileSync(path.join(project, 'docs/PRD.md')), prdBefore, 'Existing PRD.md was modified.');
        for (const name of PIPELINE_DOCS.filter((n) => n !== 'PRD.md')) {
            assert.ok(fs.existsSync(path.join(project, 'docs', name)), `Missing docs/${name} beside existing PRD.`);
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('missing .context rejects before any write', () => {
    const root = fixtureRoot('contextspine-idea-bare');
    try {
        const bare = path.join(root, 'Bare');
        fs.mkdirSync(bare, { recursive: true });
        assert.throws(() => initIdea({ projectPath: bare }), /contextspine init`? first/, 'idea ran without .context.');
        assert.ok(!fs.existsSync(path.join(bare, 'docs')), 'Rejected run still created docs/.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('custom --docs: docs nested, links relative, checker follows --docs', () => {
    const root = fixtureRoot('contextspine-idea-docs');
    try {
        const project = newProject(root, 'Nested');
        capture(() => initIdea({ projectPath: project, docsPath: 'planning\\spec' }));
        assert.ok(fs.existsSync(path.join(project, 'planning', 'spec', 'PRD.md')), 'Docs not created under planning/spec.');
        assert.ok(readFile(project, '.context/project.md').includes('../planning/spec/IDEA.md'), 'Routing uses wrong relative path.');
        const check = invokeCheck(project, 'planning/spec');
        assert.equal(check.code, 0);
        assert.ok(!/^WARN/m.test(check.text), `Custom docs path check output: ${check.text}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('project.md BOM and CRLF preserved through routing', () => {
    const root = fixtureRoot('contextspine-idea-enc');
    try {
        const project = newProject(root, 'Encoded');
        writeFile(project, '.context/project.md', '# Project\r\n\r\n## When to read\r\n\r\n- First: [state](state.md)\r\n', 'utf8-bom');
        capture(() => initIdea({ projectPath: project }));
        const bytes = fs.readFileSync(path.join(project, '.context/project.md'));
        assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'Routing dropped the BOM.');
        const text = bytes.subarray(3).toString('utf8');
        assert.ok(text.includes('- Idea pipeline or planning work:'), 'Routing bullets missing.');
        assert.ok(!/[^\r]\n/.test(text), 'Mixed line endings introduced.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('checker: undefined R9 warned, untested R2 warned, R1 clean, exit 0', () => {
    const root = fixtureRoot('contextspine-idea-ids');
    try {
        const project = newProject(root, 'Ids');
        capture(() => initIdea({ projectPath: project }));
        writeFile(project, 'docs/PRD.md', '# PRD\n\n| ID | Requirement | Type | Priority | Acceptance criteria |\n| --- | --- | --- | --- | --- |\n| R1 | One | functional | high | done |\n| R2 | Two | functional | low | done |\n');
        writeFile(project, 'docs/QAD.md', '# QAD\n\n| ID | Verifies | Type | Steps | Pass criteria |\n| --- | --- | --- | --- | --- |\n| T1 | R1 and R9 | unit | run | green |\n');
        writeFile(project, 'docs/BUILD.md', '# BUILD\nDelivers R2.\n');
        const check = invokeCheck(project);
        assert.equal(check.code, 0, `Checker exit: ${check.text}`);
        assert.match(check.text, /QAD\.md references R9, not defined in PRD\.md/, 'Missing R9 warning.');
        assert.match(check.text, /R2 has no test in QAD\.md/, 'Missing R2 coverage warning.');
        assert.ok(!/R1 has no test/.test(check.text) && !/references R1/.test(check.text), 'False warning for R1.');
        assert.match(check.text, /2 requirements in PRD\.md, 1 covered/, 'Wrong INFO count.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('missing "When to read": heading and bullets appended, check clean', () => {
    const root = fixtureRoot('contextspine-idea-plain');
    try {
        const project = newProject(root, 'Plain');
        writeFile(project, '.context/project.md', '# Project\n\nShort purpose.\n');
        capture(() => initIdea({ projectPath: project }));
        const projectMd = readFile(project, '.context/project.md');
        assert.ok(projectMd.includes('## When to read'), 'Heading not appended.');
        assert.equal(countMarker(projectMd, '- Idea pipeline or planning work:'), 1, 'Bullets not appended.');
        const check = invokeCheck(project);
        assert.equal(check.code, 0);
        assert.ok(!/^WARN/m.test(check.text), `Appended heading check output: ${check.text}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('no trailing newline: last bullet and trailing heading never duplicated', () => {
    const root = fixtureRoot('contextspine-idea-tail');
    try {
        const project = newProject(root, 'NoTailNewline');
        writeFile(project, '.context/project.md', '# Project\n\n## When to read\n\n- First: [state](state.md)\n- Last: [decisions](decisions.md)');
        capture(() => initIdea({ projectPath: project }));
        const lines = readFile(project, '.context/project.md').split(/\r?\n/);
        assert.equal(lines.filter((l) => l === '- Last: [decisions](decisions.md)').length, 1, 'Last original bullet duplicated.');
        assert.equal(lines.filter((l) => l === '- First: [state](state.md)').length, 1, 'First bullet duplicated.');
        assert.equal(lines.filter((l) => l.startsWith('- Idea pipeline or planning work:')).length, 1, 'Pipeline bullet count wrong.');
        assert.equal(lines.at(-3), '- Last: [decisions](decisions.md)', 'Pipeline bullets not after last original bullet.');
        assert.match(lines.at(-2), /^- Idea pipeline or planning work:/, 'Pipeline bullet misplaced.');
        assert.match(lines.at(-1), /^- Building or picking the next milestone:/, 'Build bullet not last.');

        const bare = newProject(root, 'BareHeading');
        writeFile(bare, '.context/project.md', '# Project\n\n## When to read');
        capture(() => initIdea({ projectPath: bare }));
        const bareLines = readFile(bare, '.context/project.md').split(/\r?\n/);
        assert.equal(bareLines.filter((l) => /^## When to read/.test(l)).length, 1, 'Heading duplicated.');
        assert.match(bareLines.at(-2), /^- Idea pipeline or planning work:/, 'Bullets not after trailing heading.');
        assert.match(bareLines.at(-1), /^- Building or picking the next milestone:/, 'Build bullet not last.');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
