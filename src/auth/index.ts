/** Public re-exports for the `auth` module. */

export { loginWithCredentials } from "./credentialLogin.js";
export { authenticate } from "./keyExchange.js";
export {
  AuthSession,
  AuthSessionError,
  type AuthState,
  type AuthTokenResponse,
  type SessionTransition,
} from "./session.js";
