## ADDED Requirements

### Requirement: Trusted Gmail sync imports RFQ emails into the existing workflow
The system SHALL expose a trusted Gmail connector flow that reads RFQ emails from one configured Gmail mailbox, normalizes them into the existing email intake contract, and creates trackable RFQ work items in the standard initial workflow state.

#### Scenario: Manual Gmail sync imports a matching RFQ email
- **WHEN** a trusted caller triggers a Gmail sync and the configured mailbox contains a matching RFQ email that has not been imported before
- **THEN** the system imports the email and creates a new RFQ that appears in the existing internal queue as an email-origin work item

### Requirement: Gmail connector prevents duplicate RFQ creation for the same message
The system SHALL persist Gmail message identity for imported RFQ emails and MUST skip creating a new RFQ when a later Gmail sync encounters a message that was already imported.

#### Scenario: Repeated sync does not duplicate an RFQ
- **WHEN** the Gmail connector processes a mailbox message whose Gmail identity already exists in Auto8 from an earlier import
- **THEN** the system skips RFQ creation for that message and reports it as already imported in the sync result

### Requirement: Untrusted or misconfigured Gmail sync requests are rejected safely
The system SHALL reject Gmail sync requests when connector trust headers or required Gmail configuration are missing or invalid, and MUST avoid creating RFQs during those failed sync attempts.

#### Scenario: Invalid Gmail sync trigger does not import messages
- **WHEN** a caller triggers Gmail sync without the required connector trust secret or when Gmail connector credentials are not configured correctly
- **THEN** the system rejects the request and creates no new RFQs

### Requirement: Gmail import provenance is retained for imported RFQs
The system SHALL retain the Gmail metadata needed for troubleshooting and duplicate protection, including at least the Gmail message identifier and the originating mailbox context for each imported RFQ.

#### Scenario: User or developer inspects a Gmail-imported RFQ
- **WHEN** an imported RFQ is reviewed after Gmail sync completes
- **THEN** the system can retrieve the Gmail provenance captured during import for audit and troubleshooting purposes
