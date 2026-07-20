"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_VERSION,
  FORM_A,
  FORM_B,
  LEARNING_OBJECTIVES,
  buildResponses,
  assessmentResultsVisible,
  createSession,
  deidentifiedRecord,
  deleteSession,
  exportCsv,
  loadSession,
  questionMap,
  saveSession,
  scoreResponses,
  webAuthnStatus,
  type FormId,
  type LoadStatus,
  type ModuleId,
  type PhishingResponse,
  type Question,
  type SessionData,
} from "../lib/authlab-model";

type AnswerMap = Record<string, number>;

const phishingScenarios = [
  {
    id: "PH-01", sender: "IT Service Desk <support@example.edu>", subject: "Security key registration is available",
    url: "https://accounts.example.edu/security-keys", note: "The registered domain is example.edu and the route is plausible.", malicious: false,
  },
  {
    id: "PH-02", sender: "Campus Account Team <urgent@account-notice.example.net>", subject: "Your mailbox closes in 20 minutes",
    url: "https://example.edu.verify-login.example.net/session", note: "The registered domain is example.net; example.edu is only a subdomain label.", malicious: true,
  },
  {
    id: "PH-03", sender: "Library Access <service@examp1e.edu>", subject: "Re-authenticate to keep journal access",
    url: "https://examp1e.edu/library-login", note: "The digit 1 replaces the letter l in a look-alike domain.", malicious: true,
  },
  {
    id: "PH-04", sender: "Learning Platform <no-reply@learn.example.edu>", subject: "New assessment feedback",
    url: "https://learn.example.edu/courses/6441/feedback", note: "The registered domain remains example.edu and the service is on its expected subdomain.", malicious: false,
  },
] as const;

const threatRows = [
  ["Password only", "No — captured proof can be replayed", "No — a fake verifier can collect it", "Recovery and reuse may bypass controls", "Password manager and rate limiting assumed"],
  ["Password + SMS OTP", "Limited — code is short-lived", "No — code can be relayed in real time", "Telecom and recovery paths remain", "Phone coverage and number control assumed"],
  ["Password + TOTP", "Limited — short validity window", "No — entered codes can be relayed", "Seed recovery and device loss remain", "Clock sync and authenticator access assumed"],
  ["Password + push approval", "Usually — approval is transaction-bound only if designed so", "Not inherent — fatigue and session relay remain", "Recovery and enrolled-device control remain", "Clear context and number matching assumed"],
  ["Passkey / WebAuthn", "Yes — fresh signed challenge", "Yes — proof is scoped to the relying party", "Recovery and ecosystem governance remain", "Compatible browser, authenticator and secure origin assumed"],
] as const;

const sources = [
  ["NIST SP 800-63B-4: Authentication and Authenticator Management", "https://pages.nist.gov/800-63-4/sp800-63b.html"],
  ["W3C Web Authentication: Level 3", "https://www.w3.org/TR/webauthn-3/"],
  ["FIDO Alliance: Passkeys", "https://fidoalliance.org/passkeys/"],
  ["OWASP: Credential Stuffing", "https://owasp.org/www-community/attacks/Credential_stuffing"],
  ["CISA: Phishing Guidance", "https://www.cisa.gov/sites/default/files/2025-03/Phishing%20Guidance%20-%20Stopping%20the%20Attack%20Cycle%20at%20Phase%20One%20508.pdf"],
] as const;

