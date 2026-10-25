import fs from 'node:fs';
import path from 'node:path';

// Encoding handling mirrors the kit's PowerShell Read-TextFile: BOM sniffing for
// UTF-8, UTF-16 LE, and UTF-16 BE; no BOM means UTF-8. Writes preserve the
// detected encoding including its BOM.

export function readTextFile(path) {
    const buffer = fs.readFileSync(path);
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return { content: buffer.subarray(3).toString('utf8'), encoding: 'utf8-bom' };
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return { content: buffer.subarray(2).toString('utf16le'), encoding: 'utf16le' };
    }
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
        const swapped = Buffer.alloc(buffer.length - 2);
        for (let i = 0; i < buffer.length - 2; i += 2) {
            swapped[i] = buffer[i + 3];
            swapped[i + 1] = buffer[i + 2];
        }
        return { content: swapped.toString('utf16le'), encoding: 'utf16be' };
    }
    return { content: buffer.toString('utf8'), encoding: 'utf8' };
}

export function encodeText(content, encoding) {
    switch (encoding) {
        case 'utf8-bom':
            return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, 'utf8')]);
        case 'utf16le':
            return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, 'utf16le')]);
        case 'utf16be': {
            const le = Buffer.from(content, 'utf16le');
            const be = Buffer.alloc(le.length);
            for (let i = 0; i < le.length; i += 2) {
                be[i] = le[i + 1];
                be[i + 1] = le[i];
            }
            return Buffer.concat([Buffer.from([0xfe, 0xff]), be]);
        }
        default:
            return Buffer.from(content, 'utf8');
    }
}

export function writeTextFile(filePath, content, encoding = 'utf8') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, encodeText(content, encoding));
}

export function normalizeText(text) {
    return text.replace(/\r\n/g, '\n').trim();
}

export function hasMarkerLine(text, marker) {
    return text.split(/\r?\n/).some((line) => line.trimEnd() === marker);
}

export function detectNewline(text) {
    return text.includes('\r\n') ? '\r\n' : '\n';
}

export function wordCount(text) {
    return (text.match(/\S+/g) || []).length;
}

export function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Same shape as the PowerShell Find-MarkedBlock: start marker through end
// marker, each on its own line.
export function findMarkedBlock(text, start, end) {
    const pattern = new RegExp(
        `^${escapeRegExp(start)}[ \\t]*\\r?$[\\s\\S]*?^${escapeRegExp(end)}[ \\t]*(?=\\r?$)`,
        'm'
    );
    return text.match(pattern);
}
