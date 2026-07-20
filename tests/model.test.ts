import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ACTIVITY_VERSION,
  FORM_A,
  FORM_B,
  SCHEMA_VERSION,
  SESSION_TTL_MS,
  STORAGE_KEY,
  buildResponses,
  assessmentResultsVisible,
  createSession,
  csvSafeCell,
  deidentifiedRecord,
  deleteSession,
  exportCsv,
  loadSession,
  scoreResponses,
  webAuthnStatus,
  type StorageLike,
} from "../lib/authlab-model.ts";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const correctAnswers = (questions: typeof FORM_A | typeof FORM_B) => Object.fromEntries(questions.map((question) => [question.id, question.correctIndex]));

test("Form A and Form B score independently", () => {
  const a = buildResponses(FORM_A, correctAnswers(FORM_A));
  const b = buildResponses(FORM_B, correctAnswers(FORM_B));
  assert.equal(scoreResponses(a), 6);
  assert.equal(scoreResponses(b), 6);
  const wrongB = buildResponses(FORM_B, Object.fromEntries(FORM_B.map((question) => [question.id, (question.correctIndex + 1) % question.options.length])));
  assert.equal(scoreResponses(wrongB), 0);
});

test("submitting Form A does not reveal baseline answers or scores", () => {
  const session = createSession(0, "AL-TEST-0000");
  session.preTest = { formId: "A", submitted: true, confidenceSubjective: 3, responses: buildResponses(FORM_A, correctAnswers(FORM_A)) };
  assert.equal(assessmentResultsVisible(session), false);
  session.postTest = { formId: "B", submitted: true, confidenceSubjective: 3, responses: buildResponses(FORM_B, correctAnswers(FORM_B)) };
  assert.equal(assessmentResultsVisible(session), true);
});

test("parallel forms map to identical objectives but use different prompts and IDs", () => {
  assert.deepEqual(FORM_A.map((q) => q.learningObjectiveId), FORM_B.map((q) => q.learningObjectiveId));
  assert.equal(new Set([...FORM_A, ...FORM_B].map((q) => q.id)).size, 12);
  FORM_A.forEach((question, index) => assert.notEqual(question.prompt, FORM_B[index].prompt));
});

test("every post-test item has an answer, rationale, distractor explanation and objective", () => {
  for (const question of FORM_B) {
    assert.ok(question.options[question.correctIndex]);
    assert.ok(question.rationale.length > 30);
    assert.equal(question.distractorRationales.length, question.options.length);
    question.distractorRationales.forEach((text, index) => {
      if (index !== question.correctIndex) assert.ok(text.length > 10);
    });
    assert.match(question.learningObjectiveId, /^LO-0[1-6]$/);
  }
});

test("versioned record exports item, phishing and subjective-confidence evidence without timestamps", () => {
  const session = createSession(1_000_000, "AL-TEST-0001");
  session.preTest = { formId: "A", submitted: true, confidenceSubjective: 2, responses: buildResponses(FORM_A, correctAnswers(FORM_A)) };
  session.postTest = { formId: "B", submitted: true, confidenceSubjective: 4, responses: buildResponses(FORM_B, correctAnswers(FORM_B)) };
  session.phishingResponses = [{ scenarioId: "PH-01", selectedDecision: "legitimate", correct: true }];
  session.completedModules = [1, 2, 3, 4];
  const record = deidentifiedRecord(session, 1_000_000 + 13 * 60 * 1000);
  assert.equal(record.schema_version, SCHEMA_VERSION);
  assert.equal(record.activity_version, ACTIVITY_VERSION);
  assert.equal(record.duration_minutes_rounded, 15);
  assert.equal(record.pre_test.responses.length, 6);
  assert.equal(record.post_test.responses.length, 6);
  assert.equal(record.phishing_responses[0].scenarioId, "PH-01");
  assert.equal(record.pre_test.confidenceSubjective, 2);
  assert.equal(record.post_test.confidenceSubjective, 4);
  assert.doesNotMatch(JSON.stringify(record), /createdAtMs|expiresAtMs|started_at|exported_at/i);
});

