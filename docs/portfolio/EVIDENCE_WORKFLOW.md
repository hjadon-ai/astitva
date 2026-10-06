# Portfolio evidence and manual review

Astitva owns implementation evidence. Portfolio owns approved public presentation. This local workflow never calls an AI API, runs the application, reads environment/credential files, modifies the sibling applications, commits, pushes, or deploys.

## Destinations and common handoff

- Portfolio local directory: `/Users/harendrakumar/Developer/Portfolio`
- Repository: https://github.com/hjadon-ai/portfolio
- Hosted site: https://harendra-play.web.app/
- Evidence collector: `scripts/portfolio-evidence.py` (Python 3.9+, standard library only)
- Shared review packets: `docs/portfolio/progress/<snapshot-id>/`
- Reviewed-source checkpoint: `docs/portfolio/progress/checkpoint.json`

`packet.json` is authoritative: deterministic evidence plus separately drafted claims and your decisions. `REVIEW.md` is its readable rendering. Review edits belong in JSON and can be made by you or by Codex following your explicit instruction. Generating/rendering a packet never approves it or advances the checkpoint. Existing snapshot directories are preserved, not overwritten.

The initial checkpoint is deliberately null: there was no previously reviewed committed snapshot. The historical engineering report records an October 4 working-tree/iOS audit; it is not a committed baseline, newly executed validation, or deployment proof.

## 1. Collect an explicit committed snapshot

Run from the Astitva root. The first packet was generated from:

```sh
python3 scripts/portfolio-evidence.py collect --source 7b68364becd8a8de7415f2450c67bb26051d8932
```

That packet already exists, so repeating the command safely refuses to overwrite it. `--source HEAD` is also explicit; the collector resolves it to a full commit ID. It does not inspect the current working contents unless requested. It reads allowlisted regular Git blobs and ignores symlinks, environment files (including examples), credentials, fixtures, assets, dependency/build output, lock files, private tooling, and previous packet contents.

For later reviews, inspect checkpoint.json and supply its exact `last_reviewed_source_commit`:

```sh
python3 scripts/portfolio-evidence.py collect --source <new-source-commit> --previous <last-reviewed-source-commit>
```

The previous commit must be an ancestor of the source commit. The script does not silently substitute a checkpoint or infer a previous snapshot. If Git history was rewritten, resolve the baseline with the owner before collecting; do not fabricate ancestry or erase review history.

The deterministic section includes source/physical-line counts by language and area, static route/model/test declarations, feature-index rows, changed allowlisted paths, and commit subjects/dates without author emails. These are source observations, not runtime claims. Old baseline packets list the entire evidence inventory as Added because no earlier reviewed snapshot exists.

Snapshot identity is stable for the same collector schema, source commit, and previous commit. Generated date is recorded separately. The allowlist-content digest is included for auditability. Review artifacts are local Markdown/JSON; review them for confidentiality before ever sharing them publicly.

### Optional uncommitted evidence

```sh
python3 scripts/portfolio-evidence.py collect --source <source-commit> --working-tree
```

This adds a separately labeled working-tree section with its own digest and changed paths, including eligible untracked files. Source-commit statistics stay unchanged. A working-tree packet cannot advance the committed checkpoint. Commit the reviewed application work through the normal separately authorized workflow, then collect a committed snapshot if you want it in that checkpoint.

The collector does not scan Portfolio or iOS. Future native-delivery claims need a separately pinned iOS commit/snapshot. Historical iOS report content may be cited as context with its date and limitations, not silently refreshed as current evidence.

## 2. Ask Codex to interpret the evidence

Use this prompt after collecting:

```text
Read docs/portfolio/EVIDENCE_WORKFLOW.md and the specified packet.json/REVIEW.md:
<exact packet directory>

Use the recorded source_commit and previous_reviewed_commit. Inspect relevant
allowlisted files with git show at those commits, not current working files.
Never read environment files, credentials, fixtures, production records, or
private user data. Portfolio and iOS are read-only and outside this collector.

Preserve the deterministic evidence fields and any existing owner decisions.
Draft or refine claims only for meaningful supported changes. Each claim needs
id, title, source_commit, evidence_references (commit-scoped paths, optional
line numbers), what_changed, demonstrated_skill, implemented, tested, deployed,
proposed_wording, qualifications, review_status, approved_wording, review_notes.
For new claims set review_status to Pending and approved_wording to an empty
string. Keep existing Approved/Rejected decisions unless I explicitly revise them.

Separate source implementation from actually executed checks and deployment
observations. Historical verification notes need their date and attribution.
Use Unknown without current supporting evidence. Never infer passing tests
from declarations, deployed availability from configuration, or implementation
from a Done status alone. Surface meaningful fixes/architecture decisions
through source/history inspection; commit subjects alone are not claims.

Cover AI-Augmented Engineering, Solution Architecture, Prompt/Context
Engineering, Codex-assisted development, and full-stack delivery where supported.
Native iOS delivery requires separately pinned evidence. Copilot usage and
certification are owner-supplied credentials, not inferred repository facts.
AI assists human-directed engineering. No invented productivity or impact metrics.

Render REVIEW.md using scripts/portfolio-evidence.py render. Do not approve
claims, advance the checkpoint, change applications, commit, push, or deploy.
Give me the claim IDs and proposed wording for review.
```

