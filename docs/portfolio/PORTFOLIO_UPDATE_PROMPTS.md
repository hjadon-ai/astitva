# Prompts for updating the Portfolio application

Prepared October 4, 2026. Run these prompts in /Users/harendrakumar/Developer/Portfolio, preferably in order. This is the separate portfolio application, not Astitva's placeholder public page. These prompts authorize local portfolio changes only; they do not authorize deployment, Git pushes, production actions, or changes to Astitva/iOS.

The source report is /Users/harendrakumar/Developer/Astitva/docs/portfolio/ASTITVA_ENGINEERING_REPORT.md. It describes a dated working-source audit, including uncommitted work. A polished public case study should lead with engineering decisions and use statistics sparingly.

## Prompt 1: Add the Astitva case study to shared content

```text
Work in /Users/harendrakumar/Developer/Portfolio. Read applicable AGENTS.md/INSTRUCTIONS.md files, README.md, src/types.ts, src/App.tsx, and src/data/portfolio.json. Read /Users/harendrakumar/Developer/Astitva/docs/portfolio/ASTITVA_ENGINEERING_REPORT.md as the factual source. Treat the Astitva and Astitva-IOS repositories as read-only. Do not read private environment files or credentials.

Implement an Astitva case study in this portfolio. Preserve unrelated changes and existing career achievements. Reuse the existing CaseStudy schema and one stable master ID, astitva. Add it to content.caseStudies exactly once. Reuse the existing card/detail presentation. Classify it clearly as an independent personal project, with period “2026–Present,” category “Full-stack and AI-assisted engineering,” and organization “Independent project.” Check existing content before creating anything, so rerunning this prompt updates rather than duplicates the entry.

Describe a personal/family workspace combining React/Vite, Express, MongoDB, Plaid financial-account aggregation, diet tracking, daily priorities, family graph/sharing permissions, and alias-based PIN-protected Firestore chat. Describe the SwiftUI client as partially implemented/in development. Explain the server-controlled authorization boundary, normalized financial persistence/encrypted provider tokens, atomic priority limits, and specification-driven Codex workflow. Keep the writing practical and readable by recruiters and engineers.

Use this outcome: “Implemented a multi-domain personal workspace and a partial native iOS client, with documented API contracts, access controls, integration workflows, and a human-directed AI coding process.” Do not invent users, revenue, adoption, reliability, performance, time savings, or productivity metrics. Do not say AI independently built the product. Do not claim full iOS parity, end-to-end encryption, guaranteed push delivery, or verified current production availability. Browser background notifications remain unfinished local work; omit them from shipped-capability copy. Numeric repository measurements, if used, must say “working-source audit, October 4, 2026,” and must not imply deployment.

Reference the stable astitva ID in the existing master, architect, engineer, and manager versions using their actual IDs. Preserve existing featuredCaseStudyId values unless a later prompt explicitly changes them. Do not create duplicate case studies for each role. Add technology labels only where supported by the report. No absolute filesystem paths should appear in public copy.

Run npm run build and resolve issues introduced by these changes. Report files changed, the final case-study copy, and verification. Do not commit, push, or deploy.
```

## Prompt 2: Update AI practice, skills, and certification wording

```text
Work in /Users/harendrakumar/Developer/Portfolio. Read applicable instructions, README.md, src/types.ts, src/data/portfolio.json, and the Astitva engineering report at /Users/harendrakumar/Developer/Astitva/docs/portfolio/ASTITVA_ENGINEERING_REPORT.md. Treat the source application repositories as read-only.

Update the existing content.ai.intro and content.ai.practices, the AI skill group, and the existing AI achievement to reflect hands-on Codex-assisted engineering. Reuse existing IDs and schema; preserve supported experience with Copilot, ChatGPT, Claude Code, and MCP without implying Astitva implemented MCP or product LLM functionality.

Lead with: “I use AI coding agents as part of a human-directed engineering workflow: translating requirements into scoped specifications, providing architecture and repository context, reviewing implementation, debugging behavior, and verifying changes.” Add concise practices covering prompt engineering, context engineering, architecture-driven prompting, requirements decomposition, approved feature specifications, scoped agent instructions, iterative debugging/refactoring, API/documentation maintenance, and review/delivery controls. Use Astitva as a concrete example, with clear responsibility for architecture, tradeoffs, and review. Avoid presenting prompt writing as a substitute for software engineering.

Keep the existing GitHub Copilot certification separate from project skills. Retain its owner-supplied credential fields; do not invent an issuer, date, credential URL, or verification status. Mention any credential wording that needs owner verification in the final report, without blocking unrelated implementation.

Do not claim model training, AI research, RAG, fine-tuning, quantified productivity gains, or autonomous development. Keep existing professional achievements and role summaries intact except for focused AI-practice additions. Ensure updates remain compatible with the local content editor and all role versions. Run npm run build, fix introduced failures, and show the final AI copy. Do not commit, push, or deploy.
```

## Prompt 3: Tailor the role versions without duplicating facts

