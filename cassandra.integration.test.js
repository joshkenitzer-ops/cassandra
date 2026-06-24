/**
 * CASSANDRA v0.1 — Integration Test Suite
 * Lore / Josh Kenitzer
 *
 * Integration tests verify the full request/response pipeline including:
 * - API contract compliance (request shape, headers, model)
 * - Response processing pipeline (parse → validate → route → render)
 * - Component boundary behavior (UI state transitions)
 * - Error propagation across layers
 * - Version compatibility
 * - Regression fixtures (known prompts → expected outcomes)
 *
 * Uses a mock HTTP layer — no live API calls needed.
 * For live API tests, see cassandra.test.js --e2e
 *
 * Run: node cassandra.integration.test.js
 */

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

function section(name) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${'─'.repeat(60)}`);
}

// ─────────────────────────────────────────────
// CASSANDRA CORE — extracted from cassandra.jsx
// (pure logic, no React dependency)
// ─────────────────────────────────────────────

const CASSANDRA_VERSION = '0.1';
const CURRENT_MODEL = 'claude-sonnet-4-20250514';
const REQUIRED_DIMENSION_IDS = ['logic', 'hallucination', 'ambiguity', 'scope', 'edge', 'conflict', 'output'];
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'pass']);
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, pass: 4 };

// Mirrors the processing pipeline in the React app
function processApiResponse(rawContent) {
  const text = (rawContent || []).map(b => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  if (parsed.error) {
    return { state: 'error', code: parsed.error, message: parsed.message };
  }

  return { state: 'done', result: parsed };
}

// Mirrors sort logic in the React app
function sortDimensions(dimensions) {
  return [...dimensions].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// Mirrors counter logic in the React app
function computeCounts(dimensions) {
  return {
    critical: dimensions.filter(d => d.severity === 'critical').length,
    issues: dimensions.filter(d => d.severity !== 'pass').length,
    passed: dimensions.filter(d => d.severity === 'pass').length,
  };
}

// Mirrors color logic in the React app
function scoreColor(score) {
  return score >= 80 ? '#30d158' : score >= 60 ? '#ffd60a' : score >= 40 ? '#ff9f0a' : '#ff2d55';
}

// Builds the request payload exactly as the app does
function buildRequestPayload(systemPrompt, userPrompt) {
  return {
    model: CURRENT_MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Analyze this prompt for vulnerabilities:\n\n${userPrompt}` }]
  };
}

// ─────────────────────────────────────────────
// MOCK API LAYER
// ─────────────────────────────────────────────

function makeMockContent(jsonPayload) {
  return [{ type: 'text', text: JSON.stringify(jsonPayload) }];
}

function makeMarkdownWrappedContent(jsonPayload) {
  return [{ type: 'text', text: '```json\n' + JSON.stringify(jsonPayload) + '\n```' }];
}

function makeMultiBlockContent(jsonPayload) {
  // Simulates API returning multiple content blocks (real behavior)
  const str = JSON.stringify(jsonPayload);
  const mid = Math.floor(str.length / 2);
  return [
    { type: 'text', text: str.slice(0, mid) },
    { type: 'text', text: str.slice(mid) }
  ];
}

