import fs from 'node:fs';
import path from 'node:path';
import {
    ALL_ADAPTERS, END_MARKER, MARKER,
    getModeConflict, getRulesBody, isV1Adapter, isV2Adapter, newWorkflowBlock,
} from './adapters.js';
import { findMarkedBlock, hasMarkerLine, normalizeText, readTextFile, wordCount } from './text.js';

const BUDGETS = { 'project.md': 200, 'preferences.md': 80, 'state.md': 120, 'rules.md': 150, 'protocol.md': 150 };
const PIPELINE_DOCS = ['IDEA.md', 'RESEARCH.md', 'PRD.md', 'DSD.md', 'SDD.md', 'QAD.md', 'BUILD.md'];
const SYNC_HINT = 'Run `npx contextspine init --sync` with the same --tools/--shared options.';

// Read-only health check for a project's workflow context. Returns 1 on FAIL.
export function checkProject({ projectPath = process.cwd(), docsPath = 'docs' } = {}) {
    const projectRoot = fs.realpathSync(projectPath);
    const contextRoot = path.join(projectRoot, '.context');
    const results = [];
    const add = (level, message) => results.push({ level, message });

    let sessionWords = 0;
    for (const [name, budget] of Object.entries(BUDGETS)) {
        const filePath = path.join(contextRoot, name);
        if (!fs.existsSync(filePath)) {
            add('FAIL', `Missing .context/${name}. Run \`npx contextspine init\`.`);
            continue;
        }
        const words = wordCount(fs.readFileSync(filePath, 'utf8'));
        if (['project.md', 'preferences.md', 'state.md'].includes(name)) sessionWords += words;
        if (words > budget) add('WARN', `.context/${name} has ${words} words (budget ${budget}).`);
    }
    const knowledgePath = path.join(contextRoot, 'knowledge.md');
    if (fs.existsSync(knowledgePath) && wordCount(fs.readFileSync(knowledgePath, 'utf8')) > 800) {
        add('WARN', `.context/knowledge.md has ${wordCount(fs.readFileSync(knowledgePath, 'utf8'))} words (800). Replace superseded entries or move old ones to .context/archive/.`);
    }

    const projectMdPath = path.join(contextRoot, 'project.md');
    if (fs.existsSync(projectMdPath) && !hasMarkerLine(fs.readFileSync(projectMdPath, 'utf8'), '## When to read')) {
        add('WARN', "project.md has no '## When to read' list, so agents cannot find on-demand files.");
    }

    if (fs.existsSync(contextRoot)) {
        for (const file of fs.readdirSync(contextRoot).filter((f) => f.endsWith('.md'))) {
            for (const link of fs.readFileSync(path.join(contextRoot, file), 'utf8').matchAll(/\]\(([^)\s]+)\)/g)) {
                const target = link[1].split('#')[0];
                if (!target || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) continue;
                if (!fs.existsSync(path.join(contextRoot, decodeURIComponent(target)))) {
                    add('WARN', `Broken link in .context/${file}: ${target}`);
                }
            }
        }
    }

    const rulesPath = path.join(contextRoot, 'rules.md');
    const rulesBody = fs.existsSync(rulesPath) ? getRulesBody(rulesPath) : null;
    const initialized = [];
    for (const relativePath of ALL_ADAPTERS) {
        const filePath = path.join(projectRoot, relativePath);
        if (!fs.existsSync(filePath)) continue;
        if (isV1Adapter(filePath) && !isV2Adapter(filePath)) {
            add('WARN', `${relativePath} uses the older v1 workflow format; remove its v1 sections, then run \`npx contextspine init --sync\`.`);
            continue;
        }
        if (!isV2Adapter(filePath)) continue;
        initialized.push(relativePath);
        const text = readTextFile(filePath).content;
        const block = findMarkedBlock(text, MARKER, END_MARKER);
        if (!block) {
            add('FAIL', `${relativePath} has an unterminated workflow section.`);
            continue;
        }
        if (rulesBody !== null && normalizeText(block[0]) !== normalizeText(newWorkflowBlock(rulesBody, relativePath))) {
            add('WARN', `${relativePath} is out of date with .context/rules.md. ${SYNC_HINT}`);
        }
    }
    if (initialized.length === 0) {
        add('FAIL', 'No initialized adapter found. Run `npx contextspine init`.');
    }

    const modes = getModeConflict(projectRoot);
    if (modes.private.length > 0 && modes.shared.length > 0) {
        add('WARN', `Mixed modes: private (${modes.private.join(', ')}) and shared (${modes.shared.join(', ')}). Claude Code loads CLAUDE.md and CLAUDE.local.md together; keep one mode.`);
    }
    const claudePath = path.join(projectRoot, 'CLAUDE.md');
    if (isV2Adapter(claudePath) && isV2Adapter(path.join(projectRoot, 'AGENTS.md')) &&
        /^\s*@AGENTS\.md\s*$/m.test(readTextFile(claudePath).content)) {
        add('WARN', 'CLAUDE.md imports AGENTS.md and both carry the workflow section, so Claude Code loads it twice. Keep the section in one of them.');
    }

    // Idea pipeline: runs only when docs/PRD.md exists.
    const docsRoot = path.join(projectRoot, docsPath);
    const prdPath = path.join(docsRoot, 'PRD.md');
    if (fs.existsSync(prdPath)) {
        const docText = {};
        for (const name of PIPELINE_DOCS) {
            const filePath = path.join(docsRoot, name);
            if (!fs.existsSync(filePath)) {
                add('WARN', `Idea pipeline is missing ${docsPath}/${name}. Run \`npx contextspine idea\` or restore the file.`);
                continue;
            }
            docText[name] = fs.readFileSync(filePath, 'utf8');
            for (const link of docText[name].matchAll(/\]\(([^)\s]+)\)/g)) {
                const target = link[1].split('#')[0];
                if (!target || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) continue;
                if (!fs.existsSync(path.join(docsRoot, decodeURIComponent(target)))) {
                    add('WARN', `Broken link in ${docsPath}/${name}: ${target}`);
                }
            }
        }
        const defined = [...new Set([...docText['PRD.md'].matchAll(/^\s*(?:\|\s*|[-*]\s+)\**(R\d+)\**\b/gm)].map((m) => m[1]))];
        for (const name of ['DSD.md', 'SDD.md', 'QAD.md', 'BUILD.md']) {
            if (!(name in docText)) continue;
            for (const id of [...new Set([...docText[name].matchAll(/\bR\d+\b/g)].map((m) => m[0]))]) {
                if (!defined.includes(id)) add('WARN', `${name} references ${id}, not defined in PRD.md`);
            }
        }
        if (defined.length > 0) {
            const qad = docText['QAD.md'] ?? '';
            let covered = 0;
            for (const id of defined) {
                if (new RegExp(`\\b${id}\\b`).test(qad)) covered++;
                else add('WARN', `${id} has no test in QAD.md`);
            }
            add('INFO', `Idea pipeline: ${defined.length} requirements in PRD.md, ${covered} covered by QAD.md.`);
        }
    }

    if (rulesBody !== null) {
        const adapterWords = wordCount(newWorkflowBlock(rulesBody, 'AGENTS.md'));
        add('INFO', `Loaded every session: adapter section ${adapterWords} words + project/preferences/state ${sessionWords} words.`);
    }

    for (const { level, message } of results) console.log(`${level.padEnd(5)} ${message}`);
    const failures = results.filter((r) => r.level === 'FAIL').length;
    const warnings = results.filter((r) => r.level === 'WARN').length;
    const status = failures ? 'FAIL' : warnings ? 'WARN' : 'PASS';
    console.log(`Result: ${status} (${failures} failures, ${warnings} warnings). No files changed.`);
    return failures ? 1 : 0;
}
