import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasMarkerLine, readTextFile } from './text.js';

export const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MARKER = '<!-- workflow:v2 -->';
export const END_MARKER = '<!-- /workflow:v2 -->';
export const V1_MARKER = '<!-- persistent-context:v1 -->';
export const V1_END_MARKER = '<!-- /persistent-context:v1 -->';
export const V1_RULES_MARKER = '<!-- agent-run-rules:v1 -->';
export const V1_RULES_END_MARKER = '<!-- /agent-run-rules:v1 -->';
export const OVERRIDE_PREAMBLE = 'Read existing `AGENTS.md` (or `AGENTS.MD`, then `CLAUDE.md`/`CLAUDE.MD` if absent) in this directory for team instructions before work. This local override preserves their authority.';
export const CURSOR_ADAPTER = '.cursor/rules/persistent-context.mdc';
export const CURSOR_FRONTMATTER = '---\ndescription: Resume and maintain persistent project context\nalwaysApply: true\n---';
export const PRIVATE_ADAPTERS = ['AGENTS.override.md', 'CLAUDE.local.md'];
export const SHARED_ADAPTERS = ['AGENTS.md', 'CLAUDE.md'];
export const ALL_ADAPTERS = [...PRIVATE_ADAPTERS, ...SHARED_ADAPTERS, CURSOR_ADAPTER, '.github/copilot-instructions.md'];
export const TOOLS = ['pi', 'claude-kiro', 'codex', 'claude', 'cursor', 'copilot'];

export function getAdapterPaths(tools, shared) {
    const paths = tools.map((tool) => {
        if (tool === 'pi' || tool === 'codex') return shared ? 'AGENTS.md' : 'AGENTS.override.md';
        if (tool === 'claude-kiro' || tool === 'claude') return shared ? 'CLAUDE.md' : 'CLAUDE.local.md';
        if (tool === 'cursor') return CURSOR_ADAPTER;
        return '.github/copilot-instructions.md';
    });
    return [...new Set(paths)];
}

export function isV2Adapter(filePath) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    return hasMarkerLine(readTextFile(filePath).content, MARKER);
}

export function isV1Adapter(filePath) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    const content = readTextFile(filePath).content;
    return hasMarkerLine(content, V1_MARKER) || hasMarkerLine(content, V1_RULES_MARKER);
}

export function getModeConflict(projectRoot) {
    const at = (rel) => path.join(projectRoot, rel);
    return {
        private: PRIVATE_ADAPTERS.filter((rel) => isV2Adapter(at(rel)) || isV1Adapter(at(rel))),
        shared: SHARED_ADAPTERS.filter((rel) => isV2Adapter(at(rel)) || isV1Adapter(at(rel))),
    };
}

export function getRulesBody(rulesPath) {
    const text = fs.readFileSync(rulesPath, 'utf8').replace(/\r\n/g, '\n');
    return text.replace(/^\s*#[^\n]*\n/, '').trim();
}

const ROUTINE = `Before substantive work, read \`.context/project.md\`, \`.context/preferences.md\`,
and \`.context/state.md\` once per session; reread only changed files. Open other
files only when project.md's "When to read" list calls for them. After meaningful
progress, task changes, and before your final reply, update state.md following
\`.context/protocol.md\`; skip trivial Q&A without findings. If files are
unavailable, say so and use or return a context packet. If this section loads
twice, apply it once.`;

export function newWorkflowBlock(rulesBody, relativePath) {
    const preamble = relativePath === 'AGENTS.override.md' ? `${OVERRIDE_PREAMBLE}\n\n` : '';
    return `${MARKER}\n<!-- Generated from .context/rules.md; edit there, then run: npx contextspine init --sync -->\n## Project workflow\n\n${preamble}${rulesBody}\n\n${ROUTINE}\n${END_MARKER}`;
}

