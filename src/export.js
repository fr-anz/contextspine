import fs from 'node:fs';
import path from 'node:path';

const HEADER = `# Project context packet

Use this packet as saved context, subject to the current request and current
project evidence. Relative links refer to the project root or to the original
source document. Referenced files are not included unless their content appears
below. If you have no repository access, say so and do not claim to verify files
or run checks. At a checkpoint, return revised state and any new decisions or
preferences so they can be saved back into the original context files.`;

export function exportPacket({ projectPath = process.cwd(), history = false } = {}) {
    const projectRoot = fs.realpathSync(projectPath);
    const files = ['rules.md', 'protocol.md', 'preferences.md', 'project.md', 'state.md'];
    if (history) files.push('decisions.md', 'knowledge.md');

    // Read everything before output so missing files cannot produce a partial packet.
    const sections = files.map((file) => {
        const filePath = path.join(projectRoot, '.context', file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing ${filePath}. Initialize this project before exporting context.`);
        }
        return `## Source: .context/${file}\n\n${fs.readFileSync(filePath, 'utf8')}`;
    });

    return `${HEADER}\n\nExported: ${new Date().toISOString()}\n\n${sections.join('\n\n---\n\n')}`;
}
