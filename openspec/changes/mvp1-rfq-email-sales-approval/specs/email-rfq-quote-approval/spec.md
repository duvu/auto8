## ADDED Requirements

### Requirement: RFQ email intake creates a trackable RFQ
The system SHALL accept a normalized RFQ email payload containing sender identity, subject, body content, and received timestamp, store the original intake data, and create a new RFQ work item that is visible to internal users.

#### Scenario: Valid inbound RFQ email is captured
- **WHEN** an RFQ email payload with the required sender, subject, body, and received timestamp fields is submitted
- **THEN** the system stores the inbound email details and creates a new RFQ in a trackable initial state

### Requirement: Internal users can create and update a draft quote for an RFQ
The system SHALL allow an internal user to open an RFQ, create a draft quote, edit quote header fields, and manage one or more quote line items before submission for approval.

#### Scenario: User saves a draft quote
- **WHEN** an internal user adds quote details and at least one line item to an RFQ and saves the draft
- **THEN** the system persists the quote as a draft and shows the RFQ as being worked on

### Requirement: Draft quotes require sales approval before finalization
The system SHALL require a draft quote to be submitted for approval and SHALL allow only a sales approver to change that quote from `pending_approval` to `approved`.

#### Scenario: Sales approver approves a submitted draft quote
- **WHEN** a sales approver opens a quote that is in `pending_approval` state and confirms approval
- **THEN** the system marks the quote as `approved` and prevents it from returning to an editable draft state through normal quote editing actions

#### Scenario: Non-sales user cannot approve a quote
- **WHEN** a non-sales user attempts to approve a quote that is in `pending_approval` state
- **THEN** the system rejects the action and leaves the quote state unchanged

### Requirement: Workflow status history is visible for each RFQ
The system SHALL show the current workflow state and chronological status transition history for each RFQ and its associated quote.

#### Scenario: User reviews RFQ workflow history
- **WHEN** an internal user opens the detail view for an RFQ that has progressed through draft and approval states
- **THEN** the system shows the current state and the recorded status transitions in chronological order
