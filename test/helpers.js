import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const binPath = path.join(kitRoot, 'bin', 'contextspine.js');

export function fixtureRoot(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

export function writeFile(project, relative, content, encoding = 'utf8') {
    const filePath = path.join(project, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (encoding === 'utf16le') {
        fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, 'utf16le')]));
    } else if (encoding === 'utf16be') {
        const le = Buffer.from(content, 'utf16le');
        const be = Buffer.alloc(le.length);
        for (let i = 0; i < le.length; i += 2) { be[i] = le[i + 1]; be[i + 1] = le[i]; }
        fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xfe, 0xff]), be]));
    } else if (encoding === 'utf8-bom') {
        fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, 'utf8')]));
    } else {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

export function readFile(project, relative) {
    return fs.readFileSync(path.join(project, relative), 'utf8');
}

export function snapshot(project) {
    const hashes = new Map();
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== '.git') walk(full);
            else if (entry.isFile()) hashes.set(full, fs.readFileSync(full).toString('base64'));
        }
    };
    walk(project);
    return hashes;
}

export function assertUnchanged(project, before, context) {
    const after = snapshot(project);
    if (after.size !== before.size) throw new Error(`${context} changed file count.`);
    for (const [key, value] of before) {
        if (after.get(key) !== value) throw new Error(`${context} changed ${key}`);
    }
}

export function runCli(args, { cwd, env } = {}) {
    const result = spawnSync(process.execPath, [binPath, ...args], {
        cwd,
        env: { ...process.env, ...env },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function countMarker(text, marker) {
    return text.split(marker).length - 1;
}