function QuizForm({
  formId,
  questions,
  onSubmit,
}: {
  formId: FormId;
  questions: readonly Question[];
  onSubmit: (answers: AnswerMap, confidence: number) => void;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [confidence, setConfidence] = useState<number | null>(null);
  const ready = Object.keys(answers).length === questions.length && confidence !== null;
  const isPre = formId === "A";

  return (
    <section className="quiz-shell" aria-labelledby={`${formId}-test-title`}>
      <div className="section-kicker">{isPre ? "Baseline · Form A" : "Learning check · Form B"}</div>
      <h2 id={`${formId}-test-title`}>{isPre ? "Record what you know now" : "Apply the same objectives to new scenarios"}</h2>
      <p className="section-lead">
        {isPre
          ? "Form A records a baseline. Correct answers and scores are deliberately hidden until Form B is complete."
          : "Form B uses parallel—not repeated—questions. After submission, every answer includes a rationale and learning-objective link."}
      </p>
      <div className="quiz-list">
        {questions.map((question, index) => (
          <fieldset className="quiz-question" id={question.id} key={question.id}>
            <legend><span>{String(index + 1).padStart(2, "0")}</span>{question.prompt}</legend>
            <div className="question-meta">{question.id} · {question.learningObjectiveId}</div>
            {question.options.map((option, optionIndex) => (
              <label data-testid={`${question.id}-option-${optionIndex}`} className={`answer-row ${answers[question.id] === optionIndex ? "selected" : ""}`} key={option}>
                <input
                  type="radio"
                  name={`${formId}-${question.id}`}
                  checked={answers[question.id] === optionIndex}
                  onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <fieldset className="confidence-field" id={`${formId}-confidence`}>
        <legend>Subjective confidence: how confident are you in these answers?</legend>
        <p>This is self-reported confidence, not an objective measure of security skill.</p>
        <div className="scale-row" role="radiogroup" aria-label={`${formId} subjective confidence from 1 to 5`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label data-testid={`${formId}-confidence-${value}`} key={value}><input type="radio" name={`${formId}-confidence`} checked={confidence === value} onChange={() => setConfidence(value)} /><span>{value}</span></label>
          ))}
        </div>
      </fieldset>
      <button className="primary-button" disabled={!ready} onClick={() => ready && onSubmit(answers, confidence)}>
        {isPre ? "Record Form A without revealing answers" : "Submit Form B and review explanations"}
      </button>
    </section>
  );
}

function PostTestReview({ session }: { session: SessionData }) {
  const byId = questionMap(FORM_B);
  return (
    <section className="review-shell" id="post-review" aria-labelledby="post-review-title">
      <div className="section-kicker">Form B feedback</div>
      <h2 id="post-review-title">Review the evidence behind every answer</h2>
      <div className="review-list">
        {session.postTest.responses.map((response, index) => {
          const question = byId.get(response.questionId);
          if (!question) return null;
          return (
            <article className={response.correct ? "review-correct" : "review-incorrect"} key={response.questionId}>
              <div className="review-status">{response.correct ? "Correct" : "Incorrect"} · Item {index + 1} · {question.learningObjectiveId}</div>
              <h3>{question.prompt}</h3>
              <p><strong>Your answer:</strong> {response.selectedAnswer}</p>
              <p><strong>Correct answer:</strong> {question.options[question.correctIndex]}</p>
              <p><strong>Why:</strong> {question.rationale}</p>
              <details><summary>Why the other options are weaker</summary>
                <ul>{question.options.map((option, optionIndex) => optionIndex === question.correctIndex ? null : <li key={option}><strong>{option}:</strong> {question.distractorRationales[optionIndex]}</li>)}</ul>
              </details>
              <p className="objective-link"><strong>{question.learningObjectiveId}:</strong> {LEARNING_OBJECTIVES.find((item) => item.id === question.learningObjectiveId)?.statement}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ModuleHeader({ number, eyebrow, title, lead }: { number: string; eyebrow: string; title: string; lead: string }) {
  return <header className="module-header"><div className="module-number" aria-hidden="true">{number}</div><div><div className="section-kicker">{eyebrow}</div><h2>{title}</h2><p className="section-lead">{lead}</p></div></header>;
}

function Checkpoint({ complete, enabled, onComplete, children }: { complete: boolean; enabled: boolean; onComplete: () => void; children: React.ReactNode }) {
  return (
    <div className={`checkpoint ${complete ? "checkpoint-complete" : ""}`}>
      <div><span>Required checkpoint</span>{children}</div>
      <button className="secondary-button" disabled={!enabled || complete} onClick={onComplete}>{complete ? "Module completed" : "Complete this module"}</button>
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus | null>(null);
  const [identityChoice, setIdentityChoice] = useState<string | null>(null);
  const [identityCheckpoint, setIdentityCheckpoint] = useState<string | null>(null);
  const [stuffingRun, setStuffingRun] = useState(false);
  const [passwordCheckpoint, setPasswordCheckpoint] = useState<string | null>(null);
  const [phishingAnswers, setPhishingAnswers] = useState<Record<string, "legitimate" | "phishing">>({});
  const [moduleFourCheckpoint, setModuleFourCheckpoint] = useState<string | null>(null);
  const [conceptStep, setConceptStep] = useState(0);
  const [webauthnConsent, setWebauthnConsent] = useState(false);
  const [passkeyCredential, setPasskeyCredential] = useState<PublicKeyCredential | null>(null);
  const [passkeyLog, setPasskeyLog] = useState<string[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadSession(localStorage);
      setSession(loaded.session);
      setLoadStatus(loaded.status);
      setPhishingAnswers(Object.fromEntries(loaded.session.phishingResponses.map((item) => [item.scenarioId, item.selectedDecision])));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => { if (session) saveSession(localStorage, session); }, [session]);

  const completed = session?.completedModules.length ?? 0;
  const progress = session?.postTest.submitted ? 100 : (session?.preTest.submitted ? 15 : 0) + completed * 18;
  const preScore = session ? scoreResponses(session.preTest.responses) : 0;
  const postScore = session ? scoreResponses(session.postTest.responses) : 0;
  const scoreChange = session?.postTest.submitted ? postScore - preScore : null;
  const showAssessmentResults = session ? assessmentResultsVisible(session) : false;

  const updateSession = (patch: Partial<SessionData>) => setSession((current) => current ? { ...current, ...patch } : current);
  const completeModule = (module: ModuleId) => setSession((current) => {
    if (!current || current.completedModules.includes(module)) return current;
    return { ...current, completedModules: [...current.completedModules, module].sort() as ModuleId[] };
  });
  const moduleComplete = (module: ModuleId) => session?.completedModules.includes(module) ?? false;

  const submitTest = (formId: FormId, questions: readonly Question[], answers: AnswerMap, confidence: number) => {
    const record = { formId, submitted: true, confidenceSubjective: confidence, responses: buildResponses(questions, answers) };
    setSession((current) => current ? { ...current, [formId === "A" ? "preTest" : "postTest"]: record } : current);
  };

  const choosePhishing = (scenarioId: string, selectedDecision: "legitimate" | "phishing") => {
    const next = { ...phishingAnswers, [scenarioId]: selectedDecision };
    setPhishingAnswers(next);
    const responses: PhishingResponse[] = phishingScenarios
      .filter((scenario) => next[scenario.id])
      .map((scenario) => ({ scenarioId: scenario.id, selectedDecision: next[scenario.id], correct: (next[scenario.id] === "phishing") === scenario.malicious }));
    updateSession({ phishingResponses: responses });
  };

  const runPasskeyRegistration = async () => {
    const supported = "PublicKeyCredential" in window && !!navigator.credentials;
    if (!supported) { setPasskeyLog(["Unsupported: this browser does not expose the WebAuthn API."]); return; }
    if (!webauthnConsent) { setPasskeyLog(["Consent is required before the optional browser API demonstration."]); return; }
    setPasskeyBusy(true);
    setPasskeyLog(["A fresh challenge was generated in this browser for an API demonstration."]);
    try {
      const credential = await navigator.credentials.create({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "AuthLab protocol demonstration", id: window.location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "demo@example.test", displayName: "Demo learner" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { residentKey: "discouraged", userVerification: "preferred" },
        timeout: 60000, attestation: "none",
      } }) as PublicKeyCredential | null;
      if (!credential) throw new Error("No credential returned");
      setPasskeyCredential(credential);
      setPasskeyLog([
        "Demo credential created for this relying-party origin.",
        `Credential ID: ${credential.id.slice(0, 20)}… (non-secret identifier)`,
        "No biometric or private key was received by this page.",
        "No production server record or assertion verification exists in AuthLab.",
      ]);
    } catch (error) {
      const status = webAuthnStatus(error, supported);
      setPasskeyLog([status === "cancelled" ? "Cancelled safely: the user declined or the browser ended the request." : status === "timeout" ? "Timed out safely: no complete ceremony was recorded." : "The demonstration stopped without completing a credential ceremony."]);
    } finally { setPasskeyBusy(false); }
  };

  const runPasskeyAssertion = async () => {
    if (!passkeyCredential || !webauthnConsent) return;
    setPasskeyBusy(true);
    try {
      const assertion = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: window.location.hostname,
        allowCredentials: [{ type: "public-key", id: passkeyCredential.rawId }], userVerification: "preferred", timeout: 60000,
      } }) as PublicKeyCredential | null;
      if (!assertion) throw new Error("No assertion returned");
      const response = assertion.response as AuthenticatorAssertionResponse;
      setPasskeyLog([
        "The authenticator signed a fresh challenge scoped to this relying party.",
        `Authenticator data: ${response.authenticatorData.byteLength} bytes; signature: ${response.signature.byteLength} bytes.`,
        "This client-only demo does not verify challenge state, RP-ID hash, flags or signature on a production server.",
      ]);
    } catch (error) {
      const status = webAuthnStatus(error, true);
      setPasskeyLog([status === "cancelled" ? "Authentication was cancelled safely." : status === "timeout" ? "The authentication request timed out safely." : "The assertion demonstration stopped without completing."]);
    } finally { setPasskeyBusy(false); }
  };

  const downloadRecord = (format: "json" | "csv") => {
    if (!session || !session.postTest.submitted) return;
    const content = format === "json" ? JSON.stringify(deidentifiedRecord(session), null, 2) : exportCsv(session);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `authlab-${ACTIVITY_VERSION}-${session.sessionCode}.${format}`; link.click();
    URL.revokeObjectURL(url);
  };

  const clearSession = () => {
    if (!confirm("Delete this device-local learning record? This cannot be undone.")) return;
    deleteSession(localStorage);
    setSession(createSession()); setIdentityChoice(null); setIdentityCheckpoint(null); setStuffingRun(false);
    setPasswordCheckpoint(null); setPhishingAnswers({}); setModuleFourCheckpoint(null); setConceptStep(0);
    setWebauthnConsent(false); setPasskeyCredential(null); setPasskeyLog([]); setLoadStatus("created_missing");
  };

  const statusMessage = useMemo(() => {
    if (loadStatus === "created_corrupt") return "A malformed local record was removed and a clean session was created.";
    if (loadStatus === "created_expired") return "The previous local record expired after 30 days and was deleted.";
    if (loadStatus === "created_version_mismatch") return "An older activity record was safely reset because its schema/version was incompatible.";
    return null;
  }, [loadStatus]);

  if (!session) return <main className="loading-screen">Preparing a device-local learning record…</main>;

  const allPhishingAnswered = session.phishingResponses.length === phishingScenarios.length;
  const conceptualSteps = ["Fresh server challenge", "Browser checks the relying-party context", "Authenticator performs local user verification", "Private key signs the challenge", "Server should verify challenge, RP binding, flags and signature"];

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="AuthLab home"><span aria-hidden="true">A/</span> AuthLab</a>
        <nav aria-label="Primary sections"><a href="#learn">Learn</a><a href="#passwords">Passwords</a><a href="#phishing">Phishing</a><a href="#passkeys">Passkeys</a><a href="#results">Results</a></nav>
        <div className="privacy-label">Device-local · v{ACTIVITY_VERSION}</div>
      </header>
      <nav className="mobile-section-nav" aria-label="Mobile section navigation"><a href="#pre-test">Form A</a><a href="#learn">Module 1</a><a href="#passwords">Module 2</a><a href="#phishing">Module 3</a><a href="#passkeys">Module 4</a><a href="#results">Results</a></nav>
      <div className="progress-track" role="progressbar" aria-label="Activity progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div style={{ width: `${progress}%` }} /></div>

      <main id="main-content">
        <section className="hero" id="top">
          <div className="hero-copy"><p className="hero-eyebrow">Interactive security engineering guide</p><h1>See the system behind the sign-in.</h1><p>Explore replay, real-time phishing, MFA trade-offs and origin-bound passkeys through safe conceptual activities.</p><div className="hero-actions"><a className="primary-button" href={session.preTest.submitted ? "#learn" : "#pre-test"}>{session.preTest.submitted ? "Continue the activity" : "Start Form A"}</a><span>No real usernames, passwords, MFA codes or biometrics are requested.</span></div></div>
          <div className="hero-visual" aria-label="Authentication model"><div className="signal-row"><span>Claim</span><b>Identity: which account?</b></div><div className="signal-arrow">↓</div><div className="signal-row active"><span>Proof</span><b>Authentication: what evidence?</b></div><div className="signal-arrow">↓</div><div className="signal-row"><span>Decision</span><b>Authorisation: which action?</b></div><div className="protocol-chip">protocol + people + recovery</div></div>
        </section>

        <section className="privacy-notice" aria-labelledby="privacy-title"><div><div className="section-kicker">Data minimisation</div><h2 id="privacy-title">Your learning record stays on this device</h2></div><ul><li>Random de-identified session code; no name, email, zID, IP address or fingerprint.</li><li>Local storage expires after 30 days and can be deleted at any time.</li><li>Exports omit exact timestamps and round duration to five-minute intervals.</li><li>Do not enter personal information in optional feedback.</li></ul></section>
        {statusMessage && <p className="system-notice" role="status">{statusMessage}</p>}

        <section className="promise-strip" aria-label="Learning outcomes"><div><strong>4</strong><span>required module checkpoints</span></div><div><strong>A → B</strong><span>parallel test forms</span></div><div><strong>6</strong><span>stable learning objectives</span></div><div><strong>0</strong><span>credentials collected</span></div></section>

        <div id="pre-test">{!session.preTest.submitted ? <QuizForm formId="A" questions={FORM_A} onSubmit={(answers, confidence) => submitTest("A", FORM_A, answers, confidence)} /> : <section className="baseline-complete"><span>Form A recorded</span><strong>Answers remain hidden</strong><a href="#learn">Begin module 1 ↓</a></section>}</div>

        <section className="module" id="learn">
          <ModuleHeader number="01" eyebrow="Identity engineering · LO-01" title="A login is three decisions, not one" lead="Explore the layers, then complete the checkpoint. Opening the module alone does not count as completion." />
          <div className="identity-grid">{[
            ["identity", "Identity", "The account claim", "A record says Alex is linked to account 1042."],
            ["authentication", "Authentication", "The accepted proof", "Alex demonstrates control of an approved authenticator."],
            ["authorisation", "Authorisation", "The permitted action", "Policy lets account 1042 read one course—not the admin console."],
          ].map(([id, heading, label, copy]) => <button className={`identity-step ${identityChoice === id ? "chosen" : ""}`} aria-pressed={identityChoice === id} key={id} onClick={() => setIdentityChoice(id)}><span>{label}</span><strong>{heading}</strong><p>{copy}</p></button>)}</div>
          <div className="checkpoint-question"><p>A valid learner signs in but can delete every course. Which layer failed?</p><div className="choice-row">{["identity", "authentication", "authorisation"].map((choice) => <button key={choice} aria-pressed={identityCheckpoint === choice} onClick={() => setIdentityCheckpoint(choice)}>{choice}</button>)}</div></div>
          <Checkpoint complete={moduleComplete(1)} enabled={identityChoice !== null && identityCheckpoint === "authorisation"} onComplete={() => completeModule(1)}><strong>Checkpoint:</strong> explore a layer and identify excessive permission as an authorisation failure.</Checkpoint>
        </section>

        <section className="module module-dark" id="passwords">
          <ModuleHeader number="02" eyebrow="Credential stuffing · LO-02" title="Reuse propagates one exposed password" lead="The simulation uses only fictional services and fixed dummy data. It performs no network requests." />
          <div className="stuffing-lab"><div className="breach-source"><span>Dummy breach record</span><code>learner@example.test : correct-horse-demo</code><button className="light-button" onClick={() => setStuffingRun(true)}>Run safe simulation</button></div><div className="reuse-results" aria-live="polite">{[["StudySpace", true], ["PhotoCloud", false], ["TicketBox", true]].map(([service, reused]) => <div key={String(service)} className={stuffingRun ? (reused ? "compromised" : "blocked") : "pending"}><span>{String(service)}</span><b>{stuffingRun ? (reused ? "Account takeover: reused proof accepted" : "Blocked: unique proof") : "Waiting"}</b></div>)}</div></div>
          <div className="checkpoint-question"><p>Which change stopped replay at PhotoCloud?</p><div className="choice-row">{["longer reused password", "unique non-reused proof", "copied logo"].map((choice) => <button key={choice} aria-pressed={passwordCheckpoint === choice} onClick={() => setPasswordCheckpoint(choice)}>{choice}</button>)}</div></div>
          <Checkpoint complete={moduleComplete(2)} enabled={stuffingRun && passwordCheckpoint === "unique non-reused proof"} onComplete={() => completeModule(2)}><strong>Checkpoint:</strong> run the simulation and identify the control that changes the outcome.</Checkpoint>
        </section>

        <section className="module" id="phishing">
          <ModuleHeader number="03" eyebrow="Phishing and impersonation · LO-03" title="Verifier evidence beats copied pixels" lead="Assume the attacker can build a polished real-time phishing site and relay passwords or OTPs." />
          <div className="phishing-grid">{phishingScenarios.map((scenario) => {
            const selected = phishingAnswers[scenario.id]; const answered = !!selected; const correct = answered && (selected === "phishing") === scenario.malicious;
            return <article className={`message-card ${answered ? (correct ? "is-correct" : "is-wrong") : ""}`} key={scenario.id}><div className="message-meta"><span>{scenario.id} · From</span><b>{scenario.sender}</b></div><h3>{scenario.subject}</h3><code>{scenario.url}</code><div className="choice-row"><button aria-pressed={selected === "legitimate"} onClick={() => choosePhishing(scenario.id, "legitimate")}>Legitimate</button><button aria-pressed={selected === "phishing"} onClick={() => choosePhishing(scenario.id, "phishing")}>Phishing</button></div>{answered && <p className="scenario-note"><strong>{correct ? "Correct decision." : "Incorrect decision."}</strong> {scenario.note}</p>}</article>;
          })}</div>
          <Checkpoint complete={moduleComplete(3)} enabled={allPhishingAnswered} onComplete={() => completeModule(3)}><strong>Checkpoint:</strong> record a decision for all four scenarios and review the domain/context rationale.</Checkpoint>
        </section>

        <section className="module module-accent" id="passkeys">
          <ModuleHeader number="04" eyebrow="MFA and passkeys · LO-04–LO-06" title="Replay resistance is not phishing resistance" lead="Threat assumptions: the attacker has a leaked password and may run a real-time adversary-in-the-middle phishing site." />
          <div className="comparison-wrap" role="region" aria-label="Authentication threat comparison" tabIndex={0}><table><thead><tr><th>Method</th><th>Replay resistance</th><th>Phishing resistance</th><th>Recovery / device risk</th><th>Usability / deployment assumption</th></tr></thead><tbody>{threatRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
          <div className="conceptual-lab"><div><div className="section-kicker">Default conceptual simulation</div><h3>A five-step passkey ceremony without creating a credential</h3><p>Use this simulation to learn the protocol safely. No browser authenticator is invoked.</p><button className="primary-button" onClick={() => setConceptStep((current) => Math.min(current + 1, conceptualSteps.length))}>{conceptStep === conceptualSteps.length ? "Conceptual ceremony complete" : `Reveal step ${conceptStep + 1}`}</button></div><ol>{conceptualSteps.map((step, index) => <li className={index < conceptStep ? "revealed" : ""} key={step}><span>{index + 1}</span>{index < conceptStep ? step : "Step hidden until requested"}</li>)}</ol></div>
          <div className="checkpoint-question"><p>What prevents a look-alike origin from obtaining a valid assertion for the legitimate service?</p><div className="choice-row">{["RP-ID / verifier-name binding", "a copied padlock icon", "monthly password rotation"].map((choice) => <button key={choice} aria-pressed={moduleFourCheckpoint === choice} onClick={() => setModuleFourCheckpoint(choice)}>{choice}</button>)}</div></div>
          <Checkpoint complete={moduleComplete(4)} enabled={conceptStep === conceptualSteps.length && moduleFourCheckpoint === "RP-ID / verifier-name binding"} onComplete={() => completeModule(4)}><strong>Checkpoint:</strong> finish the conceptual flow and identify origin/RP binding.</Checkpoint>

          <details className="webauthn-disclosure"><summary>Optional real browser WebAuthn API demonstration</summary><div className="webauthn-lab"><div><h3>This is not a production login system</h3><ul><li>A test credential may be created on this device for this origin.</li><li>The browser/authenticator performs local user verification; the website does not receive biometric data.</li><li>No production server persists a challenge or verifies the assertion signature.</li><li>Nothing is required for module completion, and cancellation is safe.</li><li>Syncable passkeys may synchronise protected key material through a platform ecosystem.</li></ul><label className="consent-check"><input type="checkbox" checked={webauthnConsent} onChange={(event) => setWebauthnConsent(event.target.checked)} />I understand these limits and choose to start the optional API demonstration.</label><div className="button-row"><button className="primary-button" onClick={runPasskeyRegistration} disabled={!webauthnConsent || passkeyBusy}>{passkeyBusy ? "Waiting…" : "Create non-discoverable demo credential"}</button><button className="secondary-button" onClick={runPasskeyAssertion} disabled={!webauthnConsent || !passkeyCredential || passkeyBusy}>Request demo assertion</button></div></div><div className="protocol-log" aria-live="polite">{passkeyLog.length ? passkeyLog.map((line) => <p key={line}>{line}</p>) : <p>No API operation has been requested. The conceptual activity above is the default.</p>}</div></div></details>
          <div className="lesson-callout caution"><span>Precise claim</span>Verifier-name/RP-ID binding makes WebAuthn phishing-resistant under the stated assumptions. It does not make accounts invulnerable to endpoint compromise, unsafe recovery, malicious service logic or ecosystem failure.</div>
        </section>

        {completed === 4 && !session.postTest.submitted && <div id="post-test"><QuizForm formId="B" questions={FORM_B} onSubmit={(answers, confidence) => submitTest("B", FORM_B, answers, confidence)} /></div>}
        {session.postTest.submitted && <PostTestReview session={session} />}

        <section className="module video-section" id="demo-video"><div><div className="section-kicker">Demonstration video</div><h2>Watch the complete learning journey</h2><p className="section-lead">Use the full 96-second version outside the five-minute talk, or the separately prepared 25-second silent clip during the presentation. English captions are enabled by default.</p></div><video controls preload="metadata" poster="/og.png"><source src="/authlab-demo.mp4" type="video/mp4" /><track kind="captions" src="/authlab-demo.en.vtt" srcLang="en" label="English" default />Your browser does not support embedded video.</video></section>

        <section className="results" id="results">
          <div><div className="section-kicker">De-identified learning record</div><h2>Export only what the evaluation needs</h2><p>Records stay in this browser, expire after 30 days and are never uploaded by AuthLab. Exact timestamps are omitted from exports.</p></div>
          <div className="result-metrics"><div><span>Form A</span><strong>{showAssessmentResults ? `${preScore} / 6` : "Hidden"}</strong></div><div><span>Form B</span><strong>{showAssessmentResults ? `${postScore} / 6` : "—"}</strong></div><div><span>Change</span><strong>{scoreChange === null ? "—" : `${scoreChange >= 0 ? "+" : ""}${scoreChange}`}</strong></div><div><span>Modules</span><strong>{completed} / 4</strong></div></div>
          <div className="feedback-box">
            <fieldset className="rating-field" role="radiogroup" aria-label="Usefulness rating"><legend>How useful was this activity?</legend><div className="rating-row">{[1, 2, 3, 4, 5].map((rating) => <label key={rating}><input type="radio" name="usefulness" checked={session.usefulnessRating === rating} onChange={() => updateSession({ usefulnessRating: rating })} /><span>{rating}</span></label>)}</div></fieldset>
            <label>Optional feedback — do not include names, contact details, account identifiers or other personal information<textarea value={session.feedbackComment} maxLength={500} onChange={(event) => updateSession({ feedbackComment: event.target.value })} placeholder="What became clearer? What remains confusing?" /></label>
          </div>
          <div className="export-row"><button className="primary-button" disabled={!session.postTest.submitted} onClick={() => downloadRecord("csv")}>Export safe CSV</button><button className="secondary-button" disabled={!session.postTest.submitted} onClick={() => downloadRecord("json")}>Export JSON</button><button className="text-button danger-button" onClick={clearSession}>Delete local session</button></div>
          <p className="data-note">CSV strings are quoted and neutralised when their first non-whitespace character could trigger a spreadsheet formula. Exports include item/scenario IDs, objective mappings, selected answers, correctness, subjective confidence, rounded duration and activity version.</p>
        </section>

        <section className="resources"><div><div className="section-kicker">Teaching package</div><h2>Resources and primary references</h2></div><div className="download-list"><a href="/downloads/AuthLab_Learner_Workbook.pdf" download><span>PDF</span><b>Learner workbook</b><small>Form A, activities, Form B and reflection—no answer key</small></a><a href="/downloads/AuthLab_Facilitator_Guide.pdf" download><span>PDF</span><b>Facilitator guide</b><small>Consent, timing, answers, rationales and evaluation protocol</small></a><a href="/downloads/Report-zID.pdf" download><span>PDF</span><b>Project report</b><small>Research, implementation, verification and limitations</small></a><a href="/downloads/AuthLab_Presentation.pptx" download><span>PPTX</span><b>Five-minute presentation</b><small>Editable slides with speaker notes and Q&amp;A backup</small></a><a href="/downloads/AuthLab_Presentation.pdf" download><span>PDF</span><b>Presentation handout</b><small>Fifteen-slide rendering, including backup Q&amp;A</small></a><a href="/authlab-demo.mp4" download><span>MP4</span><b>Selectable-caption video</b><small>96-second narrated protocol walkthrough</small></a><a href="/downloads/AuthLab_Demo_Open_Captions.mp4" download><span>MP4</span><b>Open-caption video</b><small>Captions permanently visible for compatible playback</small></a><a href="/downloads/AuthLab_Presentation_Clip_25s.mp4" download><span>MP4</span><b>Presentation clip</b><small>25-second silent excerpt for the five-minute talk</small></a></div><ol className="source-list">{sources.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{label}</a></li>)}</ol></section>

        <footer><div className="wordmark"><span aria-hidden="true">A/</span> AuthLab</div><p>COMP6441 educational project · Activity v{ACTIVITY_VERSION} · No analytics or learning-record transmission</p><a href="#top">Back to top ↑</a></footer>
      </main>
    </>
  );
}