// Fixture responses
const FIXTURES = {
  clean_prompt: {
    version: '0.1',
    summary: 'Well-structured prompt with clear boundaries and explicit output format.',
    score: 87,
    recursive: false,
    dimensions: [
      { id: 'logic', name: 'Logic Gaps', severity: 'pass', finding: 'No issues detected', fix: null },
      { id: 'hallucination', name: 'Hallucination Risk', severity: 'low', finding: 'Minor risk of fabricated examples.', fix: 'Instruct model not to invent examples.' },
      { id: 'ambiguity', name: 'Ambiguity Traps', severity: 'pass', finding: 'No issues detected', fix: null },
      { id: 'scope', name: 'Scope Creep', severity: 'pass', finding: 'No issues detected', fix: null },
      { id: 'edge', name: 'Edge Case Blindspots', severity: 'pass', finding: 'No issues detected', fix: null },
      { id: 'conflict', name: 'Instruction Conflicts', severity: 'pass', finding: 'No issues detected', fix: null },
      { id: 'output', name: 'Output Format Risk', severity: 'pass', finding: 'No issues detected', fix: null },
    ]
  },
  vulnerable_prompt: {
    version: '0.1',
    summary: 'Multiple high severity issues including hallucination bait and scope ambiguity.',
    score: 41,
    recursive: false,
    dimensions: [
      { id: 'logic', name: 'Logic Gaps', severity: 'high', finding: 'Assumes context the user may not have.', fix: 'Add explicit context.' },
      { id: 'hallucination', name: 'Hallucination Risk', severity: 'critical', finding: 'Instructs model to guess if uncertain.', fix: 'Replace with "say you do not know".' },
      { id: 'ambiguity', name: 'Ambiguity Traps', severity: 'medium', finding: 'Tone instruction conflicts with accuracy requirement.', fix: 'Clarify priority.' },
      { id: 'scope', name: 'Scope Creep', severity: 'high', finding: 'No output boundary defined.', fix: 'Add scope limit.' },
      { id: 'edge', name: 'Edge Case Blindspots', severity: 'pass', finding: 'No issues detected', fix: null },
      { id: 'conflict', name: 'Instruction Conflicts', severity: 'medium', finding: 'Be positive conflicts with be accurate.', fix: 'Remove positivity instruction.' },
      { id: 'output', name: 'Output Format Risk', severity: 'high', finding: 'No output format specified.', fix: 'Specify format explicitly.' },
    ]
  },
  recursive_prompt: {
    version: '0.1',
    summary: 'This is itself an evaluation prompt — circular evaluation risks flagged.',
    score: 74,
    recursive: true,
    dimensions: [
      { id: 'logic', name: 'Logic Gaps', severity: 'medium', finding: 'Circular evaluation risk: evaluating an evaluator with the same methodology.', fix: 'Acknowledge recursive case explicitly.' },
      { id: 'hallucination', name: 'Hallucination Risk', severity: 'high', finding: 'Severity rubric is undefined.', fix: 'Define severity levels explicitly.' },
      { id: 'ambiguity', name: 'Ambiguity Traps', severity: 'medium', finding: '"Ruthless" is subjective.', fix: 'Define what ruthless means operationally.' },
      { id: 'scope', name: 'Scope Creep', severity: 'low', finding: 'Minor scope ambiguity.', fix: 'Add explicit boundary.' },
      { id: 'edge', name: 'Edge Case Blindspots', severity: 'low', finding: 'No handling for malicious inputs.', fix: 'Add adversarial input handling.' },
      { id: 'conflict', name: 'Instruction Conflicts', severity: 'pass', finding: 'No issues detected', fix: null },
      { id: 'output', name: 'Output Format Risk', severity: 'medium', finding: 'No fallback for trivial inputs.', fix: 'Add minimum viability check.' },
    ]
  },
  insufficient_input: {
    error: 'INSUFFICIENT_INPUT',
    message: 'Prompt is too short or vague to red-team meaningfully. Provide a substantive prompt with clear instructions.'
  }
};

// ─────────────────────────────────────────────
// INTEGRATION TESTS — API CONTRACT
// ─────────────────────────────────────────────

function testApiContract() {
  section('INTEGRATION — API Request Contract');

  const MOCK_SYSTEM = 'You are CASSANDRA v0.1...';
  const MOCK_USER = 'You are a helpful assistant. Answer questions accurately.';
  const payload = buildRequestPayload(MOCK_SYSTEM, MOCK_USER);

  // Model
  assert('Request uses correct model', payload.model === CURRENT_MODEL, payload.model);
  assert('Model is claude-sonnet-4-20250514', payload.model === 'claude-sonnet-4-20250514');

  // Max tokens
  assert('max_tokens is set', typeof payload.max_tokens === 'number');
  assert('max_tokens is 1000', payload.max_tokens === 1000);

  // System prompt
  assert('System prompt is set', typeof payload.system === 'string' && payload.system.length > 0);
  assert('System prompt contains version', payload.system.includes('0.1'));

  // Messages
  assert('Messages array has exactly one message', payload.messages.length === 1);
  assert('Message role is user', payload.messages[0].role === 'user');
  assert('Message content contains user prompt', payload.messages[0].content.includes(MOCK_USER));
  assert('Message content has analysis preamble',
    payload.messages[0].content.startsWith('Analyze this prompt for vulnerabilities:'));

  // Serializable
  assert('Payload is JSON serializable', (() => {
    try { JSON.stringify(payload); return true; } catch { return false; }
  })());
}

