import { execFileSync } from 'node:child_process';

function gitAvailable() {
    try {
        execFileSync('git', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function run(root, args) {
    try {
        return { code: 0, out: execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (error) {
        return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
}

// Resolves the git top level for a project, or null when git is absent or
// rev-parse fails for any reason (output is localized; do not match it).
export function findGitRoot(projectRoot) {
    if (!gitAvailable()) return null;
    const probe = run(projectRoot, ['rev-parse', '--show-toplevel']);
    if (probe.code === 0) return probe.out.trim().split('\n')[0];
    return null;
}

export function trackedFiles(projectRoot, paths) {
    const result = run(projectRoot, ['ls-files', '--', '.context', ...paths]);
    if (result.code !== 0) throw new Error('Unable to check tracked context files.');
    return result.out.split('\n').filter(Boolean);
}

export function gitPath(projectRoot, ...args) {
    const result = run(projectRoot, ['rev-parse', ...args]);
    if (result.code !== 0) throw new Error(`Unable to run git rev-parse ${args.join(' ')}.`);
    return result.out.trim();
}
