import { parseArgs } from 'node:util';
import { initProject } from './init.js';
import { initIdea } from './idea.js';
import { checkProject } from './check.js';
import { exportPacket } from './export.js';
import { getPrompt, listPrompts } from './prompts.js';
import { ensureProfile } from './profile.js';

const HELP = `contextspine — persistent context and an idea-to-build pipeline for AI coding agents

Quick start:
  0. npm install -g contextspine   (or prefix every command with npx)
  1. cd your-project && contextspine init
  2. Open your agent in the same folder.
  3. Run "contextspine prompt onboard" and paste its output into the agent
     (first time); use "resume" afterwards.

Commands:
  init [path]     Create .context/ and agent instruction files
                  [--shared] [--tools pi,claude-kiro,codex] [--sync] [--name X]
  idea [path]     Create the docs/ idea-pipeline documents [--docs docs]
  check [path]    Report context health without writing [--docs docs]
  export [path]   Print a context packet for chat-only tools [--history]
  prompt [name]   List prompts, or print one: resume, onboard, idea, research,
                  research-brief, research-import, propagate, checkpoint,
                  preference, drift
  profile         Show (and create) your shared profile at ~/.contextspine/profile.md
  help            This help
`;

export async function main(argv) {
    const command = argv[0];
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        process.stdout.write(HELP);
        return 0;
    }

    switch (command) {
        case 'init': {
            const { values, positionals } = parseArgs({
                args: argv.slice(1), allowPositionals: true,
                options: { shared: { type: 'boolean' }, tools: { type: 'string' }, sync: { type: 'boolean' }, name: { type: 'string' } },
            });
            initProject({
                projectPath: positionals[0] ?? process.cwd(),
                projectName: values.name,
                tools: values.tools ? values.tools.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
                shared: values.shared ?? false,
                sync: values.sync ?? false,
            });
            return 0;
        }
        case 'idea': {
            const { values, positionals } = parseArgs({
                args: argv.slice(1), allowPositionals: true,
                options: { docs: { type: 'string' } },
            });
            initIdea({ projectPath: positionals[0] ?? process.cwd(), docsPath: values.docs ?? 'docs' });
            return 0;
        }
        case 'check': {
            const { values, positionals } = parseArgs({
                args: argv.slice(1), allowPositionals: true,
                options: { docs: { type: 'string' } },
            });
            return checkProject({ projectPath: positionals[0] ?? process.cwd(), docsPath: values.docs ?? 'docs' });
        }
        case 'export': {
            const { values, positionals } = parseArgs({
                args: argv.slice(1), allowPositionals: true,
                options: { history: { type: 'boolean' } },
            });
            process.stdout.write(exportPacket({ projectPath: positionals[0] ?? process.cwd(), history: values.history ?? false }) + '\n');
            return 0;
        }
        case 'prompt': {
            const { positionals } = parseArgs({ args: argv.slice(1), allowPositionals: true, options: {} });
            const name = positionals[0];
            if (!name) {
                for (const { name: n, description } of listPrompts()) {
                    console.log(`${n.padEnd(16)} ${description}`);
                }
                return 0;
            }
            const text = getPrompt(name);
            if (text === null) {
                throw new Error(`Unknown prompt '${name}'. Run \`npx contextspine prompt\` for the list.`);
            }
            process.stdout.write(text + '\n');
            return 0;
        }
        case 'profile': {
            console.log(ensureProfile());
            return 0;
        }
        default:
            process.stderr.write(`Unknown command '${command}'.\n\n${HELP}`);
            return 1;
    }
}
