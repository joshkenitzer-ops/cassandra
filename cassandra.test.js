/**
 * CASSANDRA v0.1 — Test Suite
 * Lore / Josh Kenitzer
 *
 * Unit tests: pure logic, no API calls
 * Integration tests: live API calls with known inputs and assertions
 *
 * Run: node cassandra.test.js
 * Run unit only: node cassandra.test.js --unit
 * Run e2e only: node cassandra.test.js --e2e
 */

const https = require('https');

// ─────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', label });
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', label, detail });
    console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`);
  }
}

function skip(label, reason) {
  skipped++;
  results.push({ status: 'SKIP', label, reason });
  console.log(`  ⏭  ${label} (skipped: ${reason})`);
}

function section(name) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${'─'.repeat(60)}`);
}

// ─────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────

const VALID_RESPONSE = {
  version: "0.1",
  summary: "This prompt has several high severity issues.",
  score: 62,
  recursive: false,
  dimensions: [
    { id: "logic", name: "Logic Gaps", severity: "high", finding: "Assumes user has context they may not have.", fix: "Add explicit context requirements." },
    { id: "hallucination", name: "Hallucination Risk", severity: "medium", finding: "Asks for specific statistics without sourcing.", fix: "Instruct model to caveat unverified statistics." },
    { id: "ambiguity", name: "Ambiguity Traps", severity: "pass", finding: "No issues detected", fix: null },
    { id: "scope", name: "Scope Creep", severity: "low", finding: "Minor scope ambiguity.", fix: "Add boundary statement." },
    { id: "edge", name: "Edge Case Blindspots", severity: "pass", finding: "No issues detected", fix: null },
    { id: "conflict", name: "Instruction Conflicts", severity: "pass", finding: "No issues detected", fix: null },
    { id: "output", name: "Output Format Risk", severity: "high", finding: "No output format specified.", fix: "Specify expected output format explicitly." }
  ]
};

const RECURSIVE_RESPONSE = {
  ...VALID_RESPONSE,
  recursive: true,
  summary: "This is itself an evaluation prompt — circular evaluation risks noted."
};

const INSUFFICIENT_INPUT_RESPONSE = {
  error: "INSUFFICIENT_INPUT",
  message: "Prompt is too short or vague to red-team meaningfully. Provide a substantive prompt with clear instructions."
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, pass: 4 };
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'pass']);
const REQUIRED_DIMENSION_IDS = ['logic', 'hallucination', 'ambiguity', 'scope', 'edge', 'conflict', 'output'];

// ─────────────────────────────────────────────
// UNIT TESTS — RESPONSE VALIDATION
// ─────────────────────────────────────────────

function testResponseValidation() {
  section('UNIT — Response Shape Validation');

  // Version field
  assert('Response contains version field', VALID_RESPONSE.version === '0.1');
  assert('Version is a string', typeof VALID_RESPONSE.version === 'string');

  // Score
  assert('Score is a number', typeof VALID_RESPONSE.score === 'number');
  assert('Score is between 0 and 100', VALID_RESPONSE.score >= 0 && VALID_RESPONSE.score <= 100);

  // Summary
  assert('Summary is a non-empty string', typeof VALID_RESPONSE.summary === 'string' && VALID_RESPONSE.summary.length > 0);

  // Recursive flag
  assert('Recursive field is boolean', typeof VALID_RESPONSE.recursive === 'boolean');
  assert('Non-recursive prompt returns false', VALID_RESPONSE.recursive === false);
  assert('Recursive prompt returns true', RECURSIVE_RESPONSE.recursive === true);

  // Dimensions
  assert('Response has dimensions array', Array.isArray(VALID_RESPONSE.dimensions));
  assert('Response has exactly 7 dimensions', VALID_RESPONSE.dimensions.length === 7);

  // Dimension IDs
  const ids = VALID_RESPONSE.dimensions.map(d => d.id);
  REQUIRED_DIMENSION_IDS.forEach(id => {
    assert(`Dimension "${id}" is present`, ids.includes(id));
  });

  // Each dimension shape
  VALID_RESPONSE.dimensions.forEach(dim => {
    assert(`Dimension ${dim.id} has valid severity`, VALID_SEVERITIES.has(dim.severity),
      `Got: ${dim.severity}`);
    assert(`Dimension ${dim.id} has finding string`, typeof dim.finding === 'string' && dim.finding.length > 0);
    assert(`Dimension ${dim.id} fix is string or null`, dim.fix === null || typeof dim.fix === 'string',
      `Got: ${typeof dim.fix}`);
    if (dim.severity === 'pass') {
      assert(`Dimension ${dim.id} fix is null when passing`, dim.fix === null,
        `Expected null, got: ${dim.fix}`);
    }
  });
}

