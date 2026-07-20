"use client";

import { useEffect, useMemo, useState } from "react";

type QuizAnswer = Record<string, number>;
type Stage = "pre" | "post";

type SessionData = {
  sessionId: string;
  startedAt: string;
  preScore: number | null;
  postScore: number | null;
  completedModules: number[];
  phishingScore: number;
  feedbackRating: number | null;
  feedbackComment: string;
};

const STORAGE_KEY = "authlab-learning-session-v1";

const quizQuestions = [
  {
    id: "identity",
    prompt: "Which statement best separates identity, authentication and authorisation?",
    options: [
      "Identity is a claim, authentication proves it, and authorisation decides access",
      "Authentication creates an identity and authorisation proves a password",
      "The three terms describe the same login step",
    ],
    answer: 0,
  },
  {
    id: "reuse",
    prompt: "Why can one breached password compromise accounts on unrelated sites?",
    options: [
      "Browsers automatically share every password",
      "Attackers automate reused username-password pairs across many services",
      "Encryption stops working after a breach",
    ],
    answer: 1,
  },
  {
    id: "url",
    prompt: "What part of a login URL should you verify before entering a credential?",
    options: [
      "The page colours",
      "The registered domain and HTTPS connection",
      "Whether the page has a company logo",
    ],
    answer: 1,
  },
  {
    id: "mfa",
    prompt: "Which statement about MFA is accurate?",
    options: [
      "Every form of MFA is phishing-resistant",
      "MFA reduces risk, but OTPs and push approvals can still be relayed or abused",
      "MFA removes the need for account recovery controls",
    ],
    answer: 1,
  },
  {
    id: "passkey",
    prompt: "Why does a passkey resist a conventional fake-site phishing page?",
    options: [
      "The browser binds the credential to the relying party domain",
      "The user types a longer secret",
      "The private key is emailed to the server",
    ],
    answer: 0,
  },
  {
    id: "server",
    prompt: "What does a service store for a passkey sign-in?",
    options: [
      "The user's biometric template",
      "A reusable copy of the private key",
      "A public key and credential metadata used to verify signatures",
    ],
    answer: 2,
  },
];

const phishingScenarios = [
  {
    id: "clean",
    sender: "IT Service Desk <support@example.edu>",
    subject: "Security key registration is now available",
    url: "https://accounts.example.edu/security-keys",
    note: "The registered domain is example.edu and the path is plausible.",
    malicious: false,
  },
  {
    id: "subdomain-trick",
    sender: "Campus Account Team <urgent@account-notice.example.net>",
    subject: "Your mailbox closes in 20 minutes",
    url: "https://example.edu.verify-login.example.net/session",
    note: "The registered domain is example.net; example.edu only appears in a subdomain.",
    malicious: true,
  },
  {
    id: "lookalike",
    sender: "Library Access <service@examp1e.edu>",
    subject: "Re-authenticate to keep journal access",
    url: "https://examp1e.edu/library-login",
    note: "The digit 1 replaces the letter l in a lookalike domain.",
    malicious: true,
  },
  {
    id: "known-route",
    sender: "Learning Platform <no-reply@learn.example.edu>",
    subject: "New assessment feedback",
    url: "https://learn.example.edu/courses/6441/feedback",
    note: "The registered domain remains example.edu and the service is on its expected subdomain.",
    malicious: false,
  },
];

const comparisonRows = [
  ["Password", "High", "High", "N/A", "Shared secret"],
  ["SMS OTP", "Medium", "High", "Low", "Code can be relayed"],
  ["Authenticator OTP", "Low", "High", "Low", "Code can be relayed"],
  ["Push approval", "Low", "Medium", "High", "Fatigue / session relay"],
  ["Passkey (WebAuthn)", "Low", "Low", "Low", "Origin-bound public key"],
];

const sources = [
  {
    label: "NIST SP 800-63B-4: Authentication and Authenticator Management",
    url: "https://pages.nist.gov/800-63-4/sp800-63b.html",
  },
  {
    label: "W3C Web Authentication: Level 3",
    url: "https://www.w3.org/TR/webauthn-3/",
  },
  {
    label: "FIDO Alliance: Passkeys",
    url: "https://fidoalliance.org/passkeys/",
  },
  {
    label: "OWASP: Credential Stuffing",
    url: "https://owasp.org/www-community/attacks/Credential_stuffing",
  },
  {
    label: "CISA: Phishing guidance",
    url: "https://www.cisa.gov/sites/default/files/2025-03/Phishing%20Guidance%20-%20Stopping%20the%20Attack%20Cycle%20at%20Phase%20One%20508.pdf",
  },
];

