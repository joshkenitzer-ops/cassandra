# Cassandra

> *She always told the truth. Now she has a UI.*

**Cassandra** is a prompt red-teaming tool. It finds the ways your prompt will fail before your users do.

Part of the [Lorae](https://github.com/joshkenitzer-ops/lorae) toolkit.

---

## What it does

You write a prompt. Cassandra tries to break it.

It runs a structured adversarial evaluation against your prompt, checking for:

- **Ambiguity**: instructions that can be read more than one way
- **Edge case failure**: inputs your prompt wasn't designed for
- **Boundary violations**: where the prompt under- or over-constrains the model
- **Prompt injection surface**: where user input could redirect behavior
- **Output instability**: where small input variations produce large output swings
- **Scope creep**: where the model is likely to go beyond what you asked
- **Minimum viability**: inputs too short or underspecified to be acted on (< 30 words returns `INSUFFICIENT_INPUT`)

Each finding is returned with a severity rating and a recommended fix.

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
- [ ] Structured evaluation against Vulcan-authored specs, not standalone prompts alone

---

## Philosophy

Most prompt failures are discoverable before anyone uses the prompt. Ambiguous instructions, inputs the prompt wasn't designed for, logic gaps, injection surfaces: these aren't unpredictable. They're findable with the right evaluation. Cassandra exists to run that evaluation systematically, testing a prompt both against the failure modes that reliably show up in production LLM applications and against the spec it was written to satisfy, so nothing ships on the strength of one read-through by the person who wrote it.

---

## Part of Lorae

| Tool | Description |
|------|-------------|
| **Cassandra** | Prompt red-teaming, live |
| [Iris](https://github.com/joshkenitzer-ops/iris) | Resume and cover letter tailoring, live in private beta |
| [Vulcan](https://github.com/joshkenitzer-ops) | Prompt engineering on the FORGE methodology |
| [Janus](https://github.com/joshkenitzer-ops/janus) | Session context management |
| [Thoth](https://github.com/joshkenitzer-ops) | Feedback intelligence layer |
| [Ma'at](https://github.com/joshkenitzer-ops) | Automated code review |

---

*[Josh Kenitzer](https://github.com/joshkenitzer-ops) · Staff Learning Designer, Pedagogy Lead, AI Education Researcher*
