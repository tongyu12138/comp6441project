export const SCHEMA_VERSION = 2 as const;
export const ACTIVITY_VERSION = "2.0.0" as const;
export const STORAGE_KEY = "authlab-learning-session-v2";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type LearningObjectiveId = "LO-01" | "LO-02" | "LO-03" | "LO-04" | "LO-05" | "LO-06";
export type ModuleId = 1 | 2 | 3 | 4;
export type FormId = "A" | "B";

export type LearningObjective = {
  id: LearningObjectiveId;
  statement: string;
};

export type Question = {
  id: string;
  formId: FormId;
  learningObjectiveId: LearningObjectiveId;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  rationale: string;
  distractorRationales: readonly string[];
};

export type ItemResponse = {
  questionId: string;
  learningObjectiveId: LearningObjectiveId;
  selectedIndex: number;
  selectedAnswer: string;
  correct: boolean;
};

export type PhishingResponse = {
  scenarioId: string;
  selectedDecision: "legitimate" | "phishing";
  correct: boolean;
};

export type TestRecord = {
  formId: FormId;
  submitted: boolean;
  confidenceSubjective: number | null;
  responses: ItemResponse[];
};

export type SessionData = {
  schemaVersion: typeof SCHEMA_VERSION;
  activityVersion: typeof ACTIVITY_VERSION;
  sessionCode: string;
  createdAtMs: number;
  expiresAtMs: number;
  completedModules: ModuleId[];
  preTest: TestRecord;
  postTest: TestRecord;
  phishingResponses: PhishingResponse[];
  usefulnessRating: number | null;
  feedbackComment: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const LEARNING_OBJECTIVES: readonly LearningObjective[] = [
  { id: "LO-01", statement: "Distinguish identity, authentication and authorisation in a sign-in flow." },
  { id: "LO-02", statement: "Explain how password reuse enables credential stuffing across services." },
  { id: "LO-03", statement: "Use registered-domain, context and trusted-route evidence in phishing decisions." },
  { id: "LO-04", statement: "Separate replay resistance from phishing resistance when comparing MFA methods." },
  { id: "LO-05", statement: "Explain how RP-ID/verifier-name binding gives WebAuthn phishing resistance." },
  { id: "LO-06", statement: "Describe the public/private-key boundary and residual risks of passkeys." },
];

export const FORM_A: readonly Question[] = [
  {
    id: "A-LO01-01", formId: "A", learningObjectiveId: "LO-01",
    prompt: "Which statement best separates identity, authentication and authorisation?",
    options: [
      "Identity is a claim, authentication checks accepted proof, and authorisation limits permitted actions",
      "Authentication creates a person and authorisation proves their password",
      "The three terms describe the same login step",
    ],
    correctIndex: 0,
    rationale: "The three layers answer different questions: who the account refers to, what proof is accepted, and what the session may do.",
    distractorRationales: ["", "Authentication does not create a person, and authorisation does not prove a password.", "Collapsing the layers hides different failure modes."],
  },
  {
    id: "A-LO02-01", formId: "A", learningObjectiveId: "LO-02",
    prompt: "Why can one breached password compromise accounts on unrelated services?",
    options: [
      "Browsers automatically share every stored password",
      "Attackers automate stolen username-password pairs against other services",
      "Encryption stops working everywhere after one breach",
    ],
    correctIndex: 1,
    rationale: "Credential stuffing replays a known credential pair wherever the user reused it.",
    distractorRationales: ["Browsers do not automatically send every password to unrelated sites.", "", "A breach does not globally disable encryption."],
  },
  {
    id: "A-LO03-01", formId: "A", learningObjectiveId: "LO-03",
    prompt: "What is the strongest evidence to check before using a sign-in link?",
    options: ["The page colours", "The registered domain and a trusted route to the service", "Whether the logo looks sharp"],
    correctIndex: 1,
    rationale: "Pixels can be copied. The registered domain and an independently reached trusted route provide stronger verifier evidence.",
    distractorRationales: ["Colours are cosmetic and copyable.", "", "A high-quality logo does not establish origin."],
  },
  {
    id: "A-LO04-01", formId: "A", learningObjectiveId: "LO-04",
    prompt: "Which statement about MFA is most accurate?",
    options: [
      "Every form of MFA is phishing-resistant",
      "MFA can reduce risk, but OTPs and push approvals can still be relayed or abused",
      "MFA removes the need to secure account recovery",
    ],
    correctIndex: 1,
    rationale: "MFA is a family of mechanisms. Their replay, relay, fatigue and recovery properties differ.",
    distractorRationales: ["Adding a factor does not automatically bind proof to the legitimate verifier.", "", "Recovery can bypass otherwise strong authentication."],
  },
  {
    id: "A-LO05-01", formId: "A", learningObjectiveId: "LO-05",
    prompt: "Why does a WebAuthn passkey resist a conventional look-alike phishing site?",
    options: [
      "The browser/authenticator binds the credential to the relying party",
      "The user types a longer secret",
      "The private key is sent to every site for comparison",
    ],
    correctIndex: 0,
    rationale: "The authentication ceremony is scoped to the relying party, so another origin cannot obtain a valid assertion for it.",
    distractorRationales: ["", "Passkeys do not rely on a typed shared secret.", "The private key is protected by the authenticator and is not sent to the relying party."],
  },
  {
    id: "A-LO06-01", formId: "A", learningObjectiveId: "LO-06",
    prompt: "What does a relying party normally retain for a passkey credential?",
    options: ["The user’s biometric template", "A reusable copy of the private key", "A public key and credential metadata"],
    correctIndex: 2,
    rationale: "The relying party verifies signatures with public-key material; the authenticator protects the private key.",
    distractorRationales: ["The website does not receive the biometric used for local user verification.", "The private key is not copied to the relying party.", ""],
  },
] as const;

export const FORM_B: readonly Question[] = [
  {
    id: "B-LO01-01", formId: "B", learningObjectiveId: "LO-01",
    prompt: "A valid user proves control but can edit every account. Which layer failed?",
    options: ["Identity", "Authentication", "Authorisation"],
    correctIndex: 2,
    rationale: "The proof was accepted, but the permitted action was too broad: that is an authorisation failure.",
    distractorRationales: ["The account identity can be correct while permissions are excessive.", "Authentication succeeded in the scenario.", ""],
  },
  {
    id: "B-LO02-01", formId: "B", learningObjectiveId: "LO-02",
    prompt: "Service A leaks a password that is also used at Service B. What makes Service B vulnerable?",
    options: ["The same replayable proof may be accepted at B", "Every browser shares cookies", "The password length becomes zero"],
    correctIndex: 0,
    rationale: "Reuse lets an attacker replay the exposed proof at another verifier.",
    distractorRationales: ["", "Unrelated services do not automatically share every browser cookie.", "A breach does not change the password’s character count."],
  },
  {
    id: "B-LO03-01", formId: "B", learningObjectiveId: "LO-03",
    prompt: "A page perfectly copies a bank’s design. Which evidence still matters most?",
    options: ["Registered domain, request context and trusted route", "Logo size", "Background colour"],
    correctIndex: 0,
    rationale: "Visual fidelity does not prove which verifier receives the credential.",
    distractorRationales: ["", "Logo dimensions are not origin evidence.", "Colour is copyable and not an authentication signal."],
  },
  {
    id: "B-LO04-01", formId: "B", learningObjectiveId: "LO-04",
    prompt: "Which description of TOTP is accurate under real-time phishing?",
    options: ["It cannot be phished", "It is short-lived but may be relayed before expiry", "It is an origin-bound public key"],
    correctIndex: 1,
    rationale: "A short lifetime limits replay time but does not stop an adversary-in-the-middle from relaying the code immediately.",
    distractorRationales: ["TOTP is manually entered and can be captured by a fake page.", "", "TOTP is a symmetric one-time-code mechanism, not an origin-bound public-key credential."],
  },
  {
    id: "B-LO05-01", formId: "B", learningObjectiveId: "LO-05",
    prompt: "What does verifier-name/RP-ID binding achieve?",
    options: ["It binds authentication output to the intended relying party", "It hides the username font", "It forces monthly password changes"],
    correctIndex: 0,
    rationale: "The authenticator output is scoped to the relying party, which prevents a look-alike origin from requesting valid proof for the legitimate RP.",
    distractorRationales: ["", "Typography is unrelated to cryptographic verifier binding.", "Password rotation is unrelated to WebAuthn RP binding."],
  },
  {
    id: "B-LO06-01", formId: "B", learningObjectiveId: "LO-06",
    prompt: "Which statement best describes the passkey private key?",
    options: ["It is protected by the authenticator and is not sent during authentication", "It is emailed to the relying party", "It is printed in the URL"],
    correctIndex: 0,
    rationale: "The authenticator signs a fresh challenge; the relying party verifies the signature with public-key material.",
    distractorRationales: ["", "Emailing a private key would destroy the security boundary.", "URLs must not contain private key material."],
  },
] as const;

export function questionMap(questions: readonly Question[]): Map<string, Question> {
  return new Map(questions.map((question) => [question.id, question]));
}

export function buildResponses(questions: readonly Question[], answers: Record<string, number>): ItemResponse[] {
  return questions.map((question) => {
    const selectedIndex = answers[question.id];
    return {
      questionId: question.id,
      learningObjectiveId: question.learningObjectiveId,
      selectedIndex,
      selectedAnswer: question.options[selectedIndex] ?? "",
      correct: selectedIndex === question.correctIndex,
    };
  });
}

export function scoreResponses(responses: readonly ItemResponse[]): number {
  return responses.reduce((sum, response) => sum + (response.correct ? 1 : 0), 0);
}

/** Baseline answers/scores remain concealed until the independent Form B is submitted. */
export function assessmentResultsVisible(session: SessionData): boolean {
  return session.postTest.submitted;
}

function randomSessionCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const value = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").toUpperCase();
  return `AL-${value.slice(0, 4)}-${value.slice(4, 8)}`;
}

