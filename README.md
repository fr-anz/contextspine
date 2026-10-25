# contextspine

AI coding agents forget everything between sessions and tools. contextspine keeps
project memory in plain Markdown files — rules, state, decisions — and gives
every agent the same instructions. It also includes an opt-in pipeline that
takes a raw idea through screening and research into build-ready documents
(PRD, design system, system design, QA plan, build guide).

## Requirements

- Node.js 20 or newer. Works on macOS, Linux, and Windows.
- Git is optional. Without it, private files are ignored through `.gitignore`.

## Quick start

```bash
cd your-project
npx contextspine init
```

Then run `npx contextspine prompt onboard` — it prints a prompt — and paste that
text into your agent. On later sessions use `resume` instead of `onboard`.
Every `prompt <name>` command prints text to paste into your agent.

Copy it straight to the clipboard:

```bash
npx contextspine prompt onboard | pbcopy                        # macOS
npx contextspine prompt onboard | clip                          # Windows
npx contextspine prompt onboard | xclip -selection clipboard    # Linux (or wl-copy)
```

Agents that can run commands can also do it themselves: tell the agent
`Run npx contextspine prompt onboard and follow it.`

Install once globally to drop `npx`: `npm i -g contextspine`, then `contextspine init`.

## How a session works

`init` writes a small `context-spine` section into each selected agent's
instruction file. That section contains your project rules and the startup
routine: the agent reads `.context/project.md`, `.context/preferences.md`, and
`.context/state.md` once per session, opens other files only when the "When to
read" list calls for them, and saves a checkpoint after meaningful progress and
before its final reply.

You do almost nothing: start sessions, work, and let the agent checkpoint. If a
session might end early, paste `npx contextspine prompt checkpoint` to force a save.

## Daily workflow

- **Starting work:** open the project, send the `resume` prompt. The agent
  reports the objective, what is unfinished, and the next action.
- **Switching tools:** open the same folder in the other tool, start a new
  session, send `resume` again. All adapters share the same `.context/`.
- **Resuming after a break:** same as starting — the checkpoint carries you.
- **Recording a preference:** state it, then send `npx contextspine prompt preference`.
- **Reviewing for drift:** after a long break or a phase change, send
  `npx contextspine prompt drift`.
- **Chat-only tool (no file access):** run `npx contextspine export > context.md`,
  attach that file, and ask for revised state back to save yourself.

## Start from an idea

An opt-in pipeline takes a project from a raw idea to build-ready documents:

```text
Problem screening -> Possible solution -> Deep search -> Metaprompt -> PRD, DSD, SDD, QAD, BUILD
```

After `init`, enable it in the project root:

```bash
npx contextspine idea
```

This creates seven documents in `docs/` (use `--docs planning/spec` for another
location) and links them from `.context/project.md`. Then run the prompts in
order:

1. `npx contextspine prompt idea` — interviews you and screens the problem against
   five tests: Real, Large enough, Significant, Relevant, Urgent. Then you pick
   one of two to four solutions. Produces `docs/IDEA.md`.
2. Deep search, either route:
   - `npx contextspine prompt research` — the agent searches the web itself.
   - `npx contextspine prompt research-brief`, paste the brief into ChatGPT deep
     research, paste the answer into `docs/RESEARCH.md`, then send
     `npx contextspine prompt research-import` to normalize it.
3. `npx contextspine prompt propagate` — one metaprompt turns IDEA.md and
   RESEARCH.md into the five build documents.

| Document | Holds |
| --- | --- |
| `docs/IDEA.md` | Input: problem, five-test screening, chosen solution, open questions |
| `docs/RESEARCH.md` | Input: sourced findings, competitors, risks, external brief/results |
| `docs/PRD.md` | Requirements `R#` with priorities and acceptance criteria |
| `docs/DSD.md` | Design system: principles, tokens, components, accessibility |
| `docs/SDD.md` | System design: architecture, data, APIs, tech choices, R# mapping |
| `docs/QAD.md` | Test plan: cases `T#`, entry/exit criteria, R# coverage |
| `docs/BUILD.md` | Phases and milestones `M#` delivering R#, verified by T# |

Requirements live once in `PRD.md` as `R1`, `R2`, ... and are cited by ID in the
other documents. `npx contextspine check` warns about undefined IDs and requirements
without a test. `state.md` names the current `BUILD` milestone, so each session
resumes where the build left off.

Unlike `.context/` (private by default), `docs/` is meant to be committed and
shared, and these documents have no word budget — write them detailed enough to
build from.

## What goes where