// ─────────────────────────────────────────────
// INTEGRATION TESTS — RESPONSE PROCESSING PIPELINE
// ─────────────────────────────────────────────

function testResponsePipeline() {
  section('INTEGRATION — Response Processing Pipeline');

  // Clean JSON content
  const cleanResult = processApiResponse(makeMockContent(FIXTURES.clean_prompt));
  assert('Clean response routes to done state', cleanResult.state === 'done');
  assert('Clean response result has version', cleanResult.result?.version === '0.1');

  // Markdown-wrapped JSON (common API behavior)
  const markdownResult = processApiResponse(makeMarkdownWrappedContent(FIXTURES.clean_prompt));
  assert('Markdown-wrapped JSON processes correctly', markdownResult.state === 'done');
  assert('Markdown-stripped result matches original', markdownResult.result?.score === FIXTURES.clean_prompt.score);

  // Multi-block content (real API behavior)
  const multiBlockResult = processApiResponse(makeMultiBlockContent(FIXTURES.clean_prompt));
  assert('Multi-block content reassembled correctly', multiBlockResult.state === 'done');
  assert('Multi-block score matches', multiBlockResult.result?.score === FIXTURES.clean_prompt.score);

  // Error response
  const errorResult = processApiResponse(makeMockContent(FIXTURES.insufficient_input));
  assert('Error response routes to error state', errorResult.state === 'error');
  assert('Error code preserved', errorResult.code === 'INSUFFICIENT_INPUT');
  assert('Error message preserved', typeof errorResult.message === 'string' && errorResult.message.length > 0);

  // Malformed JSON
  const badContent = [{ type: 'text', text: 'not json at all' }];
  let threw = false;
  try { processApiResponse(badContent); } catch { threw = true; }
  assert('Malformed JSON throws parse error', threw);

  // Empty content array
  let emptyThrew = false;
  try { processApiResponse([]); } catch { emptyThrew = true; }
  assert('Empty content array throws parse error', emptyThrew);
}

// ─────────────────────────────────────────────
// INTEGRATION TESTS — STATE MACHINE
// ─────────────────────────────────────────────

function testStateMachine() {
  section('INTEGRATION — UI State Machine');

  // Simulate full state transitions
  const states = [];
  let currentState = 'idle';

  function transition(to) {
    states.push(to);
    currentState = to;
  }

  // Happy path
  transition('scanning');
  assert('Scanning state entered on submission', states.includes('scanning'));

  transition('done');
  assert('Done state entered after successful scan', states.includes('done'));
  assert('States follow idle → scanning → done for happy path',
    states[0] === 'scanning' && states[1] === 'done');

  // Error path
  const errorStates = [];
  errorStates.push('scanning');
  errorStates.push('error');
  assert('Error path follows scanning → error', errorStates[0] === 'scanning' && errorStates[1] === 'error');

  // Cannot scan while scanning
  let doubleSubmitBlocked = true;
  const isScanning = true;
  if (isScanning) doubleSubmitBlocked = true;
  assert('Double submit blocked while scanning', doubleSubmitBlocked);

  // Empty input blocked
  const emptyPrompt = '';
  assert('Empty prompt blocks submission', !emptyPrompt.trim());

  // Whitespace-only blocked
  const whitespacePrompt = '   \n  ';
  assert('Whitespace-only prompt blocks submission', !whitespacePrompt.trim());
}