export function createSession(nowMs = Date.now(), sessionCode = randomSessionCode()): SessionData {
  return {
    schemaVersion: SCHEMA_VERSION,
    activityVersion: ACTIVITY_VERSION,
    sessionCode,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + SESSION_TTL_MS,
    completedModules: [],
    preTest: { formId: "A", submitted: false, confidenceSubjective: null, responses: [] },
    postTest: { formId: "B", submitted: false, confidenceSubjective: null, responses: [] },
    phishingResponses: [],
    usefulnessRating: null,
    feedbackComment: "",
  };
}

function isItemResponse(value: unknown): value is ItemResponse {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ItemResponse>;
  return typeof item.questionId === "string"
    && typeof item.learningObjectiveId === "string"
    && Number.isInteger(item.selectedIndex)
    && typeof item.selectedAnswer === "string"
    && typeof item.correct === "boolean";
}

export function isSessionData(value: unknown): value is SessionData {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<SessionData>;
  const testRecordValid = (record: unknown, formId: FormId) => {
    if (!record || typeof record !== "object") return false;
    const test = record as Partial<TestRecord>;
    return test.formId === formId
      && typeof test.submitted === "boolean"
      && (test.confidenceSubjective === null || (Number.isInteger(test.confidenceSubjective) && Number(test.confidenceSubjective) >= 1 && Number(test.confidenceSubjective) <= 5))
      && Array.isArray(test.responses)
      && test.responses.every(isItemResponse);
  };
  return session.schemaVersion === SCHEMA_VERSION
    && session.activityVersion === ACTIVITY_VERSION
    && typeof session.sessionCode === "string"
    && /^AL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(session.sessionCode)
    && typeof session.createdAtMs === "number"
    && typeof session.expiresAtMs === "number"
    && Array.isArray(session.completedModules)
    && session.completedModules.every((item) => [1, 2, 3, 4].includes(item))
    && testRecordValid(session.preTest, "A")
    && testRecordValid(session.postTest, "B")
    && Array.isArray(session.phishingResponses)
    && session.phishingResponses.every((item) => item && typeof item.scenarioId === "string" && typeof item.selectedDecision === "string" && typeof item.correct === "boolean")
    && (session.usefulnessRating === null || (Number.isInteger(session.usefulnessRating) && Number(session.usefulnessRating) >= 1 && Number(session.usefulnessRating) <= 5))
    && typeof session.feedbackComment === "string";
}