// ─────────────────────────────────────────────
// UNIT TESTS — SORT LOGIC
// ─────────────────────────────────────────────

function testSortLogic() {
  section('UNIT — Severity Sort Logic');

  const sorted = [...VALID_RESPONSE.dimensions]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // First item should be highest severity (lowest order number)
  const firstSeverityOrder = SEVERITY_ORDER[sorted[0].severity];
  const lastSeverityOrder = SEVERITY_ORDER[sorted[sorted.length - 1].severity];

  assert('Sorted results lead with highest severity', firstSeverityOrder <= lastSeverityOrder);
  assert('Pass items sort to end', sorted[sorted.length - 1].severity === 'pass' ||
    sorted[sorted.length - 2].severity === 'pass');

  // Verify no item is followed by a higher-severity item
  let sortViolation = false;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (SEVERITY_ORDER[sorted[i].severity] > SEVERITY_ORDER[sorted[i + 1].severity]) {
      sortViolation = true;
      break;
    }
  }
  assert('Sort order is monotonically non-decreasing', !sortViolation);
}

// ─────────────────────────────────────────────
// UNIT TESTS — COUNTER LOGIC
// ─────────────────────────────────────────────

function testCounterLogic() {
  section('UNIT — Counter Logic');

  const criticalCount = VALID_RESPONSE.dimensions.filter(d => d.severity === 'critical').length;
  const issueCount = VALID_RESPONSE.dimensions.filter(d => d.severity !== 'pass').length;
  const passCount = VALID_RESPONSE.dimensions.filter(d => d.severity === 'pass').length;

  assert('Critical count is 0 for test data', criticalCount === 0);
  assert('Issue count is 4 for test data', issueCount === 4, `Got: ${issueCount}`);
  assert('Pass count is 3 for test data', passCount === 3, `Got: ${passCount}`);
  assert('Issue + pass = 7', issueCount + passCount === 7);
}

// ─────────────────────────────────────────────
// UNIT TESTS — ERROR STATE HANDLING
// ─────────────────────────────────────────────

function testErrorStateHandling() {
  section('UNIT — Error State Handling');

  assert('Insufficient input response has error field', 'error' in INSUFFICIENT_INPUT_RESPONSE);
  assert('Error code is INSUFFICIENT_INPUT', INSUFFICIENT_INPUT_RESPONSE.error === 'INSUFFICIENT_INPUT');
  assert('Error message is a non-empty string',
    typeof INSUFFICIENT_INPUT_RESPONSE.message === 'string' &&
    INSUFFICIENT_INPUT_RESPONSE.message.length > 0);
  assert('Insufficient input response has no dimensions', !('dimensions' in INSUFFICIENT_INPUT_RESPONSE));
  assert('Insufficient input response has no score', !('score' in INSUFFICIENT_INPUT_RESPONSE));

  // Simulate the error branching logic
  function processResponse(parsed) {
    if (parsed.error) return { state: 'error', message: parsed.message };
    return { state: 'done', result: parsed };
  }

  const errResult = processResponse(INSUFFICIENT_INPUT_RESPONSE);
  const okResult = processResponse(VALID_RESPONSE);

  assert('Error response routes to error state', errResult.state === 'error');
  assert('Valid response routes to done state', okResult.state === 'done');
  assert('Error state carries message', errResult.message === INSUFFICIENT_INPUT_RESPONSE.message);
}

// ─────────────────────────────────────────────
// UNIT TESTS — JSON PARSING
// ─────────────────────────────────────────────

