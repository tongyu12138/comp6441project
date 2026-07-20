# AuthLab: Passwords, Phishing and Passkeys

AuthLab is a client-side security learning activity for COMP6441. It is **not** an authentication service and does not protect a real account. Its purpose is to help a beginner distinguish identity, authentication and authorisation; reason about password reuse and credential stuffing; inspect phishing evidence; and explain why WebAuthn/passkeys can resist conventional phishing.

Public deployment: [AuthLab on Sites](https://authlab-passkeys-guide.valid-bread-2713.chatgpt.site)

## Learning design

The experience follows a measurable sequence:

1. Form A records a six-item baseline and subjective confidence without revealing a score or answer key.
2. Four modules teach identity layers, password reuse, phishing evidence and passkey/WebAuthn concepts.
3. Each module has an explicit completion checkpoint; opening a module does not count as completion.
4. Form B assesses the same six learning objectives with different scenarios.
5. Form B then reveals item-by-item explanations, distractor feedback and objective mappings.
6. The learner may export a de-identified local record for a facilitator or delete it from the device.

The two forms are parallel, not statistically validated equivalent instruments. Score change and subjective-confidence change are descriptive evidence only. No claim of learning effectiveness should be made without genuine participant records and an appropriate evaluation design.

## Learning objectives

- `LO-01`: distinguish identity, authentication and authorisation.
- `LO-02`: explain credential stuffing caused by password reuse.
- `LO-03`: use registered-domain, request-context and trusted-route evidence.
- `LO-04`: separate replay resistance from phishing resistance across MFA methods.
- `LO-05`: explain WebAuthn relying-party/verifier-name binding.
- `LO-06`: explain the public/private-key boundary and residual passkey risks.

## Privacy and security boundary

- No account, login, database, analytics service or record-upload endpoint is used.
- Progress is stored in browser `localStorage` under `authlab-learning-session-v2` and expires after 30 days.
- The random session code is de-identified, not guaranteed anonymous. Participants must not enter names, zIDs, email addresses or other identifying text.
- JSON/CSV exports omit exact timestamps and use a rounded duration bucket.
- CSV cells are escaped and leading spreadsheet-formula characters (`=`, `+`, `-`, `@`) are neutralised.
- The default passkey activity is conceptual. An optional browser WebAuthn demonstration requires explicit consent, uses a non-discoverable preference, receives no biometric or private key, and performs no server-side challenge persistence or signature verification. It must not be presented as production authentication.
- Production responses apply CSP, anti-framing, no-referrer, MIME-sniffing and permissions-policy headers in the Worker entry point.

## Local development

Requirements: Node.js `>=22.13.0` and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by vinext. No environment variables or database setup are required.

## Verification

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

`npm test` runs behavioural model tests, a production build and rendered-response tests. Coverage includes parallel-form mapping, scoring, rationales, versioned storage, deletion/expiry/reset paths, CSV injection edge cases, item-level export, WebAuthn status handling, source-level accessibility safeguards and deployed response headers. Verification output for a course submission should be retained separately from the source repository.

## Accessibility

The interface uses native buttons, links, fieldsets and radio inputs; explicit module checkpoints; a skip link; `aria-pressed` decision states; a labelled progressbar; non-colour correctness text; a keyboard-scrollable comparison table; mobile section navigation; visible focus styles; and reduced-motion rules. Final target-viewport and keyboard checks are recorded separately because automated source tests do not replace assistive-technology or user testing.

## Project structure

```text
app/                    interactive learning experience and styles
lib/authlab-model.ts    versioned questions, storage and export model
tests/                  behavioural and rendered-response checks
worker/index.ts         production Worker and security headers
public/                 site assets, teaching downloads and demonstration media
build/                  Sites build integration
```

## Evaluation workflow

1. Give the participant an institutionally approved information and consent sheet.
2. Ask them to complete the activity without entering identifying information.
3. If they agree to share a record, have them export JSON or CSV and transfer it by the approved course method.
4. Store raw records separately from any contact or consent administration.
5. Analyse genuine exports using an approved, version-matched analysis process.
6. Treat generated statistics as descriptive and verify data quality before reporting them.

No genuine participant exports are supplied in this repository. Developer tests and blank evaluation materials must not be mistaken for participant evidence.

## Known limitations

- Forms A/B target the same objectives but have not been calibrated as psychometrically equivalent.
- No delayed-retention test, production account system or server-side WebAuthn challenge/signature verification exists.
- Results can vary by browser/authenticator, and phishing scenarios simplify real organisational context.
- A device-local record can be inspected by someone with access to that browser profile; users should delete it on shared devices.
- No genuine participant evaluation record is bundled, so teaching effectiveness is not claimed.

## Deployment and sharing

The current public site is hosted through OpenAI Sites.

- Source repository: [github.com/tongyu12138/comp6441project](https://github.com/tongyu12138/comp6441project)
- Public learning site: [AuthLab on Sites](https://authlab-passkeys-guide.valid-bread-2713.chatgpt.site)

## Academic-integrity handoff

Before submission, the student must use their real name/zID in required assessment files, write their own personal reflection, verify course-specific consent and ethics expectations, insert only genuine participant results they are authorised to use, and confirm every public/download link.

## Generative AI acknowledgement

OpenAI Codex assisted with code review, refactoring, test generation, formatting, language editing and quality assurance. Security claims are checked against the primary sources cited in the report. Codex did not generate participant data, work hours or personal reflection. The student must review the final work, ensure it complies with current UNSW/COMP6441 policy, be able to explain it and accept responsibility for the submitted content.