export type LoadStatus = "loaded" | "created_missing" | "created_corrupt" | "created_expired" | "created_version_mismatch";

export function loadSession(storage: StorageLike, nowMs = Date.now()): { session: SessionData; status: LoadStatus } {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { session: createSession(nowMs), status: "created_missing" };
  let value: unknown;
  try { value = JSON.parse(raw); } catch {
    storage.removeItem(STORAGE_KEY);
    return { session: createSession(nowMs), status: "created_corrupt" };
  }
  if (!value || typeof value !== "object" || (value as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION || (value as { activityVersion?: unknown }).activityVersion !== ACTIVITY_VERSION) {
    storage.removeItem(STORAGE_KEY);
    return { session: createSession(nowMs), status: "created_version_mismatch" };
  }
  if (!isSessionData(value)) {
    storage.removeItem(STORAGE_KEY);
    return { session: createSession(nowMs), status: "created_corrupt" };
  }
  if (value.expiresAtMs <= nowMs) {
    storage.removeItem(STORAGE_KEY);
    return { session: createSession(nowMs), status: "created_expired" };
  }
  return { session: value, status: "loaded" };
}

export function saveSession(storage: StorageLike, session: SessionData): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function deleteSession(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEY);
}

export function roundedDurationMinutes(session: SessionData, nowMs = Date.now()): number {
  const elapsed = Math.max(0, Math.min(nowMs - session.createdAtMs, 3 * 60 * 60 * 1000));
  return Math.round(elapsed / (5 * 60 * 1000)) * 5;
}