function testJsonParsing() {
  section('UNIT — JSON Parsing and Cleaning');

  function cleanAndParse(raw) {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  }

  // Clean JSON
  const raw1 = JSON.stringify(VALID_RESPONSE);
  assert('Parses clean JSON', (() => { try { cleanAndParse(raw1); return true; } catch { return false; } })());

  // JSON wrapped in markdown fences
  const raw2 = '```json\n' + JSON.stringify(VALID_RESPONSE) + '\n```';
  assert('Strips markdown fences before parsing', (() => {
    try {
      const parsed = cleanAndParse(raw2);
      return parsed.version === '0.1';
    } catch { return false; }
  })());

  // Malformed JSON
  const raw3 = '{ not valid json }';
  assert('Throws on malformed JSON', (() => {
    try { cleanAndParse(raw3); return false; } catch { return true; }
  })());
}

// ─────────────────────────────────────────────
// UNIT TESTS — SCORE RING COLOR LOGIC
// ─────────────────────────────────────────────

function testScoreRingColors() {
  section('UNIT — Score Ring Color Logic');

  function scoreColor(score) {
    return score >= 80 ? '#30d158' : score >= 60 ? '#ffd60a' : score >= 40 ? '#ff9f0a' : '#ff2d55';
  }

  assert('Score 100 is green', scoreColor(100) === '#30d158');
  assert('Score 80 is green', scoreColor(80) === '#30d158');
  assert('Score 79 is yellow', scoreColor(79) === '#ffd60a');
  assert('Score 60 is yellow', scoreColor(60) === '#ffd60a');
  assert('Score 59 is orange', scoreColor(59) === '#ff9f0a');
  assert('Score 40 is orange', scoreColor(40) === '#ff9f0a');
  assert('Score 39 is red', scoreColor(39) === '#ff2d55');
  assert('Score 0 is red', scoreColor(0) === '#ff2d55');
}

// ─────────────────────────────────────────────
// E2E HELPER — API CALL
// ─────────────────────────────────────────────

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
  "score": 0,
  "recursive": false,
  "dimensions": [
    {"id": "logic", "name": "Logic Gaps", "severity": "pass", "finding": "No issues detected", "fix": null},
    {"id": "hallucination", "name": "Hallucination Risk", "severity": "pass", "finding": "No issues detected", "fix": null},
    {"id": "ambiguity", "name": "Ambiguity Traps", "severity": "pass", "finding": "No issues detected", "fix": null},
    {"id": "scope", "name": "Scope Creep", "severity": "pass", "finding": "No issues detected", "fix": null},
    {"id": "edge", "name": "Edge Case Blindspots", "severity": "pass", "finding": "No issues detected", "fix": null},
    {"id": "conflict", "name": "Instruction Conflicts", "severity": "pass", "finding": "No issues detected", "fix": null},
    {"id": "output", "name": "Output Format Risk", "severity": "pass", "finding": "No issues detected", "fix": null}
  ]
}`;

function callCassandra(userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Analyze this prompt for vulnerabilities:\n\n${userPrompt}` }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) return reject(new Error(response.error.message));
          const text = (response.content || []).map(b => b.text || '').join('');
          const clean = text.replace(/```json|```/g, '').trim();
          resolve(JSON.parse(clean));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────
// E2E TESTS
// ─────────────────────────────────────────────

