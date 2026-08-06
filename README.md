# Cassandra

> *She always told the truth. Now she has a UI.*

**Cassandra** is an adversarial evaluation tool. It tests a prompt against its governing spec and the failure modes production LLM applications reliably run into, finding the ways it will fail before your users do.

Part of the [Lorae](https://github.com/joshkenitzer-ops/lorae) toolkit.

---

## What it does

You write a prompt against a spec. Cassandra tries to break both.

It runs a structured adversarial evaluation against your prompt or spec, checking seven fixed dimensions:

- **Logic Gaps**
- **Hallucination Risk**
- **Ambiguity Traps**
- **Scope Creep**
- **Edge Case Blindspots**
- **Instruction Conflicts**
- **Output Format Risk**

Each dimension is scored critical, high, medium, low, or pass, with a specific finding and a recommended fix for anything that isn't clean. Input under 30 words returns `INSUFFICIENT_INPUT` rather than fabricated findings, and the overall result carries a one-sentence summary and a 0-100 score.

---

## Live Demo

[cassandra-app-theta.vercel.app](https://cassandra-app-theta.vercel.app)

## Status

**v0.1**: live and deployed.

- 154 passing tests (Jest)
- Core evaluation logic complete
- Deployed via Vercel at cassandra-app-theta.vercel.app

---

## Structure

```
cassandra/
├── cassandra.jsx                    # Core evaluation logic and UI
├── api/evaluate.js                  # Vercel serverless function
├── cassandra.test.js                # Unit tests
├── cassandra.integration.test.js    # Integration tests
├── vercel.json                      # Deployment config
└── README.md
```

---

## Roadmap

- [ ] CLI (`cassandra evaluate <prompt>`)
- [x] Vercel web UI
- [ ] Severity rubric documentation
- [ ] Document-type awareness: today every input runs through the same seven dimensions; planned is inferring the document's purpose and adopting the review persona it needs
- [ ] A dedicated spec-failure-mode taxonomy, drawn from IEEE requirements engineering research: Absence, Incompleteness, Contradiction, Premature Definition, Silent Constraint Drop, Scope Drift

---

## Philosophy

Most prompt failures are discoverable before anyone uses the prompt, and most spec failures are discoverable before anyone builds against it. Ambiguous instructions, inputs the prompt wasn't designed for, logic gaps, injection surfaces, requirements a prompt only half-satisfies: none of it is a mystery. It's a bug sitting in plain sight, findable with the right evaluation. Cassandra exists to find it first, testing a prompt against the failure modes that reliably wreck production LLM applications and against the spec it was written to satisfy, so nothing ships on the strength of one read-through by the person who wrote it.

---

## Part of Lorae

| Tool | Description |
|------|-------------|
| **Cassandra** | Prompt and spec red-teaming, live |
| [Iris](https://github.com/joshkenitzer-ops/iris) | Resume and cover letter tailoring, live in private beta |
| [Vulcan](https://github.com/joshkenitzer-ops) | Prompt engineering on the FORGE methodology |
| [Janus](https://github.com/joshkenitzer-ops/janus) | Session context management |
| [Thoth](https://github.com/joshkenitzer-ops) | Feedback intelligence layer |
| [Ma'at](https://github.com/joshkenitzer-ops) | Automated code review |

---

*[Josh Kenitzer](https://github.com/joshkenitzer-ops) · Staff Learning Designer, Pedagogy Lead, AI Education Researcher*
