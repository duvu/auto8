# Draft: Next Roadmap Phase

## Requirements (confirmed)
- User request: "implement next phase in the roadmap. maintain consistency accross the project, avoid interface drift"
- The request came through `/opsx-propose`, so the user wants a planning/proposal artifact for the next roadmap phase, not direct implementation.
- Guardrail: maintain consistency across the project and avoid interface drift.

## Technical Decisions
- OpenSpec is detected at `openspec/`.
- Existing roadmap documentation only explicitly covers MVP2; MVP3 exists as an OpenSpec change (`openspec/changes/mvp3-platform-maturity/`) and has been implemented in prior work.
- The next phase is not explicitly named in the repository. A reasonable interpretation is an MVP4-style hardening phase focused on interface contracts, workspace isolation completion, API/frontend type alignment, regression gates, and documentation/spec synchronization before adding more product features.
- User confirmed the recommended direction: Hardening MVP4.
- OpenSpec change name selected: `mvp4-contract-consistency-hardening`.

## Research Findings
- `docs/MVP2.md` defines MVP2 features and sequence; MVP2 was completed in prior sessions.
- `openspec/changes/mvp3-platform-maturity/proposal.md` defines MVP3 as platform maturity: customer portal, analytics, mobile responsiveness, multi-tenant workspace, connector OAuth2.
- `openspec/changes/mvp3-platform-maturity/tasks.md` includes several cross-cutting tasks whose wording may lag actual implementation state, which reinforces the need for interface drift control.
- Active OpenSpec changes include multiple completed/partially completed initiatives: `mvp3-platform-maturity`, `simplify-connector-setup`, `zalo-connector`, `sprint-4-channels-integration`, and earlier UI/connector changes.

## Open Questions
- Should the next roadmap phase prioritize hardening/interface consistency (recommended) or add new product features beyond MVP3?
- If hardening is accepted, should the OpenSpec change name be `mvp4-contract-consistency-hardening`?

## Scope Boundaries
- INCLUDE: API/shared/frontend interface alignment; generated contract checks; workspace scoping audit; OpenSpec/task/documentation synchronization; regression tests and build gates.
- EXCLUDE: new external channels, new large customer-facing features, billing, cross-workspace analytics, native mobile app, or implementation code during planning.

## Generated Artifacts
- `openspec/changes/mvp4-contract-consistency-hardening/proposal.md`
- `openspec/changes/mvp4-contract-consistency-hardening/design.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/contract-consistency/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/workspace-isolation-audit/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/spec-documentation-sync/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/regression-verification-gates/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/connector-registry/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/rbac/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/rfq-intake/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/quote-workflow/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/specs/nestjs-module-structure/spec.md`
- `openspec/changes/mvp4-contract-consistency-hardening/tasks.md`

## Final Status
- `openspec status --change "mvp4-contract-consistency-hardening"` reports 4/4 artifacts complete and apply-ready.