export function deidentifiedRecord(session: SessionData, nowMs = Date.now()) {
  return {
    schema_version: session.schemaVersion,
    activity_version: session.activityVersion,
    session_code: session.sessionCode,
    duration_minutes_rounded: roundedDurationMinutes(session, nowMs),
    completed_modules: session.completedModules,
    pre_test: session.preTest,
    post_test: session.postTest,
    phishing_responses: session.phishingResponses,
    usefulness_rating: session.usefulnessRating,
    feedback_comment: session.feedbackComment.slice(0, 500),
    data_minimisation_notice: "De-identified learning record; no name, email, zID, IP address, browser fingerprint, credential or biometric is collected.",
  };
}

export function csvSafeCell(value: unknown): string {
  let text = "";
  if (typeof value === "string") text = value;
  else if (typeof value === "number" && Number.isFinite(value)) text = String(value);
  else if (typeof value === "boolean") text = value ? "true" : "false";
  const first = text.match(/\S/)?.[0];
  if (first && ["=", "+", "-", "@"].includes(first)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportCsv(session: SessionData, nowMs = Date.now()): string {
  const headers = [
    "record_type", "schema_version", "activity_version", "session_code", "duration_minutes_rounded",
    "completed_modules", "form_id", "question_id", "learning_objective_id", "selected_answer", "correct",
    "scenario_id", "selected_decision", "confidence_subjective", "usefulness_rating", "feedback_comment",
  ];
  const base = [session.schemaVersion, session.activityVersion, session.sessionCode, roundedDurationMinutes(session, nowMs), session.completedModules.join(";")];
  const rows: unknown[][] = [["session", ...base, "", "", "", "", "", "", "", "", "", session.usefulnessRating, session.feedbackComment.slice(0, 500)]];
  for (const testRecord of [session.preTest, session.postTest]) {
    for (const response of testRecord.responses) {
      rows.push(["test_item", ...base, testRecord.formId, response.questionId, response.learningObjectiveId, response.selectedAnswer, response.correct, "", "", testRecord.confidenceSubjective, "", ""]);
    }
  }
  for (const response of session.phishingResponses) {
    rows.push(["phishing_scenario", ...base, "", "", "LO-03", "", response.correct, response.scenarioId, response.selectedDecision, "", "", ""]);
  }
  return `${headers.map(csvSafeCell).join(",")}\r\n${rows.map((row) => row.map(csvSafeCell).join(",")).join("\r\n")}\r\n`;
}

export function webAuthnStatus(error: unknown, supported = true): "unsupported" | "cancelled" | "timeout" | "error" {
  if (!supported) return "unsupported";
  if (error instanceof Error && error.name === "NotAllowedError") return "cancelled";
  if (error instanceof Error && error.name === "TimeoutError") return "timeout";
  return "error";
}
