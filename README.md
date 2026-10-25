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

**1. Install once** (macOS, Linux, or Windows):

```bash
npm install -g contextspine
contextspine help
```

Run the same install command later to update.

**2. Set up a project:**

```bash
cd your-project
contextspine init
```

**3. Start your agent.** Run `contextspine prompt onboard` — it prints a prompt
— and paste that text into your agent. On later sessions use `resume` instead
of `onboard`. Every `prompt <name>` command prints text to paste into your agent.

Copy it straight to the clipboard:

```bash
contextspine prompt onboard | pbcopy                        # macOS
contextspine prompt onboard | clip                          # Windows
contextspine prompt onboard | xclip -selection clipboard    # Linux (or wl-copy)
```

Agents that can run commands can also do it themselves: tell the agent
`Run contextspine prompt onboard and follow it.`

**Without installing:** put `npx` in front of any command, for example
`npx contextspine init`. npx fetches the latest version each time, which suits a
quick try or a machine where you can't install global packages. The rest of this
guide writes commands without `npx`.

If `contextspine` is "not found" after a global install, open a new terminal.
If it is still missing, the folder printed by `npm prefix -g` (plus `/bin` on
macOS and Linux) is not on your PATH; installing Node with a version manager
such as nvm or fnm avoids this.

## How a session works

`init` writes a small `context-spine` section into each selected agent's
instruction file. That section contains your project rules and the startup
routine: the agent reads `.context/project.md`, `.context/preferences.md`, and
`.context/state.md` once per session, opens other files only when the "When to
read" list calls for them, and saves a checkpoint after meaningful progress and
before its final reply.

You do almost nothing: start sessions, work, and let the agent checkpoint. If a
session might end early, paste `contextspine prompt checkpoint` to force a save.

## Daily workflow

- **Starting work:** open the project, send the `resume` prompt. The agent
  reports the objective, what is unfinished, and the next action.
- **Switching tools:** open the same folder in the other tool, start a new
  session, send `resume` again. All adapters share the same `.context/`.
- **Resuming after a break:** same as starting — the checkpoint carries you.
- **Recording a preference:** state it, then send `contextspine prompt preference`.
- **Reviewing for drift:** after a long break or a phase change, send
  `contextspine prompt drift`.
- **Chat-only tool (no file access):** run `contextspine export > context.md`,
  attach that file, and ask for revised state back to save yourself.

## Start from an idea

An opt-in pipeline takes a project from a raw idea to build-ready documents:

```text
Problem screening -> Possible solution -> Deep search -> Metaprompt -> PRD, DSD, SDD, QAD, BUILD
```

After `init`, enable it in the project root:

```bash
contextspine idea
```

This creates seven documents in `docs/` (use `--docs planning/spec` for another
location) and links them from `.context/project.md`. Then run the prompts in
order:

1. `contextspine prompt idea` — interviews you and screens the problem against
   five tests: Real, Large enough, Significant, Relevant, Urgent. Then you pick
   one of two to four solutions. Produces `docs/IDEA.md`.
2. Deep search, either route:
   - `contextspine prompt research` — the agent searches the web itself.
   - `contextspine prompt research-brief`, paste the brief into ChatGPT deep
     research, paste the answer into `docs/RESEARCH.md`, then send
     `contextspine prompt research-import` to normalize it.
3. `contextspine prompt propagate` — one metaprompt turns IDEA.md and
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
other documents. `contextspine check` warns about undefined IDs and requirements
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

- Edit `.context/rules.md`, then run `contextspine init --sync` with the same
  options to regenerate the adapter sections. Reruns never overwrite your other
  files.
- `contextspine profile` shows (and creates) your global profile at
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

`contextspine prompt <name>` prints ready-to-paste text: `resume`, `onboard`,
`idea`, `research`, `research-brief`, `research-import`, `propagate`,
`checkpoint`, `preference`, `drift`. The full source lives in
[prompts.md](prompts.md).

## Recommended skills

contextspine decides *what* to build and keeps every session on track. Skills
teach the agent *how* to do one kind of work well. These five fit the pipeline
stages. Each is maintained by its author; contextspine does not bundle them.

