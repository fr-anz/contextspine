import fs from 'node:fs';
import path from 'node:path';
import { kitRoot } from './adapters.js';
import { detectNewline, readTextFile, writeTextFile } from './text.js';

function out(message) {
    console.log(message);
}

export function initIdea({ projectPath = process.cwd(), projectName, docsPath = 'docs' } = {}) {
    const projectRoot = fs.realpathSync(projectPath);
    if (!fs.statSync(projectRoot).isDirectory()) {
        throw new Error('ProjectPath must be an existing directory.');
    }
    const name = projectName || path.basename(projectRoot);
    const templateRoot = path.join(kitRoot, 'templates', 'pipeline', 'docs');

    const projectFile = path.join(projectRoot, '.context', 'project.md');
    if (!fs.existsSync(projectFile)) {
        throw new Error('Run `npx contextspine init` first. No files changed.');
    }

    const docsRoot = path.join(projectRoot, docsPath);
    fs.mkdirSync(docsRoot, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    for (const file of fs.readdirSync(templateRoot).filter((f) => fs.statSync(path.join(templateRoot, f)).isFile())) {
        const destination = path.join(docsRoot, file);
        if (fs.existsSync(destination)) {
            out(`Kept ${destination}`);
            continue;
        }
        const content = fs.readFileSync(path.join(templateRoot, file), 'utf8')
            .replaceAll('{{PROJECT_NAME}}', name)
            .replaceAll('{{DATE}}', date);
        writeTextFile(destination, content);
        out(`Created ${destination}`);
    }

    // Route agents to the pipeline from project.md's "When to read" list.
    const docsRelative = docsPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const bullets = [
        `- Idea pipeline or planning work: [idea](../${docsRelative}/IDEA.md), [research](../${docsRelative}/RESEARCH.md), [PRD](../${docsRelative}/PRD.md), [design system](../${docsRelative}/DSD.md), [system design](../${docsRelative}/SDD.md), [QA plan](../${docsRelative}/QAD.md)`,
        `- Building or picking the next milestone: [build guide](../${docsRelative}/BUILD.md)`,
    ];
    const file = readTextFile(projectFile);
    if (!file.content.includes(`../${docsRelative}/IDEA.md`)) {
        const newline = detectNewline(file.content);
        const text = file.content;
        let updated;
        if (/^## When to read[ \t]*$/m.test(text)) {
            const lines = text.split(/\r?\n/);
            let insertAt = -1;
            let headingAt = -1;
            let inList = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (/^## /.test(line)) {
                    inList = /^## When to read[ \t]*$/.test(line);
                    if (inList) headingAt = i;
                    continue;
                }
                if (inList && /^\s*[-*]\s/.test(line)) insertAt = i;
            }
            if (insertAt < 0) insertAt = headingAt;
            const insert = bullets.join(newline);
            if (insertAt >= 0) {
                const head = lines.slice(0, insertAt + 1).join(newline) + newline + insert;
                const tail = insertAt < lines.length - 1 ? newline + lines.slice(insertAt + 1).join(newline) : '';
                updated = head + tail;
            } else {
                updated = text.trimEnd() + newline + newline + insert + newline;
            }
        } else {
            updated = text.trimEnd() + newline + newline + '## When to read' + newline + newline + bullets.join(newline) + newline;
        }
        writeTextFile(projectFile, updated, file.encoding);
        out(`Routed idea pipeline in ${projectFile}`);
    } else {
        out(`Kept ${projectFile} routing`);
    }

    out(`Idea pipeline ready in ${docsRelative}. Start a fresh agent session and use the prompts from \`npx contextspine prompt\`.`);
}
