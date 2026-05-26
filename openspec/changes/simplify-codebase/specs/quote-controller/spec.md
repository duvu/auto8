## ADDED Requirements

### Requirement: Quote endpoints are served by a dedicated controller
The system SHALL expose quote-related endpoints (`/api/quotes/:quoteId/submit` and `/api/quotes/:quoteId/approve`) through a dedicated `QuotesController` decorated with `@Controller("quotes")`, separate from `RfqsController`.

#### Scenario: Submit quote endpoint is reachable
- **WHEN** a POST request is sent to `/api/quotes/:quoteId/submit`
- **THEN** the system processes the request identically to the previous implementation and returns an `RfqDetailView`

#### Scenario: Approve quote endpoint is reachable
- **WHEN** a POST request is sent to `/api/quotes/:quoteId/approve`
- **THEN** the system processes the request identically to the previous implementation and returns an `RfqDetailView`

#### Scenario: RFQ endpoints remain unchanged
- **WHEN** a request is sent to any `/api/rfqs/...` endpoint
- **THEN** the system responds identically to before the controller split