test("CSV safe cells handle punctuation, Unicode, formula prefixes, empties and malformed values", () => {
  assert.equal(csvSafeCell("a,b"), '"a,b"');
  assert.equal(csvSafeCell('he said "hello"'), '"he said ""hello"""');
  assert.equal(csvSafeCell("line 1\nline 2"), '"line 1\nline 2"');
  assert.equal(csvSafeCell("password 🔐 key"), '"password 🔐 key"');
  assert.equal(csvSafeCell("=SUM(A1:A2)"), '"\'=SUM(A1:A2)"');
  assert.equal(csvSafeCell("   +cmd"), '"\'   +cmd"');
  assert.equal(csvSafeCell("\t-2"), '"\'\t-2"');
  assert.equal(csvSafeCell("@name"), '"\'@name"');
  assert.equal(csvSafeCell(""), '""');
  assert.equal(csvSafeCell(null), '""');
  assert.equal(csvSafeCell({ malformed: true }), '""');
});

test("CSV export uses long-form rows for every test item and phishing scenario", () => {
  const session = createSession(0, "AL-TEST-0002");
  session.preTest = { formId: "A", submitted: true, confidenceSubjective: 1, responses: buildResponses(FORM_A, correctAnswers(FORM_A)) };
  session.postTest = { formId: "B", submitted: true, confidenceSubjective: 5, responses: buildResponses(FORM_B, correctAnswers(FORM_B)) };
  session.phishingResponses = [{ scenarioId: "PH-02", selectedDecision: "phishing", correct: true }];
  session.feedbackComment = "=HYPERLINK(\"https://example.test\")";
  const csv = exportCsv(session, 10 * 60 * 1000);
  assert.match(csv, /"test_item"/);
  assert.match(csv, /"phishing_scenario"/);
  assert.match(csv, /"A-LO01-01"/);
  assert.match(csv, /"B-LO06-01"/);
  assert.match(csv, /"PH-02"/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/);
  assert.doesNotMatch(csv, /started_at|exported_at/i);
});

test("corrupted, expired and version-mismatched local records are safely reset", () => {
  const corrupt = new MemoryStorage(); corrupt.setItem(STORAGE_KEY, "{not-json");
  assert.equal(loadSession(corrupt, 100).status, "created_corrupt");
  const expired = new MemoryStorage(); expired.setItem(STORAGE_KEY, JSON.stringify(createSession(0, "AL-TEST-0003")));
  assert.equal(loadSession(expired, SESSION_TTL_MS + 1).status, "created_expired");
  const old = new MemoryStorage(); old.setItem(STORAGE_KEY, JSON.stringify({ ...createSession(0, "AL-TEST-0004"), schemaVersion: 1 }));
  assert.equal(loadSession(old, 1).status, "created_version_mismatch");
});

test("session deletion removes the device-local record", () => {
  const storage = new MemoryStorage(); storage.setItem(STORAGE_KEY, "value");
  deleteSession(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("WebAuthn unsupported, cancellation and timeout states are explicit", () => {
  assert.equal(webAuthnStatus(null, false), "unsupported");
  const cancelled = new Error("cancelled"); cancelled.name = "NotAllowedError";
  const timeout = new Error("timeout"); timeout.name = "TimeoutError";
  assert.equal(webAuthnStatus(cancelled), "cancelled");
  assert.equal(webAuthnStatus(timeout), "timeout");
});

test("site source exposes accessible controls and no credential collection or outbound record API", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /className="skip-link"/);
  assert.match(page, /role="progressbar"/);
  assert.match(page, /aria-valuenow=/);
  assert.match(page, /aria-pressed=/);
  assert.match(page, /role="radiogroup"/);
  assert.doesNotMatch(page, /type=["']password["']/i);
  assert.doesNotMatch(page, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket\s*\(/);
  assert.doesNotMatch(page, /onClick=\{[^}]*\}[^>]*>\s*<div/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.mobile-section-nav/);
});