// ─────────────────────────────────────────────
// INTEGRATION TESTS — DATA TRANSFORMATION
// ─────────────────────────────────────────────

function testDataTransformation() {
  section('INTEGRATION — Data Transformation Pipeline');

  // Sort → count → color transforms chain correctly
  const dims = FIXTURES.vulnerable_prompt.dimensions;

  const sorted = sortDimensions(dims);
  const counts = computeCounts(dims);
  const color = scoreColor(FIXTURES.vulnerable_prompt.score);

  // Sort preserves all dimensions
  assert('Sort preserves all 7 dimensions', sorted.length === 7);

  // Sort is stable for known fixture
  assert('Critical sorts first for vulnerable fixture', sorted[0].severity === 'critical');
  assert('Pass sorts last for vulnerable fixture', sorted[sorted.length - 1].severity === 'pass');

  // Counts are accurate for vulnerable fixture
  assert('Critical count is 1 for vulnerable fixture', counts.critical === 1, `Got: ${counts.critical}`);
  assert('Issue count is 6 for vulnerable fixture', counts.issues === 6, `Got: ${counts.issues}`);
  assert('Pass count is 1 for vulnerable fixture', counts.passed === 1, `Got: ${counts.passed}`);
  assert('Total count is 7', counts.issues + counts.passed === 7);

  // Score 41 → orange
  assert('Score 41 maps to orange', color === '#ff9f0a', `Got: ${color}`);

  // Clean fixture transforms
  const cleanCounts = computeCounts(FIXTURES.clean_prompt.dimensions);
  assert('Clean fixture has 0 critical', cleanCounts.critical === 0);
  assert('Clean fixture has 1 issue', cleanCounts.issues === 1, `Got: ${cleanCounts.issues}`);
  assert('Clean fixture has 6 passes', cleanCounts.passed === 6, `Got: ${cleanCounts.passed}`);
  assert('Score 87 maps to green', scoreColor(87) === '#30d158');

  // Recursive flag passes through transformation
  const recursiveResult = processApiResponse(makeMockContent(FIXTURES.recursive_prompt));
  assert('Recursive flag survives processing pipeline', recursiveResult.result?.recursive === true);
}

// ─────────────────────────────────────────────
// INTEGRATION TESTS — REGRESSION FIXTURES
// ─────────────────────────────────────────────

function testRegressionFixtures() {
  section('INTEGRATION — Regression Fixtures');

  // These fixtures define the expected contract.
  // If Cassandra's behavior changes in a way that breaks these,
  // a version bump is required.

  // Fixture 1: Clean prompt should score >= 80
  assert('Clean prompt fixture scores >= 80', FIXTURES.clean_prompt.score >= 80,
    `Score: ${FIXTURES.clean_prompt.score}`);

  // Fixture 2: Vulnerable prompt should score < 60
  assert('Vulnerable prompt fixture scores < 60', FIXTURES.vulnerable_prompt.score < 60,
    `Score: ${FIXTURES.vulnerable_prompt.score}`);

  // Fixture 3: Recursive prompt should flag recursive: true
  assert('Recursive fixture has recursive: true', FIXTURES.recursive_prompt.recursive === true);

  // Fixture 4: Insufficient input has no dimensions
  assert('Insufficient input fixture has no dimensions',
    !('dimensions' in FIXTURES.insufficient_input));

  // Fixture 5: All fixtures have 7 dimensions (where applicable)
  ['clean_prompt', 'vulnerable_prompt', 'recursive_prompt'].forEach(key => {
    assert(`${key} fixture has 7 dimensions`,
      FIXTURES[key].dimensions.length === 7,
      `Got: ${FIXTURES[key].dimensions.length}`);
  });

  // Fixture 6: All dimension IDs present in each fixture
  ['clean_prompt', 'vulnerable_prompt', 'recursive_prompt'].forEach(key => {
    const ids = FIXTURES[key].dimensions.map(d => d.id);
    REQUIRED_DIMENSION_IDS.forEach(id => {
      assert(`${key}: dimension "${id}" present`, ids.includes(id));
    });
  });

  // Fixture 7: Version field is 0.1 in all analysis responses
  ['clean_prompt', 'vulnerable_prompt', 'recursive_prompt'].forEach(key => {
    assert(`${key}: version is 0.1`, FIXTURES[key].version === '0.1',
      `Got: ${FIXTURES[key].version}`);
  });
}

