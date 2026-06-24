import { useState, useRef, useEffect } from "react";

// CASSANDRA v0.1 — Lore
// Self-red-teamed and patched. First versioned release.
const SYSTEM_PROMPT = `You are CASSANDRA v0.1, a prompt red-teaming system built by Lore. Your job is to stress-test AI prompts for vulnerabilities, weaknesses, and failure modes.

MINIMUM VIABILITY CHECK: If the input prompt is fewer than 30 words or too vague to meaningfully evaluate, do not fabricate findings. Instead return: {"error": "INSUFFICIENT_INPUT", "message": "Prompt is too short or vague to red-team meaningfully. Provide a substantive prompt with clear instructions."}.

If the prompt being analyzed is itself a red-teaming or evaluation prompt, note this in your summary and flag any circular evaluation risks explicitly under the Logic Gaps dimension.

Evaluate across exactly these 7 dimensions. Do not provide analysis outside them.

SEVERITY RUBRIC — apply consistently:
- CRITICAL: The flaw will cause incorrect, harmful, or completely unpredictable output in normal use.
- HIGH: The flaw will likely degrade output quality or produce unreliable results in common scenarios.
- MEDIUM: The flaw may cause inconsistent results in edge cases or specific conditions.
- LOW: A minor weakness that rarely affects output but is worth noting.
- PASS: No meaningful vulnerability detected in this dimension.

A "real" vulnerability is one that would cause a different or worse output if triggered. If you cannot construct a realistic scenario where the flaw produces a bad result, do not report it. Do not pad findings.

Return ONLY valid JSON in this exact structure — no preamble, no explanation, no markdown:

{
  "version": "0.1",
  "summary": "One sentence overall assessment",
  "score": <number 0-100, where 100 is a prompt with no meaningful vulnerabilities>,
  "recursive": <true if the analyzed prompt is itself an evaluation or red-teaming prompt, false otherwise>,
  "dimensions": [
    {
      "id": "logic",
      "name": "Logic Gaps",
      "severity": "critical|high|medium|low|pass",
      "finding": "Specific finding with a concrete failure scenario, or 'No issues detected'",
      "fix": "Specific actionable recommendation, or null if pass"
    },
    {
      "id": "hallucination",
      "name": "Hallucination Risk",
      "severity": "critical|high|medium|low|pass",
      "finding": "Specific finding with a concrete failure scenario, or 'No issues detected'",
      "fix": "Specific actionable recommendation, or null if pass"
    },
    {
      "id": "ambiguity",
      "name": "Ambiguity Traps",
      "severity": "critical|high|medium|low|pass",
      "finding": "Specific finding with a concrete failure scenario, or 'No issues detected'",
      "fix": "Specific actionable recommendation, or null if pass"
    },
    {
      "id": "scope",
      "name": "Scope Creep",
      "severity": "critical|high|medium|low|pass",
      "finding": "Specific finding with a concrete failure scenario, or 'No issues detected'",
      "fix": "Specific actionable recommendation, or null if pass"
    },
    {
      "id": "edge",
      "name": "Edge Case Blindspots",
      "severity": "critical|high|medium|low|pass",
      "finding": "Specific finding with a concrete failure scenario, or 'No issues detected'",
      "fix": "Specific actionable recommendation, or null if pass"
    },
    {
      "id": "conflict",
      "name": "Instruction Conflicts",
      "severity": "critical|high|medium|low|pass",
      "finding": "Specific finding with a concrete failure scenario, or 'No issues detected'",
      "fix": "Specific actionable recommendation, or null if pass"
    },
    {
      "id": "output",
      "name": "Output Format Risk",
      "severity": "critical|high|medium|low|pass",
      "finding": "Specific finding with a concrete failure scenario, or 'No issues detected'",
      "fix": "Specific actionable recommendation, or null if pass"
    }
  ]
}`;