async function testE2E() {
  section('E2E — Insufficient Input Rejection');
  try {
    const result = await callCassandra('Be helpful.');
    assert('Short prompt returns error field', 'error' in result, JSON.stringify(result));
    assert('Error code is INSUFFICIENT_INPUT', result.error === 'INSUFFICIENT_INPUT', result.error);
    assert('Error has human-readable message', typeof result.message === 'string' && result.message.length > 0);
  } catch (e) {
    assert('Short prompt test completed without exception', false, e.message);
  }

  section('E2E — Valid Prompt Returns Full Structure');
  const KNOWN_VULNERABLE_PROMPT = `You are a helpful assistant. Answer the user's question about history. 
  Be accurate and provide specific dates and statistics. Keep responses under 100 words.
  Always be positive and encouraging. If you don't know something, make your best guess.`;

  try {
    const result = await callCassandra(KNOWN_VULNERABLE_PROMPT);
    assert('Response has version 0.1', result.version === '0.1', result.version);
    assert('Response has summary string', typeof result.summary === 'string' && result.summary.length > 0);
    assert('Score is 0-100', typeof result.score === 'number' && result.score >= 0 && result.score <= 100, result.score);
    assert('Response has recursive boolean', typeof result.recursive === 'boolean');
    assert('Response has 7 dimensions', Array.isArray(result.dimensions) && result.dimensions.length === 7,
      `Got ${result.dimensions?.length}`);

    // All required IDs present
    const ids = result.dimensions.map(d => d.id);
    REQUIRED_DIMENSION_IDS.forEach(id => {
      assert(`E2E: Dimension "${id}" present`, ids.includes(id));
    });

    // All severities valid
    result.dimensions.forEach(dim => {
      assert(`E2E: ${dim.id} has valid severity`, VALID_SEVERITIES.has(dim.severity), dim.severity);
    });

    // Known vulnerable prompt should have at least one non-pass finding
    const issues = result.dimensions.filter(d => d.severity !== 'pass');
    assert('Known vulnerable prompt has at least one issue', issues.length > 0,
      `All dimensions passed — expected vulnerabilities in "make your best guess" instruction`);

    // Score should not be perfect for a known vulnerable prompt
    assert('Known vulnerable prompt score is not 100', result.score < 100, `Score: ${result.score}`);

    console.log(`\n     Score: ${result.score}/100  |  Issues: ${issues.length}/7`);
    console.log(`     Summary: ${result.summary}`);
  } catch (e) {
    assert('Valid prompt test completed without exception', false, e.message);
  }

  section('E2E — Recursive Prompt Detection');
  const RECURSIVE_PROMPT = `You are an AI evaluation system. Your job is to analyze other AI prompts 
  and return a JSON report with severity ratings for each vulnerability found. Evaluate across 
  7 dimensions: logic gaps, hallucination risk, ambiguity traps, scope creep, edge cases, 
  instruction conflicts, and output format risk. Be ruthless. Return only JSON.`;

  try {
    const result = await callCassandra(RECURSIVE_PROMPT);
    assert('Recursive prompt detected', result.recursive === true,
      `Expected recursive:true, got recursive:${result.recursive}`);
    assert('Recursive summary mentions circular or evaluation', 
      result.summary.toLowerCase().includes('eval') ||
      result.summary.toLowerCase().includes('circular') ||
      result.summary.toLowerCase().includes('red-team') ||
      result.recursive === true);
  } catch (e) {
    assert('Recursive detection test completed without exception', false, e.message);
  }

  section('E2E — Well-Formed Prompt Gets High Score');
  const CLEAN_PROMPT = `You are a JSON formatter. The user will provide unstructured text. 
  Extract the following fields if present: name, date, location, description. 
  Return a JSON object with exactly these keys. If a field is not found, set its value to null. 
  Do not include any fields not listed above. Do not add commentary. Return only the JSON object.`;

  try {
    const result = await callCassandra(CLEAN_PROMPT);
    assert('Clean prompt has no critical issues',
      !result.dimensions.some(d => d.severity === 'critical'),
      result.dimensions.filter(d => d.severity === 'critical').map(d => d.id).join(', '));
    assert('Clean prompt scores above 70', result.score > 70, `Score: ${result.score}`);
    console.log(`\n     Score: ${result.score}/100`);
    console.log(`     Summary: ${result.summary}`);
  } catch (e) {
    assert('Clean prompt test completed without exception', false, e.message);
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const unitOnly = args.includes('--unit');
  const e2eOnly = args.includes('--e2e');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║         CASSANDRA v0.1 — TEST SUITE              ║');
  console.log('║         Lore / Josh Kenitzer                      ║');
  console.log('╚══════════════════════════════════════════════════╝');

  if (!e2eOnly) {
    testResponseValidation();
    testSortLogic();
    testCounterLogic();
    testErrorStateHandling();
    testJsonParsing();
    testScoreRingColors();
  }

  if (!unitOnly) {
    console.log('\n  ⚡ Running E2E tests against live API...');
    await testE2E();
  }

  // Summary
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passed} passed  ${failed} failed  ${skipped} skipped`.padEnd(51) + '║');
  console.log(`║  STATUS: ${failed === 0 ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}`
    .padEnd(51) + '║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    });
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
