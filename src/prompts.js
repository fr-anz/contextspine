import fs from 'node:fs';
import path from 'node:path';
import { kitRoot } from './adapters.js';

const NAMES = [
    ['resume', '## Resume', 'Resume a project from its saved context.', 0],
    ['onboard', '## First project session', 'Onboard a project into the context workflow.', 0],
    ['idea', '### 1. Idea intake', 'Screen the problem and choose a solution.', 0],
    ['research', '### 2a. Deep search by the agent', 'Research the idea with agent web search.', 0],
    ['research-brief', '### 2b. Deep search in ChatGPT', 'Write a paste-ready external research brief.', 0],
    ['research-import', '### 2b. Deep search in ChatGPT', 'Normalize pasted external research results.', 1],
    ['propagate', '### 3. Metaprompt', 'Propagate the idea into the five build documents.', 0],
    ['checkpoint', '## Optional checkpoint', 'Save a checkpoint before an interruption or tool switch.', 0],
    ['preference', '## Record a reusable preference', 'Save a stated preference into the profile.', 0],
    ['drift', '## Review context for drift', 'Reverify saved context against the repository.', 0],
];

function sections(markdown) {
    const lines = markdown.split(/\r?\n/);
    const result = [];
    let current = null;
    for (const line of lines) {
        if (/^#{2,3} /.test(line)) {
            if (current) result.push(current);
            current = { heading: line.trimEnd(), lines: [] };
        } else if (current) {
            current.lines.push(line);
        }
    }
    if (current) result.push(current);
    return result;
}

function textBlocks(section) {
    const blocks = [];
    const text = section.lines.join('\n');
    for (const match of text.matchAll(/```text\n([\s\S]*?)```/g)) {
        blocks.push(match[1].trim());
    }
    return blocks;
}

export function listPrompts() {
    return NAMES.map(([name, , description]) => ({ name, description }));
}

export function getPrompt(name) {
    const entry = NAMES.find(([n]) => n === name);
    if (!entry) return null;
    const [, headingPrefix, , blockIndex] = entry;
    const markdown = fs.readFileSync(path.join(kitRoot, 'prompts.md'), 'utf8');
    const section = sections(markdown).find((s) => s.heading.startsWith(headingPrefix));
    if (!section) return null;
    const blocks = textBlocks(section);
    return blocks[blockIndex] ?? null;
}