const SEVERITY_CONFIG = {
  critical: { color: "#ff2d55", bg: "rgba(255,45,85,0.08)", label: "CRITICAL", glow: "0 0 12px rgba(255,45,85,0.4)" },
  high: { color: "#ff9f0a", bg: "rgba(255,159,10,0.08)", label: "HIGH", glow: "0 0 12px rgba(255,159,10,0.3)" },
  medium: { color: "#ffd60a", bg: "rgba(255,214,10,0.08)", label: "MEDIUM", glow: "0 0 12px rgba(255,214,10,0.2)" },
  low: { color: "#30d158", bg: "rgba(48,209,88,0.08)", label: "LOW", glow: "0 0 12px rgba(48,209,88,0.2)" },
  pass: { color: "#0a84ff", bg: "rgba(10,132,255,0.08)", label: "PASS", glow: "0 0 12px rgba(10,132,255,0.2)" },
};

function ScoreRing({ score }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#30d158" : score >= 60 ? "#ffd60a" : score >= 40 ? "#ff9f0a" : "#ff2d55";

  return (
    <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
      <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1), stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center"
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>SCORE</span>
      </div>
    </div>
  );
}

function ScanLine() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      overflow: "hidden", pointerEvents: "none", borderRadius: "inherit"
    }}>
      <div style={{
        position: "absolute", left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(10,132,255,0.6), transparent)",
        animation: "scan 3s linear infinite",
      }} />
      <style>{`@keyframes scan { 0% { top: 0% } 100% { top: 100% } }`}</style>
    </div>
  );
}

