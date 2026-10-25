# Prompts for any coding agent

These are ordinary prompts, not registered slash commands. Use them in any tool
that can access the project files. For a chat-only tool, attach or paste a context
packet first. Replace any task description with the actual task you want done.
Initialized agents are instructed to checkpoint automatically after meaningful
work and before final replies. The checkpoint prompt below is a fallback, not
something you need to send after every task.

## Resume

```text
Resume this project using its persistent context. Read .context/project.md,
.context/preferences.md, and .context/state.md; the rules are already in your
instruction file. Verify the saved state against the current working tree.
Briefly tell me the objective, what is unfinished, and the next useful action,
then continue the current task. Read active files once per fresh session and
linked notes only as needed. Skip full onboarding for an ordinary task.
```

## First project session

```text
Onboard this project into its persistent context workflow. Inspect existing
instructions, docs, source entry points, and working changes. Fill in
.context/project.md with evidence-backed purpose, structure, conventions, and
exact setup and validation commands. Label anything unverified. Establish the
current task and observable completion criteria, then update .context/state.md.
Ask only for material information you cannot discover from the project.
Keep project.md under 200 words; link existing detailed guides instead of
duplicating them, and list them under "When to read" with a trigger for each.
```

## Idea pipeline

Run `npx contextspine idea` first; it creates the documents below in `docs/`. The flow is
problem screening → possible solution → deep search → metaprompt → build
documents. Unlike `.context/`, these documents have no word budget: they must be
detailed enough to build from. Each still keeps one home per fact.

### 1. Idea intake: screen the problem and choose a solution

```text
Start the idea pipeline for this project. Read docs/IDEA.md. Interview me about
the idea one question at a time until you can screen the problem against five
tests:
- Real: evidence that people have this problem now, not only in theory.
- Large enough: how many people or how often, with a source or a labeled estimate.
- Significant: what the problem costs them in time, money, risk, or frustration.
- Relevant: fits my goals and skills, and matters to the target users today.
- Urgent: why now, and what happens if nobody solves it.
For each test record a verdict (pass, weak, or fail), the evidence, and your
confidence. If any test fails, stop and tell me, suggest how to reframe the
problem, and do not continue to solutions unless I say so.
Then propose two to four possible solutions with trade-offs, recommend one, and
record my choice and the reason. List the open questions that deep search must
answer. Label assumptions. Update docs/IDEA.md and checkpoint .context/state.md.
```

### 2a. Deep search by the agent

```text
Run deep search for this project. Read docs/IDEA.md, especially the open
questions. Use web search and prefer primary sources. Cover existing solutions
and competitors, evidence about the target users, market size, technical options
and constraints, legal or compliance requirements if any, and risks. For each
finding record the claim, source URL, publication date, access date, and
confidence, and separate fact from inference. Write the findings to
docs/RESEARCH.md. If the evidence changes a screening verdict or the chosen
solution, update docs/IDEA.md and tell me what changed.
```

### 2b. Deep search in ChatGPT or another research tool

```text
Prepare an external deep-research brief. Read docs/IDEA.md and write a
self-contained prompt that I can paste into ChatGPT deep research; that tool
cannot see this project. Include the problem, target users, chosen solution,
the open questions, and the required output: findings with source URLs and
dates, confidence, fact separated from inference, and a closing summary of what
supports or contradicts the idea. Save the brief in docs/RESEARCH.md under
"External brief" and show it to me.
```

After the research tool finishes, paste its answer under "External results" in
docs/RESEARCH.md and send:

```text
I pasted external research into docs/RESEARCH.md under "External results".
Normalize it into the findings format, keep every source URL, and mark claims
without a source as unverified. If you have web access, spot-check the claims
that the solution depends on. Note conflicts with earlier findings. If the
evidence changes a screening verdict or the chosen solution, update
docs/IDEA.md and tell me what changed.
```

### 3. Metaprompt: propagate to the build documents

```text
Propagate the idea into the build documents. Read docs/IDEA.md and
docs/RESEARCH.md fully, plus .context/project.md and the existing source if the
project already has code. Write docs/PRD.md, docs/DSD.md, docs/SDD.md,
docs/QAD.md, and docs/BUILD.md in that order, following each file's sections.
Each document builds on the earlier ones; reread PRD.md before writing each.
These documents have no word budget. Make them complete and specific enough
that another engineer or agent could build the product without asking. Still
keep one home per fact: state each requirement once in PRD.md and refer to it
by ID everywhere else.
- PRD: problem summary linked to IDEA.md, target users and their jobs, goals and
  non-goals, scope, numbered requirements (R1, R2, ...; functional and
  non-functional) each with priority and acceptance criteria, success metrics,
  assumptions, and open questions.
- DSD: design principles; tokens for color, type, spacing, radius, elevation,
  and motion; components with their states; layout and responsive rules;
  accessibility (target WCAG 2.2 AA unless PRD.md says otherwise); content and
  voice. Tie each part to R#. If the product has no UI, replace the visual
  sections with interface conventions (CLI output, API style, error messages)
  and say so.
- SDD: architecture overview with a Mermaid diagram, components and their
  responsibilities, data model, interfaces and APIs, key flows, technology
  choices with alternatives and reasons, security, privacy, performance,
  scalability, observability, and failure handling. Map components to R#.
  Also record consequential choices in .context/decisions.md.
- QAD: test strategy (unit, integration, E2E, manual, non-functional),
  environments and test data, test cases T1, T2, ... each naming the R# it
  verifies and its pass criteria, entry and exit criteria, defect severity
  levels, and a coverage table that gives every R# at least one test.
- BUILD: phases and milestones M1, M2, ... in dependency order, each with its
  goal, the R# it delivers, tasks, deliverables, exit criteria that reference
  T#, risks, and status (planned, in progress, done). Start with the smallest
  end-to-end slice.
Ground claims in RESEARCH.md with links. Label assumptions and open questions
instead of inventing facts. Ask me only if a gap blocks a whole document. When
done, run `npx contextspine check` if available, set .context/state.md to the first BUILD
milestone, and summarize the gaps and open questions.
```

For a chat-only tool, attach the context packet, `docs/IDEA.md`,
`docs/RESEARCH.md`, and the five empty documents, then ask it to return each
document in full for you to save.

## Optional checkpoint before an early interruption or tool switch

```text
Save a checkpoint using .context/protocol.md. Update .context/state.md with the
current objective, completed and remaining work, relevant files, actual checks
and results, blockers, and the next concrete action. Preserve useful decisions
and discoveries in their dedicated files and link them from project.md's "When
to read" list. Keep the state under 120 words. Move
detail into linked history; preserve unfinished work. If you cannot write files,
return the exact updated state
and additional entries for me to save. Do not claim that files were saved.
```

## Record a reusable preference

```text
Treat the preference I just stated as reusable. Record its exact meaning, scope,
date, and source in .context/preferences.md. Also update ~/.contextspine/profile.md
(the central profile shown by `npx contextspine profile`)
if it is available and writable; otherwise tell me the central update needed.
Keep one-off task constraints in project context. Do not invent broader preferences.
```

## Review context for drift

```text
Review the context relevant to our current task against the repository. Reverify
old assumptions, remove duplicates, mark superseded decisions, and update broken
links or obsolete commands using evidence. Preserve useful rationale and
unfinished work. Tell me which material corrections you made and what remains
unverified. Do not turn guesses into facts.
```