| File | Keep here |
| --- | --- |
| `~/.contextspine/profile.md` | Your explicit preferences, reused across projects |
| `.context/preferences.md` | A project-local snapshot of that profile |
| `.context/rules.md` | Rules for every run; embedded into each adapter by `init` |
| `.context/project.md` | Purpose, constraints, commands, and the "When to read" list |
| `.context/state.md` | Active goal, completed work, checks, next action |
| `.context/decisions.md` | Consequential choices, reasons, evidence, replacements |
| `.context/knowledge.md` | Useful discoveries with sources and verification dates |
| `.context/protocol.md` | How to checkpoint, where each fact goes, word budgets |
| `docs/IDEA.md` … `docs/BUILD.md` | Opt-in idea pipeline documents; committed and shared |

## Private or shared

Default is **private**: `init` writes `AGENTS.override.md` and
`CLAUDE.local.md` and ignores `.context/` plus those files through
`.git/info/exclude` (or `.gitignore` before Git exists). Your memory stays local
to each checkout.

`--shared` writes `AGENTS.md` and `CLAUDE.md` instead — commit them so the whole
team gets the same context.

Use one mode per project; `init` refuses to mix them. `docs/` is shareable in
either mode.

## Choosing tools

`--tools` selects which agent instruction files get the workflow section.
Default: `pi,claude-kiro,codex`.

| Tool | Private file | Shared file |
| --- | --- | --- |
| `pi`, `codex` | `AGENTS.override.md` | `AGENTS.md` |
| `claude-kiro`, `claude` | `CLAUDE.local.md` | `CLAUDE.md` |
| `cursor` | `.cursor/rules/persistent-context.mdc` | same |
| `copilot` | `.github/copilot-instructions.md` | same |

## Customizing

- Edit `.context/rules.md`, then run `npx contextspine init --sync` with the same
  options to regenerate the adapter sections. Reruns never overwrite your other
  files.
- `npx contextspine profile` shows (and creates) your global profile at
  `~/.contextspine/profile.md`. New projects copy it into `.context/preferences.md`.

## Command reference

| Command | Purpose |
| --- | --- |
| `contextspine init [path]` | Create `.context/` and agent files. `--shared`, `--tools a,b`, `--sync`, `--name X` |
| `contextspine idea [path]` | Create the seven `docs/` pipeline documents. `--docs DIR` |
| `contextspine check [path]` | Health report; exit 1 on failure. `--docs DIR` |
| `contextspine export [path]` | Print a context packet for chat-only tools. `--history` |
| `contextspine prompt [name]` | List prompts or print one to paste into an agent |
| `contextspine profile` | Show/create your shared profile |
| `contextspine help` | Help and quick start |

## Limits

These files are instructions, not enforcement: an agent can miss a checkpoint,
and abrupt termination loses progress since the last save. Word budgets are
guidance, not token limits. Verify that each tool loads its instructions once
per setup — ask the agent in a new session "What are this project's rules?" and
it should quote `.context/rules.md`. `docs/` files are committed, so keep
secrets out of them too.

## Prompts

`npx contextspine prompt <name>` prints ready-to-paste text: `resume`, `onboard`,
`idea`, `research`, `research-brief`, `research-import`, `propagate`,
`checkpoint`, `preference`, `drift`. The full source lives in
[prompts.md](prompts.md).

## Recommended skills

contextspine works well alongside these agent skills. Each is maintained by its
author. Install it with the [skills CLI](https://github.com/vercel-labs/skills) or
follow the instructions in its repository.

| Skill | Use it for | Source |
| --- | --- | --- |
| [grill-me](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md) | Stress-testing the idea and chosen solution during idea intake | [mattpocock/skills](https://github.com/mattpocock/skills) |
| [tdd](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md) | Building each `BUILD.md` milestone test-first against the `QAD.md` cases | [mattpocock/skills](https://github.com/mattpocock/skills) |
| [diagnosing-bugs](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md) | A disciplined loop for hard bugs and performance regressions | [mattpocock/skills](https://github.com/mattpocock/skills) |
| [better-ui](https://github.com/23jmo/jmo-skills/tree/main/skills/better-ui) | Polishing surfaces, icons, and motion to match `DSD.md` (by [Jakub Krehel](https://github.com/jakubkrehel/skills/tree/main/skills/better-ui)) | [23jmo/jmo-skills](https://github.com/23jmo/jmo-skills) |
| [ste](https://github.com/23jmo/jmo-skills/tree/main/skills/ste) | Writing the pipeline documents in clear, precise technical English | [23jmo/jmo-skills](https://github.com/23jmo/jmo-skills) |

```bash
npx skills@latest add mattpocock/skills --skill grill-me
npx skills@latest add mattpocock/skills --skill tdd
npx skills@latest add mattpocock/skills --skill diagnosing-bugs
npx skills@latest add 23jmo/jmo-skills --skill better-ui
npx skills@latest add 23jmo/jmo-skills --skill ste
```

## Acknowledgements

Thanks to my mentor, **Carlos Jerico Dela Torre**, for helping and guiding me in
creating the idea-to-build pipeline.

## License

[MIT](LICENSE). Source and issues: https://github.com/fr-anz/contextspine
