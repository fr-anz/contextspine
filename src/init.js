import fs from 'node:fs';
import path from 'node:path';
import {
    CURSOR_ADAPTER, CURSOR_FRONTMATTER, END_MARKER, LEGACY_END_MARKER, LEGACY_MARKER, MARKER, V1_MARKER,
    getAdapterPaths, getModeConflict, getRulesBody, isAnyAdapter, isContextSpineAdapter, isLegacyV2Adapter, isV1Adapter,
    kitRoot, newWorkflowBlock,
} from './adapters.js';
import { detectNewline, findMarkedBlock, hasMarkerLine, readTextFile, writeTextFile } from './text.js';
import { findGitRoot, gitPath, trackedFiles } from './git.js';
import { userProfilePath } from './profile.js';

function out(message) {
    console.log(message);
}

// Appends a marked section to a file, or creates it. Never rewrites existing text.
function addInstructionSection(filePath, content, marker) {
    if (fs.existsSync(filePath)) {
        const existing = readTextFile(filePath);
        if (hasMarkerLine(existing.content, marker)) {
            out(`Kept ${filePath}`);
            return;
        }
        const appended = `${existing.content}\n\n${content}\n`;
        writeTextFile(filePath, appended, existing.encoding);
        out(`Appended to ${filePath}`);
    } else {
        writeTextFile(filePath, `${content}\n`);
        out(`Created ${filePath}`);
    }
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

export function initProject({ projectPath = process.cwd(), projectName, tools = ['pi', 'claude-kiro', 'codex'], shared = false, sync = false } = {}) {
    const projectRoot = fs.realpathSync(projectPath);
    if (!fs.statSync(projectRoot).isDirectory()) {
        throw new Error('ProjectPath must be an existing directory.');
    }
    const name = projectName || path.basename(projectRoot);
    const templateRoot = path.join(kitRoot, 'templates', 'project', '.context');

    for (const tool of tools) {
        if (!['pi', 'claude-kiro', 'codex', 'claude', 'cursor', 'copilot'].includes(tool)) {
            throw new Error(`Unknown tool '${tool}'. Valid tools: pi, claude-kiro, codex, claude, cursor, copilot.`);
        }
    }
    const adapterPaths = getAdapterPaths(tools, shared);

    // Preflight before writing: git ignores cannot make tracked memory private.
    const gitRoot = findGitRoot(projectRoot);
    if (!shared && gitRoot) {
        const tracked = trackedFiles(projectRoot, adapterPaths);
        if (tracked.length > 0) {
            throw new Error(`Already tracked workflow files cannot be made private by ignoring them. No files changed. Use --shared to retain shared context, or move these files out of tracking yourself: ${tracked.join(', ')}`);
        }
    }
    // One mode per project: Claude Code loads CLAUDE.md and CLAUDE.local.md together.
    const modes = getModeConflict(projectRoot);
    const otherMode = shared ? modes.private : modes.shared;
    if (otherMode.length > 0) {
        const current = shared ? 'private' : 'shared';
        throw new Error(`This project already uses ${current} workflow adapters (${otherMode.join(', ')}). Use one mode per project: rerun with matching --shared, or remove the workflow sections from those files first. No files changed.`);
    }
    for (const relativePath of adapterPaths) {
        const filePath = path.join(projectRoot, relativePath);
        if (!fs.existsSync(filePath)) continue;
        if (isV1Adapter(filePath) && !isAnyAdapter(filePath)) {
            throw new Error(`${relativePath} uses the older v1 workflow format. Remove its v1 sections, then rerun. No files changed.`);
        }
        if (relativePath === CURSOR_ADAPTER && !isAnyAdapter(filePath)) {
            throw new Error(`Existing Cursor rule has no context marker. Preserved ${filePath}; merge the router into an always-applied rule manually.`);
        }
    }

    if (!shared) {
        let ignorePath = path.join(projectRoot, '.gitignore');
        let prefix = '';
        if (gitRoot) {
            ignorePath = gitPath(projectRoot, '--path-format=absolute', '--git-path', 'info/exclude');
            prefix = gitPath(projectRoot, '--show-prefix');
        }
        const patterns = ['.context/', ...adapterPaths].map((rel) => {
            const combined = (prefix + rel).replace(/\\/g, '/');
            return '/' + combined.replace(/([*?[\]\\])/g, '\\$1');
        });
        for (const pattern of patterns) {
            addInstructionSection(ignorePath, pattern, pattern);
        }
        out(`Private workflow ignored through ${ignorePath}`);
    }

    const contextRoot = path.join(projectRoot, '.context');
    fs.mkdirSync(contextRoot, { recursive: true });

    for (const file of fs.readdirSync(templateRoot).filter((f) => fs.statSync(path.join(templateRoot, f)).isFile())) {
        const destination = path.join(contextRoot, file);
        if (fs.existsSync(destination)) {
            out(`Kept ${destination}`);
            continue;
        }
        const content = fs.readFileSync(path.join(templateRoot, file), 'utf8')
            .replaceAll('{{PROJECT_NAME}}', name)
            .replaceAll('{{DATE}}', today());
        writeTextFile(destination, content);
        out(`Created ${destination}`);
    }

    const preferencesPath = path.join(contextRoot, 'preferences.md');
    if (!fs.existsSync(preferencesPath)) {
        const source = fs.existsSync(userProfilePath()) ? userProfilePath() : path.join(kitRoot, 'templates', 'profile.md');
        const content = fs.readFileSync(source, 'utf8').replaceAll('{{DATE}}', today());
        writeTextFile(preferencesPath, content);
        out(`Created ${preferencesPath}`);
    } else {
        out(`Kept ${preferencesPath}`);
    }

    const rulesBody = getRulesBody(path.join(contextRoot, 'rules.md'));
    for (const relativePath of adapterPaths) {
        const filePath = path.join(projectRoot, relativePath);
        const block = newWorkflowBlock(rulesBody, relativePath);
        if (!fs.existsSync(filePath)) {
            const content = relativePath === CURSOR_ADAPTER ? `${CURSOR_FRONTMATTER}\n\n${block}` : block;
            addInstructionSection(filePath, content, MARKER);
            continue;
        }
        const file = readTextFile(filePath);
        const newline = detectNewline(file.content);
        const localBlock = block.replace(/\n/g, newline);
        const current = findMarkedBlock(file.content, MARKER, END_MARKER);
        const legacy = findMarkedBlock(file.content, LEGACY_MARKER, LEGACY_END_MARKER);
        if (current) {
            if (!sync || current[0] === localBlock) {
                out(`Kept ${filePath}`);
                continue;
            }
            const updated = file.content.slice(0, current.index) + localBlock + file.content.slice(current.index + current[0].length);
            writeTextFile(filePath, updated, file.encoding);
            out(`Synced ${filePath}`);
        } else if (legacy) {
            if (!sync) {
                out(`Kept ${filePath} (older workflow:v2 marker; rerun with --sync to update)`);
                continue;
            }
            const updated = file.content.slice(0, legacy.index) + localBlock + file.content.slice(legacy.index + legacy[0].length);
            writeTextFile(filePath, updated, file.encoding);
            out(`Updated ${filePath} to the context-spine marker`);
        } else {
            addInstructionSection(filePath, block, MARKER);
        }
    }

    out('Context ready. Start a fresh agent session here. Checkpoints save automatically by instruction; no hooks or extra model calls installed.');
}
