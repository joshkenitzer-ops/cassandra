[README.md](https://github.com/user-attachments/files/29300424/README.md)
# Cassandra

> *She always told the truth. Now she has a UI.*

**Cassandra** is a prompt red-teaming tool. It finds the ways your prompt will fail before your users do.

Part of the [Lore](https://github.com/joshkenitzer-ops/lore) toolkit.

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

## Status

**v0.1**: code and test suite only. Not yet runnable as a standalone tool.

- 154 passing tests (Jest)
- Core evaluation logic complete
- CLI and UI in development

---

## Structure

```
cassandra/
├── Cassandra.jsx                    # Core evaluation logic and UI
├── cassandra.test.js                # Unit tests
├── cassandra.integration.test.js    # Integration tests
└── README.md
```

---

## Roadmap

- [ ] CLI (`cassandra evaluate <prompt>`)
- [ ] Vercel web UI
- [ ] Severity rubric documentation
- [ ] Integration with Hermes pipeline

---

## Philosophy

Most prompt failures are discoverable before anyone uses the prompt. Ambiguous instructions, inputs the prompt wasn't designed for, logic gaps, injection surfaces: these aren't unpredictable. They're findable with the right evaluation. Cassandra exists to run that evaluation systematically, so that any prompt that ships has been tested against the failure modes that reliably show up in production LLM applications.

---

## Part of Lore

| Tool | Description |
|------|-------------|
| **Cassandra** | Prompt red-teaming |
| [Janus](https://github.com/joshkenitzer-ops/janus) | Session context management |
| [Hermes](https://github.com/joshkenitzer-ops/hermes) | Document pipeline |

---

*[Josh Kenitzer](https://github.com/joshkenitzer-ops) · Staff Learning Designer, Pedagogy Lead, AI Education Researcher*


Part of the [Lore](https://github.com/joshkenitzer-ops/lore) toolkit.

---