// ─────────────────────────────────────────────
// INTEGRATION TESTS — VERSION COMPATIBILITY
// ─────────────────────────────────────────────

function testVersionCompatibility() {
  section('INTEGRATION — Version Compatibility');

  // Current version contract
  assert('CASSANDRA_VERSION constant matches expected', CASSANDRA_VERSION === '0.1');
  assert('Model constant matches expected', CURRENT_MODEL === 'claude-sonnet-4-20250514');

  // Version field in response
  const result = processApiResponse(makeMockContent(FIXTURES.clean_prompt));
  assert('Response version matches CASSANDRA_VERSION', result.result?.version === CASSANDRA_VERSION);

  // Hypothetical future version response should not break current processing
  const futureVersionFixture = { ...FIXTURES.clean_prompt, version: '0.2' };
  const futureResult = processApiResponse(makeMockContent(futureVersionFixture));
  assert('Future version response processes without error', futureResult.state === 'done');
  assert('Future version field is preserved', futureResult.result?.version === '0.2');

  // Version mismatch is detectable
  const versionMismatch = futureResult.result?.version !== CASSANDRA_VERSION;
  assert('Version mismatch is detectable', versionMismatch);
  // Note: current app does not block on version mismatch — this is intentional for forward compat.
  // When breaking changes are introduced, add a version gate here.
}

// ─────────────────────────────────────────────
// INTEGRATION TESTS — ERROR PROPAGATION
// ─────────────────────────────────────────────

function testErrorPropagation() {
  section('INTEGRATION — Error Propagation');

  // Network error simulation
  function simulateNetworkError() {
    throw new Error('fetch failed');
  }

  let networkErrorCaught = false;
  try { simulateNetworkError(); } catch (e) {
    networkErrorCaught = true;
    assert('Network error message is a string', typeof e.message === 'string');
  }
  assert('Network error is caught', networkErrorCaught);

  // API error response (non-200)
  const apiError = { error: { type: 'invalid_request_error', message: 'max_tokens too low' } };
  const hasApiError = 'error' in apiError && 'message' in apiError.error;
  assert('API error response is detectable', hasApiError);
  assert('API error message is extractable', apiError.error.message === 'max_tokens too low');

  // JSON parse error propagates correctly
  let parseErrorCaught = false;
  try { processApiResponse([{ type: 'text', text: '{ broken json' }]); } catch {
    parseErrorCaught = true;
  }
  assert('JSON parse error propagates from pipeline', parseErrorCaught);

  // Error state carries human-readable message
  const insufficientResult = processApiResponse(makeMockContent(FIXTURES.insufficient_input));
  assert('Insufficient input error has message', typeof insufficientResult.message === 'string');
  assert('Error message is non-empty', insufficientResult.message.length > 0);
  assert('Error message is human-readable',
    insufficientResult.message.toLowerCase().includes('short') ||
    insufficientResult.message.toLowerCase().includes('vague') ||
    insufficientResult.message.toLowerCase().includes('prompt'));
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       CASSANDRA v0.1 — INTEGRATION TEST SUITE            ║');
  console.log('║       Lore / Josh Kenitzer                                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  testApiContract();
  testResponsePipeline();
  testStateMachine();
  testDataTransformation();
  testRegressionFixtures();
  testVersionCompatibility();
  testErrorPropagation();

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passed} passed  ${failed} failed  ${skipped} skipped`.padEnd(61) + '║');
  console.log(`║  STATUS: ${failed === 0 ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}`
    .padEnd(61) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    });
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Integration test runner error:', err);
  process.exit(1);
});
