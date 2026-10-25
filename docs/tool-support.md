# Tool adapters

Verified against official documentation on 2026-10-11. These adapters all route
to the same `.context/` files; they do not keep separate project histories.

| Tool | Adapter created at project root | Mechanism |
| --- | --- | --- |
| Pi | `AGENTS.override.md` | First matching instruction file; directs agent to read team `AGENTS.md` too |
| claude-kiro | `CLAUDE.local.md` | The user's Claude Code/Kiro launcher; local instructions load alongside team instructions |
| Codex | `AGENTS.override.md` | Takes precedence in this directory; directs agent to read team `AGENTS.md` too |
| Claude Code | `CLAUDE.local.md` | Personal project instructions |
| Cursor | `.cursor/rules/persistent-context.mdc` | Rule with `alwaysApply: true` |
| GitHub Copilot | `.github/copilot-instructions.md` | Repository custom instructions in supported agent/chat surfaces |

`init` defaults to Pi, claude-kiro, and Codex, which produces the AGENTS and
CLAUDE files. Claude, Cursor, and Copilot are optional `--tools` selections.
Pi/Codex share one adapter. All selected adapters and `.context/` are Git-ignored
by default. `--shared` uses `AGENTS.md`/`CLAUDE.md` instead. A project uses one
mode: Claude Code loads `CLAUDE.md` and `CLAUDE.local.md` together, so the
initializer rejects mixing modes and `npx contextspine check` reports it. Claude Code also
follows `@AGENTS.md` imports; the checker warns when both files carry the section.

Each adapter embeds the rules from `.context/rules.md` in a generated
`workflow:v2` section, so they load with the tool's instruction file.
`npx contextspine init --sync` regenerates that section; customized text outside
the markers is preserved. This is
instruction-based enforcement; actual adherence still depends on the agent.

The adapters tell the agent to read the context files. A Markdown link or path
alone does not guarantee that another file is loaded. Tools, versions, modes,
settings, and organization policy can affect whether instructions apply. Code
completion is not a reliable way to maintain a multi-file project checkpoint.
Use a file-capable agent/chat mode and verify the first resume.

An isolated 2026-10-11 trial with an earlier version observed actual context
reads and saved checkpoints in Pi, claude-kiro, and Codex: Kiro resumed Pi's
task, and Codex corrected stale memory and followed a new objective. That is one
tested configuration per tool, not a guarantee for every mode or future version.
Private adapter selection was checked against the Pi resource loader and current
Codex/Claude documentation; the private adapters and automatic checkpoint wording
have not had a separate behavioral trial.

## First-run verification

Open a new session in the project root after initialization and send the resume
prompt in `prompts.md`. Check that the agent can state the saved objective and
next action accurately. After meaningful work, inspect `.context/state.md` on disk
to confirm it was updated without a save request. The checkpoint prompt is a
fallback if the agent misses a save. If the tool cannot read or write repository files,
export a packet instead; save its returned updates yourself.

Existing team instructions keep their contents in private mode. The initializer
appends the generated section to local adapters once. An existing Cursor file at the exact adapter path without the
marker is preserved and needs a manual merge so its frontmatter is not changed.
Existing local overrides, nested instructions, contradictory guidance,
or disabled custom instructions can affect discovery; resolve those cases using
the tool's documented rules. Only `--sync` updates an existing generated section.

## Sources

- [Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Pi sessions and context](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sessions.md)
- [Claude Code project memory](https://code.claude.com/docs/en/memory)
- [Cursor rules](https://cursor.com/docs/rules)
- [Copilot repository custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)

Other tools can use the same files through their own supported instruction entry
point, or use the exported packet. The Markdown context is portable; automatic
loading is specific to each tool. contextspine changes no global AI tool
settings and installs no hooks.
