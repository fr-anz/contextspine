import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { kitRoot } from './adapters.js';

export function userProfilePath() {
    return path.join(os.homedir(), '.contextspine', 'profile.md');
}

export function ensureProfile() {
    const profilePath = userProfilePath();
    if (!fs.existsSync(profilePath)) {
        fs.mkdirSync(path.dirname(profilePath), { recursive: true });
        const content = fs.readFileSync(path.join(kitRoot, 'templates', 'profile.md'), 'utf8')
            .replaceAll('{{DATE}}', new Date().toISOString().slice(0, 10));
        fs.writeFileSync(profilePath, content, 'utf8');
    }
    return profilePath;
}