const blankSession = (): SessionData => ({
  sessionId: crypto.randomUUID?.() ?? `session-${Date.now()}`,
  startedAt: new Date().toISOString(),
  preScore: null,
  postScore: null,
  completedModules: [],
  phishingScore: 0,
  feedbackRating: null,
  feedbackComment: "",
});

function scoreQuiz(answers: QuizAnswer) {
  return quizQuestions.reduce(
    (score, question) => score + (answers[question.id] === question.answer ? 1 : 0),
    0,
  );
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function Quiz({
  stage,
  onComplete,
}: {
  stage: Stage;
  onComplete: (score: number) => void;
}) {
  const [answers, setAnswers] = useState<QuizAnswer>({});
  const [submitted, setSubmitted] = useState(false);
  const score = scoreQuiz(answers);

  return (
    <section className="quiz-shell" aria-labelledby={`${stage}-test-title`}>
      <div className="section-kicker">{stage === "pre" ? "Baseline" : "Check your learning"}</div>
      <h2 id={`${stage}-test-title`}>
        {stage === "pre" ? "Take the six-question pre-test" : "Take the same test again"}
      </h2>
      <p className="section-lead">
        {stage === "pre"
          ? "Use your current knowledge. Your result stays in this browser and is not sent anywhere."
          : "A repeated test makes the change easy to compare. Review explanations after submitting."}
      </p>
      <div className="quiz-list">
        {quizQuestions.map((question, index) => (
          <fieldset key={question.id} className="quiz-question">
            <legend>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {question.prompt}
            </legend>
            {question.options.map((option, optionIndex) => {
              const selected = answers[question.id] === optionIndex;
              const isCorrect = submitted && optionIndex === question.answer;
              const isWrong = submitted && selected && optionIndex !== question.answer;
              return (
                <label
                  key={option}
                  className={`answer-row ${selected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                >
                  <input
                    type="radio"
                    name={`${stage}-${question.id}`}
                    checked={selected}
                    disabled={submitted}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      {!submitted ? (
        <button
          className="primary-button"
          disabled={Object.keys(answers).length !== quizQuestions.length}
          onClick={() => {
            setSubmitted(true);
            onComplete(score);
          }}
        >
          Score my {stage === "pre" ? "pre-test" : "post-test"}
        </button>
      ) : (
        <div className="score-reveal" role="status">
          <strong>{score} / {quizQuestions.length}</strong>
          <span>Correct answers are highlighted in green.</span>
        </div>
      )}
    </section>
  );
}

function ModuleHeader({ number, eyebrow, title, lead }: { number: string; eyebrow: string; title: string; lead: string }) {
  return (
    <header className="module-header">
      <div className="module-number" aria-hidden="true">{number}</div>
      <div>
        <div className="section-kicker">{eyebrow}</div>
        <h2>{title}</h2>
        <p className="section-lead">{lead}</p>
      </div>
    </header>
  );
}

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [identityChoice, setIdentityChoice] = useState<string | null>(null);
  const [stuffingRun, setStuffingRun] = useState(false);
  const [phishingAnswers, setPhishingAnswers] = useState<Record<string, boolean>>({});
  const [phishingExplanations, setPhishingExplanations] = useState<Record<string, boolean>>({});
  const [passkeyCredential, setPasskeyCredential] = useState<PublicKeyCredential | null>(null);
  const [passkeyLog, setPasskeyLog] = useState<string[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setSession(JSON.parse(saved));
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setSession(blankSession());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session || !window.location.hash) return;
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [session]);

  const completed = session?.completedModules.length ?? 0;
  const progress = session?.postScore !== null ? 100 : session?.preScore !== null ? 12 + completed * 20 : 0;
  const improvement = useMemo(() => {
    if (session?.preScore === null || session?.postScore === null || !session) return null;
    return session.postScore - session.preScore;
  }, [session]);

  const updateSession = (patch: Partial<SessionData>) => {
    setSession((current) => (current ? { ...current, ...patch } : current));
  };

  const completeModule = (module: number) => {
    setSession((current) => {
      if (!current || current.completedModules.includes(module)) return current;
      return { ...current, completedModules: [...current.completedModules, module].sort() };
    });
  };

  const runPasskeyRegistration = async () => {
    if (!("PublicKeyCredential" in window) || !navigator.credentials) {
      setPasskeyLog(["This browser does not expose the WebAuthn API."]);
      return;
    }
    setPasskeyBusy(true);
    setPasskeyLog(["Generated a fresh 32-byte challenge in this browser."]);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "AuthLab", id: window.location.hostname },
          user: { id: userId, name: "demo@example.test", displayName: "Demo Learner" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
          },
          timeout: 60000,
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("No credential returned");
      const response = credential.response as AuthenticatorAttestationResponse;
      setPasskeyCredential(credential);
      setPasskeyLog([
        "Authenticator created an origin-bound public-key credential.",
        `Credential ID: ${bytesToBase64Url(credential.rawId).slice(0, 28)}…`,
        `Authenticator attachment: ${credential.authenticatorAttachment ?? "not reported"}`,
        `Transports: ${response.getTransports?.().join(", ") || "not reported"}`,
        "Private key remained inside the authenticator; this page received only public metadata.",
      ]);
      completeModule(4);
    } catch (error) {
      setPasskeyLog([
        error instanceof Error && error.name === "NotAllowedError"
          ? "Ceremony cancelled or timed out. No credential was created."
          : `Ceremony stopped: ${error instanceof Error ? error.message : "unknown error"}`,
      ]);
    } finally {
      setPasskeyBusy(false);
    }
  };

  const runPasskeyAssertion = async () => {
    if (!passkeyCredential) return;
    setPasskeyBusy(true);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{ type: "public-key", id: passkeyCredential.rawId }],
          userVerification: "preferred",
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (!assertion) throw new Error("No assertion returned");
      const response = assertion.response as AuthenticatorAssertionResponse;
      const clientData = JSON.parse(new TextDecoder().decode(response.clientDataJSON));
      setPasskeyLog([
        "Authenticator signed a new one-time challenge.",
        `Client data type: ${clientData.type}`,
        `Origin checked by browser: ${clientData.origin}`,
        `Authenticator data: ${response.authenticatorData.byteLength} bytes`,
        `Signature: ${response.signature.byteLength} bytes`,
        "A production server must now validate origin, RP ID hash, flags, challenge and signature.",
      ]);
    } catch (error) {
      setPasskeyLog([
        error instanceof Error && error.name === "NotAllowedError"
          ? "Authentication cancelled or timed out."
          : `Assertion stopped: ${error instanceof Error ? error.message : "unknown error"}`,
      ]);
    } finally {
      setPasskeyBusy(false);
    }
  };

  const exportResults = (format: "json" | "csv") => {
    if (!session) return;
    const safeComment = session.feedbackComment.replace(/[\r\n]+/g, " ").slice(0, 500);
    const record = {
      session_id: session.sessionId,
      started_at: session.startedAt,
      exported_at: new Date().toISOString(),
      pre_score: session.preScore,
      post_score: session.postScore,
      score_change: improvement,
      completed_modules: session.completedModules.join(";"),
      phishing_score: session.phishingScore,
      feedback_rating: session.feedbackRating,
      feedback_comment: safeComment,
      privacy_note: "Device-local anonymous learning record; no credentials collected",
    };
    const content = format === "json"
      ? JSON.stringify(record, null, 2)
      : `${Object.keys(record).join(",")}\n${Object.values(record).map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")}\n`;
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `authlab-${session.sessionId.slice(0, 8)}.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!session) return <main className="loading-screen">Preparing your private learning session…</main>;

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="AuthLab home">
          <span aria-hidden="true">A/</span> AuthLab
        </a>
        <nav aria-label="Course sections">
          <a href="#learn">Learn</a>
          <a href="#phishing">Phishing</a>
          <a href="#passkeys">Passkeys</a>
          <a href="#results">Results</a>
        </nav>
        <div className="privacy-label">Local-only session</div>
      </header>

      <div className="progress-track" aria-label={`Course progress ${progress}%`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="hero-eyebrow">Interactive security engineering guide</p>
          <h1>Stop memorising login advice. See the system behind it.</h1>
          <p>
            Explore how identity is proved, how phishing steals reusable secrets, where MFA breaks,
            and why passkeys change the protocol—not just the user interface.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href={session.preScore === null ? "#pre-test" : "#learn"}>
              {session.preScore === null ? "Start with the pre-test" : "Continue the lab"}
            </a>
            <span>No real usernames, passwords or MFA codes are requested.</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Authentication model">
          <div className="signal-row"><span>Claim</span><b>“I am the account owner”</b></div>
          <div className="signal-arrow">↓</div>
          <div className="signal-row active"><span>Proof</span><b>Password, MFA or passkey</b></div>
          <div className="signal-arrow">↓</div>
          <div className="signal-row"><span>Decision</span><b>Allow only the intended action</b></div>
          <div className="protocol-chip">protocol + people + recovery</div>
        </div>
      </section>

      <section className="promise-strip" aria-label="Learning outcomes">
        <div><strong>4</strong><span>learning modules</span></div>
        <div><strong>6 + 6</strong><span>pre/post questions</span></div>
        <div><strong>1</strong><span>real WebAuthn ceremony</span></div>
        <div><strong>0</strong><span>credentials collected</span></div>
      </section>

      <div id="pre-test">
        {session.preScore === null ? (
          <Quiz stage="pre" onComplete={(score) => updateSession({ preScore: score })} />
        ) : (
          <section className="baseline-complete">
            <span>Baseline saved locally</span>
            <strong>{session.preScore} / {quizQuestions.length}</strong>
            <a href="#learn">Begin module 1 ↓</a>
          </section>
        )}
      </div>

      <section className="module" id="learn">
        <ModuleHeader
          number="01"
          eyebrow="Identity engineering"
          title="A login is three decisions, not one"
          lead="Confusing identity, authentication and authorisation produces systems that prove the wrong thing or grant too much access."
        />
        <div className="identity-grid">
          {[
            ["identity", "Identity", "The claim", "A record says Alex owns account 1042."],
            ["authentication", "Authentication", "The proof", "Alex demonstrates control of an accepted authenticator."],
            ["authorisation", "Authorisation", "The permission", "Policy lets account 1042 read one course, not the admin console."],
          ].map(([id, title, label, copy]) => (
            <button
              className={`identity-step ${identityChoice === id ? "chosen" : ""}`}
              key={id}
              onClick={() => {
                setIdentityChoice(id);
                if (id === "authorisation") completeModule(1);
              }}
            >
              <span>{label}</span>
              <strong>{title}</strong>
              <p>{copy}</p>
            </button>
          ))}
        </div>
        <div className="lesson-callout">
          <span>Engineering takeaway</span>
          Authentication is a protocol for proving control—not proof that a person is honest, authorised for every action, or safe forever.
        </div>
      </section>

      <section className="module module-dark" id="passwords">
        <ModuleHeader
          number="02"
          eyebrow="Password failure modes"
          title="Reuse turns one breach into a supply chain"
          lead="Credential stuffing does not guess a new password. It replays a known username-password pair against other services at machine speed."
        />
        <div className="stuffing-lab">
          <div className="breach-source">
            <span>Dummy breach record</span>
            <code>learner@example.test : correct-horse-demo</code>
            <button className="light-button" onClick={() => { setStuffingRun(true); completeModule(2); }}>
              Run credential-stuffing simulation
            </button>
          </div>
          <div className="reuse-results" aria-live="polite">
            {[
              ["StudySpace", true],
              ["PhotoCloud", false],
              ["TicketBox", true],
            ].map(([service, reused]) => (
              <div key={String(service)} className={stuffingRun ? (reused ? "compromised" : "blocked") : "pending"}>
                <span>{String(service)}</span>
                <b>{stuffingRun ? (reused ? "Account takeover" : "Unique password blocked replay") : "Waiting"}</b>
              </div>
            ))}
          </div>
        </div>
        <p className="technical-note">
          This is a non-networked simulation using dummy data. In a real system, rate limiting, breached-password blocklists,
          password managers, anomaly detection and phishing-resistant authenticators reduce different parts of the risk.
        </p>
      </section>

      <section className="module" id="phishing">
        <ModuleHeader
          number="03"
          eyebrow="Phishing and impersonation"
          title="Read the registered domain from right to left"
          lead="Logos, padlocks and polished layouts can be copied. The origin is the security boundary that a fake page cannot simply choose."
        />
        <div className="phishing-grid">
          {phishingScenarios.map((scenario) => {
            const answered = Object.prototype.hasOwnProperty.call(phishingAnswers, scenario.id);
            const choice = phishingAnswers[scenario.id];
            const correct = answered && choice === scenario.malicious;
            return (
              <article className={`message-card ${answered ? (correct ? "is-correct" : "is-wrong") : ""}`} key={scenario.id}>
                <div className="message-meta"><span>From</span><b>{scenario.sender}</b></div>
                <h3>{scenario.subject}</h3>
                <code>{scenario.url}</code>
                <div className="choice-row">
                  <button onClick={() => {
                    const next = { ...phishingAnswers, [scenario.id]: false };
                    setPhishingAnswers(next);
                    setPhishingExplanations((current) => ({ ...current, [scenario.id]: true }));
                    const score = phishingScenarios.reduce((sum, item) => sum + (next[item.id] === item.malicious ? 1 : 0), 0);
                    updateSession({ phishingScore: score });
                    if (Object.keys(next).length === phishingScenarios.length) completeModule(3);
                  }}>Legitimate</button>
                  <button onClick={() => {
                    const next = { ...phishingAnswers, [scenario.id]: true };
                    setPhishingAnswers(next);
                    setPhishingExplanations((current) => ({ ...current, [scenario.id]: true }));
                    const score = phishingScenarios.reduce((sum, item) => sum + (next[item.id] === item.malicious ? 1 : 0), 0);
                    updateSession({ phishingScore: score });
                    if (Object.keys(next).length === phishingScenarios.length) completeModule(3);
                  }}>Phishing</button>
                </div>
                {phishingExplanations[scenario.id] && (
                  <p className="scenario-note"><strong>{correct ? "Correct." : "Look again."}</strong> {scenario.note}</p>
                )}
              </article>
            );
          })}
        </div>
        <div className="score-inline">Phishing exercise: <strong>{session.phishingScore} / {phishingScenarios.length}</strong></div>
      </section>

      <section className="module module-accent" id="passkeys">
        <ModuleHeader
          number="04"
          eyebrow="MFA and passkeys"
          title="More factors do not always mean phishing resistance"
          lead="OTPs and push prompts improve a password-only flow, but an attacker-controlled page can still relay a code or pressure a user to approve."
        />
        <div className="comparison-wrap" role="region" aria-label="Authentication threat comparison" tabIndex={0}>
          <table>
            <thead><tr><th>Method</th><th>Credential stuffing</th><th>Real-time phishing</th><th>Fatigue</th><th>Security property</th></tr></thead>
            <tbody>
              {comparisonRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell} data-label={index === 0 ? "Method" : undefined}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>

        <div className="passkey-flow" aria-label="Passkey authentication flow">
          {[
            ["1", "Server", "Sends a fresh challenge"],
            ["2", "Browser", "Checks the relying party origin"],
            ["3", "Authenticator", "Unlocks the private key locally"],
            ["4", "Signature", "Signs this challenge for this RP"],
            ["5", "Server", "Verifies using the stored public key"],
          ].map(([number, title, copy]) => <div key={number}><span>{number}</span><b>{title}</b><p>{copy}</p></div>)}
        </div>

        <div className="webauthn-lab">
          <div>
            <div className="section-kicker">Live WebAuthn lab</div>
            <h3>Ask your own authenticator to create a demo credential</h3>
            <p>
              Optional and local to this site. Use a device PIN, biometric or security key if prompted.
              AuthLab never receives a biometric or private key. You can cancel safely.
            </p>
            <div className="button-row">
              <button className="primary-button" onClick={runPasskeyRegistration} disabled={passkeyBusy}>
                {passkeyBusy ? "Waiting for authenticator…" : "Create demo passkey"}
              </button>
              <button className="secondary-button" onClick={runPasskeyAssertion} disabled={!passkeyCredential || passkeyBusy}>
                Sign a fresh challenge
              </button>
              <button className="text-button" onClick={() => completeModule(4)}>
                Mark module reviewed
              </button>
            </div>
          </div>
          <div className="protocol-log" aria-live="polite">
            {passkeyLog.length ? passkeyLog.map((line) => <p key={line}>{line}</p>) : (
              <p>Protocol events will appear here. A production relying party must verify every assertion on its server.</p>
            )}
          </div>
        </div>
        <div className="lesson-callout caution">
          <span>Important limit</span>
          Passkeys protect the authentication ceremony. Secure enrolment, account recovery, session handling and compromised endpoints still require engineering controls.
        </div>
      </section>

      <section className="module video-section" id="demo-video">
        <div>
          <div className="section-kicker">90-second walkthrough</div>
          <h2>See the complete learning journey</h2>
          <p className="section-lead">
            This short demonstration is designed for the in-class presentation and can also be played from the hosted project site.
          </p>
        </div>
        <video controls preload="metadata" poster="/og.png">
          <source src="/authlab-demo.mp4" type="video/mp4" />
          <track kind="captions" src="/authlab-demo.en.vtt" srcLang="en" label="English" default />
          Your browser does not support embedded video. Download the video from the project evidence package.
        </video>
      </section>

      <div id="post-test">
        {completed === 4 && session.postScore === null && (
          <Quiz stage="post" onComplete={(score) => updateSession({ postScore: score })} />
        )}
      </div>

      <section className="results" id="results">
        <div>
          <div className="section-kicker">Private results</div>
          <h2>Your evidence belongs to you</h2>
          <p>
            Export a de-identified record for evaluation. The site stores progress only in your browser;
            nothing is uploaded automatically.
          </p>
        </div>
        <div className="result-metrics">
          <div><span>Pre-test</span><strong>{session.preScore ?? "—"} / 6</strong></div>
          <div><span>Post-test</span><strong>{session.postScore ?? "—"} / 6</strong></div>
          <div><span>Change</span><strong>{improvement === null ? "—" : `${improvement >= 0 ? "+" : ""}${improvement}`}</strong></div>
          <div><span>Modules</span><strong>{completed} / 4</strong></div>
        </div>
        <div className="feedback-box">
          <label>
            How useful was this activity?
            <span className="rating-row">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className={session.feedbackRating === rating ? "active" : ""}
                  onClick={() => updateSession({ feedbackRating: rating })}
                  aria-label={`${rating} out of 5`}
                >{rating}</button>
              ))}
            </span>
          </label>
          <label>
            Anonymous feedback (do not include names or contact details)
            <textarea
              value={session.feedbackComment}
              maxLength={500}
              onChange={(event) => updateSession({ feedbackComment: event.target.value })}
              placeholder="What became clearer? What was still confusing?"
            />
          </label>
        </div>
        <div className="export-row">
          <button className="primary-button" onClick={() => exportResults("csv")}>Export CSV</button>
          <button className="secondary-button" onClick={() => exportResults("json")}>Export JSON</button>
          <button className="text-button" onClick={() => {
            if (confirm("Reset this device-local learning session?")) {
              localStorage.removeItem(STORAGE_KEY);
              setSession(blankSession());
              setIdentityChoice(null);
              setStuffingRun(false);
              setPhishingAnswers({});
              setPhishingExplanations({});
              setPasskeyCredential(null);
              setPasskeyLog([]);
            }
          }}>Reset local data</button>
        </div>
      </section>

      <section className="resources">
        <div>
          <div className="section-kicker">Take it further</div>
          <h2>Teaching resources and technical references</h2>
        </div>
        <div className="download-list">
          <a href="/downloads/AuthLab_Workbook.pdf" download><span>PDF</span><b>Student workbook</b><small>Concept notes, activities and answer key</small></a>
          <a href="/downloads/Report-zID.pdf" download><span>PDF</span><b>Project report</b><small>Research, analysis, reflection and evidence boundary</small></a>
          <a href="/downloads/AuthLab_Presentation.pptx" download><span>PPTX</span><b>5-minute presentation</b><small>Editable slides with speaker notes</small></a>
          <a href="/downloads/AuthLab_Presentation.pdf" download><span>PDF</span><b>Presentation handout</b><small>Portable eight-slide version</small></a>
          <a href="/authlab-demo.mp4" download><span>MP4</span><b>Demonstration video</b><small>Presentation-ready walkthrough</small></a>
        </div>
        <ol className="source-list">
          {sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}
        </ol>
      </section>

      <footer>
        <div className="wordmark"><span aria-hidden="true">A/</span> AuthLab</div>
        <p>Educational project for COMP6441 · Dummy data only · No credential collection</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
