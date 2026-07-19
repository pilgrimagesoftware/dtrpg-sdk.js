## Purpose
Define how the Node SDK wraps authentication around API access so callers get predictable Node-facing behavior without redefining the meaning of the API contract.
## Requirements
### Requirement: Node authentication flow must preserve API contract meaning
The Node SDK MUST define how its authentication surface coordinates with the API contract semantics owned by the API repository, without redefining token issuance, expiry, or refresh meaning in Node-specific terms.

#### Scenario: Authenticating through the Node SDK
- **WHEN** a caller invokes `authenticate(applicationKey, config)`
- **THEN** the SDK sends the application key to the API host, decodes the resulting `AuthTokenResponse` (token, refresh token, refresh token TTL), and returns it without altering its meaning

#### Scenario: Exchanging credentials for an application key
- **WHEN** a caller invokes `loginWithCredentials(email, password, config)`
- **THEN** the SDK performs the two-step website-host exchange (validate credentials, then request an application key) and returns the application key, or throws `InvalidCredentialsError` if the first step reports invalid credentials without attempting the second step

### Requirement: Node SDK session lifecycle must distinguish voluntary logout from API-reported failure
The Node SDK MUST expose `clearSession()` for voluntary logout and a separate `invalidateSession(error)` for API-reported authentication failures, and MUST NOT collapse the two into a single method.

#### Scenario: Voluntary logout
- **WHEN** a caller invokes `sdk.clearSession()`
- **THEN** the active session is removed with no error recorded

#### Scenario: API reports an authentication failure
- **WHEN** a caller invokes `sdk.invalidateSession(error)` with a session active
- **THEN** the SDK clears the session and returns the same `AuthSessionError` it was given, without reclassifying it

#### Scenario: Invalidating with no active session
- **WHEN** a caller invokes `sdk.invalidateSession(error)` with no session active
- **THEN** the SDK throws `UnauthenticatedError`

### Requirement: Node authentication errors must preserve API meaning
The Node SDK MUST translate authentication failures into typed exceptions without obscuring the meaning of the underlying API failure.

#### Scenario: Authentication request fails
- **WHEN** the underlying HTTP call fails during `authenticate` or `loginWithCredentials`
- **THEN** the Node SDK throws a `ClientError` subclass carrying the original status, message, and payload rather than a generic `Error`