```text
Work in /Users/harendrakumar/Developer/Portfolio. Read applicable instructions, README.md, src/types.ts, src/App.tsx, and src/data/portfolio.json. Use /Users/harendrakumar/Developer/Astitva/docs/portfolio/ASTITVA_ENGINEERING_REPORT.md as the evidence for Astitva. Confirm the shared astitva case study exists before modifying role references; if absent, add it using the existing schema and factual limits in that report.

Refine the existing Master, Solution Architect, Principal / Staff Engineer, and Engineering Manager role versions to make the Astitva case study and AI practice discoverable. Use the actual role IDs in the JSON. Keep all shared facts in master content; role versions should reference IDs and adjust focus, summary, section order, and visibility using the existing schema. Do not copy the case study into multiple records or invent a role-specific override system unnecessarily.

Master: balance product breadth, hands-on implementation, architecture, and responsible AI practice.
Solution Architect: emphasize domain boundaries, MongoDB/Firestore responsibilities, provider abstraction, permissions, native/API compatibility, and environment isolation.
Principal / Staff Engineer: emphasize atomic invariants, idempotent request handling in local F032, stale-response protection, integration lifecycle, and reusable UI/domain structure. Clearly qualify local notification work rather than presenting it as deployed.
Engineering Manager: emphasize specification/review discipline, agent authority boundaries, acceptance criteria, delivery controls, and verification transparency. Astitva is a personal project; do not imply a team was managed on it. Preserve professional team-leadership evidence from the existing career entries.

Retain the portfolio's emphasis on established career accomplishments. Do not replace every featured case study with Astitva or inflate personal-project claims. Keep all referenced IDs valid and avoid duplicated content. Run npm run build and inspect all four views if a browser is available. Report final role changes and actual checks. Do not commit, push, or deploy.
```

## Prompt 4: Add a readable Astitva engineering deep dive

```text
Work in /Users/harendrakumar/Developer/Portfolio. Read applicable instructions, README.md, src/App.tsx, src/types.ts, the current styles/content, and /Users/harendrakumar/Developer/Astitva/docs/portfolio/ASTITVA_ENGINEERING_REPORT.md. Preserve the frontend-only architecture and the shared-content/local-editor model.

Add a public engineering deep dive reachable from the Astitva case study. First inspect the existing navigation/detail pattern and reuse it. If the app has no detail route, implement the smallest accessible detail-view/navigation extension consistent with its design; do not add a router package solely for this page. Keep one canonical Astitva entry and avoid embedding the entire private audit or filesystem paths in public content. If content/schema fields are needed, update types, defaults, import validation, role references, and the local editor together so the master-content workflow continues to work.

The page should explain: the user problem; independent project ownership; implemented capability overview; a simple accessible text/SVG architecture diagram; three engineering decisions (primary MongoDB plus bounded Firestore chat, Plaid normalization/token encryption, atomic per-day priority limits); human-directed Codex workflow; verification/limitations; and next steps. Explain why each decision matters. Explicitly state partial iOS coverage and unfinished local browser notifications. Treat F032 send idempotency/FCM as local implementation, not deployed proof.

Optionally show a small dated measurement block: 78 registered REST operations including one retired 410 route, 22 model definitions, 20 features marked Done including infrastructure/UI and local F032, and approximately 13,700 physical lines across application source/tests. Label it “Working-source audit • October 4, 2026.” Do not present test declarations as passing tests or documentation presence as validated contracts. Prefer engineering explanations over code-volume marketing.

Use the portfolio's typography, spacing, colors, responsive behavior, keyboard focus, and dark-mode behavior where already supported. No new analytics, tracking, external fonts, dependency installs, or contact data are needed. Add no unverified GitHub repository URL; use the existing public app link only if appropriate, with no claim that all described local work is live. Run npm run build and check mobile/desktop navigation, readability, and keyboard access when browser tools are available. Report exact checks and limitations. Do not commit, push, or deploy.
```

## Prompt 5: Perform a factual and presentation review

```text
Work in /Users/harendrakumar/Developer/Portfolio. Read applicable instructions and inspect the Astitva case study, AI section, skills, credentials, role versions, and any engineering deep dive against /Users/harendrakumar/Developer/Astitva/docs/portfolio/ASTITVA_ENGINEERING_REPORT.md. Treat Astitva/iOS as read-only, and do not inspect credentials or private user data.

Review and fix factual overstatements, inconsistent shared/role content, broken IDs/links, duplicate entries, inaccessible controls, and layout problems introduced by the portfolio update. Check that personal-project and professional-team claims are distinguished; AI is described as an engineering assistant under human direction; iOS is partial; anonymous chat means aliases, not operator anonymity/end-to-end encryption; browser push is unfinished; F032 is local work; and deployment/test claims match recorded evidence. Preserve established career metrics attributable to other projects.

Ensure certification wording is retained as owner-supplied unless independently verified evidence is already provided. Remove private filesystem paths, secrets, private account data, and invented repository links from public content. Check that master JSON, local editor/import/export, and four role views remain consistent. Run npm run build. If browser tools are available, inspect desktop and narrow layouts, navigation/back behavior, keyboard focus, and printable/readable detail content. Do not claim checks that were not run.

Make necessary local fixes and report final portfolio wording, actual verification, and any evidence questions requiring owner attention. Do not commit, push, deploy, send messages, or modify the source applications.
```

## Optional prompt: Generate resume text from the final portfolio

```text
Read the final Portfolio shared content and /Users/harendrakumar/Developer/Astitva/docs/portfolio/ASTITVA_ENGINEERING_REPORT.md. Do not modify files. Produce a 45–65-word Astitva project description, three concise resume bullets, a 25-word AI-assisted engineering statement, and role-specific versions for Solution Architect and Principal / Staff Engineer. Use only supported facts. Keep the project independent/personal, the SwiftUI client partial, and Codex human-directed. Omit code-volume metrics unless they help the audience; never invent impact, users, productivity gains, production readiness, or autonomous authorship. Keep GitHub Copilot certification as a separate credential, using the supplied exact wording without claiming independent verification.
```