Install them with the [skills CLI](https://github.com/vercel-labs/skills) (or
follow each repository's own instructions), then restart your agent:

```bash
npx skills@latest add mattpocock/skills --skill grill-me
npx skills@latest add mattpocock/skills --skill grilling
npx skills@latest add mattpocock/skills --skill tdd
npx skills@latest add mattpocock/skills --skill diagnosing-bugs
npx skills@latest add 23jmo/jmo-skills --skill better-ui
npx skills@latest add 23jmo/jmo-skills --skill ste
```

| Skill | Pipeline stage | Source |
| --- | --- | --- |
| grill-me | Idea intake, before `propagate` | [mattpocock/skills](https://github.com/mattpocock/skills) |
| tdd | Building each `BUILD.md` milestone | [mattpocock/skills](https://github.com/mattpocock/skills) |
| diagnosing-bugs | Any time something breaks or slows down | [mattpocock/skills](https://github.com/mattpocock/skills) |
| better-ui | UI work against `DSD.md` | [23jmo/jmo-skills](https://github.com/23jmo/jmo-skills) |
| ste | Writing and reviewing the `docs/` documents | [23jmo/jmo-skills](https://github.com/23jmo/jmo-skills) |

### [grill-me](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md)

A relentless interview that sharpens a plan. The agent maps your decisions as a
tree, asks every question it can answer now in numbered rounds with its
recommended answer, looks up facts itself, and stops only when nothing is left
silently assumed. `grill-me` hands off to the
[grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md)
skill, so install both.

- **When:** after `prompt idea` records a chosen solution, and before
  `prompt propagate`. Weak screening verdicts and vague requirements surface
  here instead of in the PRD.
- **How:** type `/grill-me` (it runs only when you call it), then for example:
  "Grill me on the chosen solution in docs/IDEA.md."

### [tdd](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md)

Test-driven development as a red-green loop: one failing test, the minimum code
to pass it, repeat. Tests check behavior through public interfaces, and the
agent agrees the test seams with you before writing any test.

- **When:** building a milestone. The `QAD.md` cases (`T#`) named in the
  milestone's exit criteria become the tests to write first.
- **How:** "Use tdd to build M1 from docs/BUILD.md. Start with T1."

### [diagnosing-bugs](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md)

A disciplined loop for hard bugs and performance regressions. The agent first
builds a tight pass/fail signal (a failing test, script, or replay), then
narrows the cause, fixes it, and keeps the signal as a regression test. It
redacts secrets from anything it shows.

- **When:** a milestone test fails for no obvious reason, something works
  locally but not in production, or a page gets slow.
- **How:** "Diagnose this: <symptom>." Record the root cause in
  `.context/knowledge.md` so later sessions don't rediscover it.

### [better-ui](https://github.com/23jmo/jmo-skills/tree/main/skills/better-ui)

Exact values for interface polish: nested border radii, optical alignment,
shadows instead of depth borders, image outlines, press feedback, and when not
to animate. It keeps your existing component library and tokens. Written by
[Jakub Krehel](https://github.com/jakubkrehel/skills/tree/main/skills/better-ui)
and packaged in jmo-skills.

- **When:** after a milestone's UI works, as a polish pass against `DSD.md`.
- **How:** "Use better-ui to polish the dashboard. Keep the DSD.md tokens."

### [ste](https://github.com/23jmo/jmo-skills/tree/main/skills/ste)

Clear technical English: one idea per sentence, defined terms and acronyms,
active voice, steps in order, and facts kept separate from assumptions.

- **When:** reviewing the pipeline documents before you share them, or when an
  agent's explanation is hard to follow.
- **How:** "Use ste to rewrite docs/PRD.md for a new teammate. Keep every R# and
  acceptance criterion unchanged."

## Sample use case: from idea to first milestone

Maya runs a small tutoring business. Parents keep asking her for weekly progress
updates, and she writes each one by hand. She wants a web app that turns session
notes into a parent summary.

1. **Set up the project.**
   ```bash
   mkdir tutor-notes && cd tutor-notes && git init
   contextspine init
   contextspine idea
   ```
2. **Screen the problem.** She runs `contextspine prompt idea` and pastes
   the printed prompt into her agent. The interview scores the five tests. *Real* and *Significant* pass:
   she spends about four hours a week on updates. *Large enough* is weak, so the
   agent records it as an open question for research. She picks "notes in,
   summary out" over a full tutoring platform.
3. **Stress-test it.** `/grill-me` asks whether parents need a login, what
   happens to notes about minors, and whether summaries go out automatically.
   Her answers land in `docs/IDEA.md`; the minors question becomes a privacy
   requirement.
4. **Research.** She sends the `research-brief` prompt, pastes the brief the
   agent writes into ChatGPT deep research, pastes the answer into
   `docs/RESEARCH.md`, and sends `research-import`. Two competitors exist but target large schools, and the
   *Large enough* verdict now has a source.
5. **Write the build documents.** The `propagate` prompt writes
   `PRD.md` (for example, R3: "a parent receives one summary per week"),
   `DSD.md`, `SDD.md`, `QAD.md` (T5 verifies R3), and `BUILD.md` with M1 as the
   smallest end-to-end slice: paste notes, generate one summary, email it.
   `contextspine check` confirms every requirement has a test. She asks the
   agent to use **ste** on `PRD.md` before sharing it with a tutor friend.
6. **Build M1.** "Use tdd to build M1 from docs/BUILD.md." The agent writes T1
   first, makes it pass, and moves through the milestone's tests.
   `.context/state.md` records "M1 in progress, T1–T3 passing".
7. **Fix a bug.** The summary email sends twice. "Diagnose this: weekly email
   sends twice." The agent reproduces it with a failing test, finds a retry
   that ignores the first success, fixes it, and records the cause in
   `.context/knowledge.md`.
8. **Polish.** "Use better-ui to polish the summary page. Keep the DSD.md
   tokens."
9. **Next day, different tool.** She opens the folder in another agent and
   sends the `resume` prompt. It reports "M1 done; next M2, the
   parent login" and continues from there.

## Acknowledgements

Thanks to my mentor, **Carlos Jerico Dela Torre**, for helping and guiding me in
creating the idea-to-build pipeline.

## License

[MIT](LICENSE). Source and issues: https://github.com/fr-anz/contextspine