The first packet already contains six Pending Codex-drafted claims. F032 and browser notifications are excluded because they are uncommitted. Current verification/deployment remain Unknown. The committed feature index contains 19 Done entries, compared with 20 in the historical working-tree report.

## 3. Review exact claims and wording

Read REVIEW.md and examine commit-scoped evidence. For each claim choose:

| Decision | packet.json changes |
| --- | --- |
| Approve | review_status = Approved; approved_wording = exact public text |
| Needs changes | review_status = Needs changes; review_notes = requested revision |
| Reject | review_status = Rejected; record reason in review_notes; approved_wording stays empty |
| Undecided | Keep Pending; checkpoint remains unchanged |

Example instruction to Codex:

> Approve C01 with the following exact wording: “...”. Mark C02 Needs changes because “...”. Reject C03 because “...”. Update the packet and render its Markdown. Do not complete review or modify Portfolio yet.

Review questions: Is this implemented at the recorded commit? What was actually tested? What deployment evidence exists? Does it show a skill worth emphasizing? Is the wording appropriate for an independent project? Are caveats preserved? Does it avoid implying autonomous AI authorship or native parity?

Render decisions:

```sh
python3 scripts/portfolio-evidence.py render --packet <packet-directory>/packet.json
```

Approval is exact-wording permission for portfolio preparation, not publication. A Markdown-only edit does not update authoritative JSON; render would replace it.

## 4. Explicitly finish the evidence review

Only after every claim is Approved or Rejected and approved claims have exact wording:

```sh
python3 scripts/portfolio-evidence.py complete-review --packet <packet-directory>/packet.json --confirm-reviewed
```

This is an explicit human-review assertion, not automatic proof of factual correctness. The command validates claim fields, IDs, source binding, decisions, and baseline/checkpoint agreement. It records Reviewed status and advances only the last reviewed source commit. It retains decisions, rejection reasons, and approved wording in checkpoint history. It does not record publication.

You can ask Codex: “All claim decisions are final. Complete evidence review for <snapshot ID>. Do not modify Portfolio or publish.” A packet with unresolved claims or working-tree evidence is rejected by this command. Concurrent/stale baseline reviews are rejected rather than silently overwriting the checkpoint.

## 5. Hand off only approved claims to Portfolio

Run this in the Portfolio workspace:

```text
Read the reviewed Astitva packet at <exact packet.json path> and its REVIEW.md.
Verify review_status is Reviewed. Use only claims marked Approved and their
exact approved_wording. Do not use proposed, pending, or rejected wording.
Read applicable Portfolio instructions, README.md, src/types.ts and
src/data/portfolio.json. Reuse the shared astitva case-study ID and existing
role references; do not duplicate facts or overwrite professional achievements.
Treat source applications as read-only. Do not expose internal filesystem paths.

Prepare local portfolio changes, record incorporated snapshot/claim IDs, run
npm run build, and provide a before/after diff and local preview instructions.
Do not mark the snapshot published, commit, push, merge, or deploy.
```

The earlier PORTFOLIO_UPDATE_PROMPTS.md contains broader drafts. For this workflow the reviewed packet's exact approved claims take precedence; those older drafts must not authorize unreviewed content.

Review the Portfolio diff and preview across role views. Merging and publication require separate owner instructions. Portfolio should own prepared/published tracking; Astitva's checkpoint records evidence review only. Record rejected ideas so later Codex interpretation does not repeatedly propose them without new evidence; consult checkpoint history when drafting future packets.

## Validation

```sh
python3 scripts/test_portfolio_evidence.py
```

Tests use disposable local Git fixture repositories. No main-repository history is changed. They cover committed-only collection, privacy exclusions/symlinks, stable rerun refusal, changed-file comparisons, optional draft separation, ancestry checks, review gates, approved wording, checkpoint advancement, and rejection of working-tree checkpoints. No application tests, emails, production requests, or deployment actions occur.
