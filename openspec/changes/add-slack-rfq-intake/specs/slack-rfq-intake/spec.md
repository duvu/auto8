## ADDED Requirements

### Requirement: Verified Slack submissions create trackable RFQs
The system SHALL accept a configured Slack RFQ submission, verify that the request is trusted, store the normalized intake data plus Slack source metadata, and create a new RFQ work item in the initial workflow state.

#### Scenario: Valid Slack RFQ submission is captured
- **WHEN** a trusted Slack submission with the required RFQ content and source metadata is received
- **THEN** the system stores the inbound Slack details and creates a new RFQ that appears in the internal queue

### Requirement: Slack-origin RFQs follow the same downstream workflow as other intake sources
The system SHALL let internal users draft, submit, and approve quotes for Slack-origin RFQs through the same queue, detail, and approval workflow used for existing intake sources.

#### Scenario: Operator works a Slack-origin RFQ without a separate flow
- **WHEN** an internal user opens an RFQ that was created from Slack
- **THEN** the system shows it in the standard RFQ workflow and allows the same draft quote and approval actions as any other RFQ

### Requirement: Untrusted or malformed Slack submissions are rejected
The system SHALL reject Slack intake requests that fail authenticity checks or do not contain the minimum RFQ data required to create a trackable work item.

#### Scenario: Invalid Slack request does not create an RFQ
- **WHEN** the Slack connector receives a request with invalid trust data or missing required RFQ fields
- **THEN** the system rejects the request and does not create a new RFQ record

### Requirement: Slack source provenance is visible to internal users
The system SHALL expose the RFQ source type and relevant Slack provenance details so operators can distinguish Slack-origin RFQs from other inbound sources while reviewing the work item.

#### Scenario: User reviews Slack source metadata on an RFQ
- **WHEN** an internal user opens the detail view for a Slack-origin RFQ
- **THEN** the system shows that the RFQ came from Slack and displays the available workspace, channel, and submitter context captured at intake time