function DimensionCard({ dim, index }) {
  const cfg = SEVERITY_CONFIG[dim.severity];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 120);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.color}22`,
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 8,
      padding: "16px 20px",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
      boxShadow: dim.severity !== "pass" ? cfg.glow : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: cfg.color, fontFamily: "'Space Mono', monospace",
          padding: "2px 8px", border: `1px solid ${cfg.color}44`,
          borderRadius: 3,
        }}>{cfg.label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: 0.3 }}>
          {dim.name}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 0", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
        {dim.finding}
      </p>
      {dim.fix && (
        <div style={{
          marginTop: 10, padding: "10px 12px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 6, borderLeft: "2px solid rgba(255,255,255,0.1)"
        }}>
          <span style={{ fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>FIX → </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{dim.fix}</span>
        </div>
      )}
    </div>
  );
}

export default function PromptRedTeam() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("idle"); // idle | scanning | done | error
  const [result, setResult] = useState(null);
  const [dots, setDots] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (status !== "scanning") return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);
    return () => clearInterval(t);
  }, [status]);

  async function runScan() {
    if (!prompt.trim() || status === "scanning") return;
    setStatus("scanning");
    setResult(null);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Analyze this prompt for vulnerabilities:\n\n${prompt}` }],
        }),
      });

      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.error) {
        setStatus("error");
        setResult({ errorMessage: parsed.message });
        return;
      }
      setResult(parsed);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  const criticalCount = result?.dimensions?.filter(d => d.severity === "critical").length || 0;
  const issueCount = result?.dimensions?.filter(d => d.severity !== "pass").length || 0;

  return (
    <div style={{
      minHeight: "100vh", background: "#080c12",
      fontFamily: "'DM Sans', sans-serif",
      color: "white",
      backgroundImage: `
        radial-gradient(ellipse at 20% 0%, rgba(10,132,255,0.07) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 100%, rgba(255,45,85,0.05) 0%, transparent 60%)
      `,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #0a84ff, #ff2d55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, boxShadow: "0 0 20px rgba(10,132,255,0.3)",
          }}>⚡</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.9)" }}>CASSANDRA</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>PROMPT RED-TEAM SYSTEM  •  v0.1</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["LOGIC", "HALLUCINATION", "AMBIGUITY", "SCOPE", "EDGE", "CONFLICT", "OUTPUT"].map(label => (
            <span key={label} style={{
              fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.2)",
              fontFamily: "'Space Mono', monospace", padding: "3px 6px",
              border: "1px solid rgba(255,255,255,0.07)", borderRadius: 3,
            }}>{label}</span>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 40px" }}>

        {/* Input area */}
        <div style={{
          position: "relative",
          background: "rgba(255,255,255,0.02)",
          border: status === "scanning"
            ? "1px solid rgba(10,132,255,0.5)"
            : "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          overflow: "hidden",
          transition: "border-color 0.3s ease",
          boxShadow: status === "scanning" ? "0 0 30px rgba(10,132,255,0.1)" : "none",
        }}>
          {status === "scanning" && <ScanLine />}

          <div style={{
            padding: "14px 20px 0",
            display: "flex", alignItems: "center", gap: 8,
            borderBottom: "1px solid rgba(255,255,255,0.04)"
          }}>
            <span style={{ fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>
              PROMPT INPUT
            </span>
            {prompt.length > 0 && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: "'Space Mono', monospace", marginLeft: "auto" }}>
                {prompt.length} chars
              </span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Paste your prompt here for red-team analysis..."
            style={{
              width: "100%", minHeight: 180, background: "transparent",
              border: "none", outline: "none", resize: "vertical",
              color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.7,
              padding: "16px 20px", boxSizing: "border-box",
              fontFamily: "'DM Sans', sans-serif",
              caretColor: "#0a84ff",
            }}
          />

          <div style={{
            padding: "12px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>
              {status === "scanning" ? `SCANNING${dots}` : status === "done" ? "SCAN COMPLETE" : status === "error" ? "SCAN FAILED" : "READY"}
            </span>
            <button
              onClick={runScan}
              disabled={!prompt.trim() || status === "scanning"}
              style={{
                padding: "10px 28px",
                background: status === "scanning"
                  ? "rgba(10,132,255,0.1)"
                  : "linear-gradient(135deg, rgba(10,132,255,0.9), rgba(10,132,255,0.7))",
                border: "1px solid rgba(10,132,255,0.4)",
                borderRadius: 8, color: "white",
                fontSize: 12, fontWeight: 600, letterSpacing: 1.5,
                fontFamily: "'Space Mono', monospace",
                cursor: !prompt.trim() || status === "scanning" ? "not-allowed" : "pointer",
                opacity: !prompt.trim() || status === "scanning" ? 0.5 : 1,
                transition: "all 0.2s ease",
                boxShadow: status !== "scanning" && prompt.trim() ? "0 0 20px rgba(10,132,255,0.3)" : "none",
              }}
            >
              {status === "scanning" ? "SCANNING" : "RUN SCAN"}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div style={{ marginTop: 32 }}>

            {/* Summary bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 20,
              padding: "20px 24px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, marginBottom: 20,
            }}>
              <ScoreRing score={result.score} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>
                  ASSESSMENT SUMMARY
                </div>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                  {result.summary}
                </p>
                {result.recursive && (
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", border: "1px solid rgba(255,214,10,0.3)", borderRadius: 4, background: "rgba(255,214,10,0.06)" }}>
                    <span style={{ fontSize: 9, letterSpacing: 1.5, color: "#ffd60a", fontFamily: "'Space Mono', monospace" }}>⚠ RECURSIVE SCAN — This prompt is itself an evaluation system. Circular evaluation risks apply.</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                {criticalCount > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#ff2d55", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{criticalCount}</div>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>CRITICAL</div>
                  </div>
                )}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: issueCount > 0 ? "#ff9f0a" : "#30d158", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{issueCount}</div>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>ISSUES</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0a84ff", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{result.dimensions.filter(d => d.severity === "pass").length}</div>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>PASSED</div>
                </div>
              </div>
            </div>

            {/* Dimension cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.dimensions
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3, pass: 4 };
                  return order[a.severity] - order[b.severity];
                })
                .map((dim, i) => (
                  <DimensionCard key={dim.id} dim={dim} index={i} />
                ))}
            </div>

            {/* Re-scan nudge */}
            <div style={{
              marginTop: 24, padding: "14px 20px",
              border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: 8, textAlign: "center",
            }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                REVISE YOUR PROMPT ABOVE AND RUN SCAN AGAIN TO ITERATE
              </span>
            </div>

          </div>
        )}

        {status === "error" && (
          <div style={{
            marginTop: 24, padding: "20px", textAlign: "center",
            border: "1px solid rgba(255,45,85,0.2)", borderRadius: 12,
            background: "rgba(255,45,85,0.05)",
          }}>
            <div style={{ fontSize: 13, color: "#ff2d55", fontFamily: "'Space Mono', monospace" }}>
              {result?.errorMessage || "SCAN FAILED — CHECK CONSOLE FOR DETAILS"}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
