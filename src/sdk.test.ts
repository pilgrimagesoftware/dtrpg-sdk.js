import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AuthSessionError, type AuthTokenResponse } from "./auth/session.js";
import { Config } from "./config.js";
import { DecodeFailedError, UnauthenticatedError, UnconfiguredError } from "./errors.js";
import { LibraryClient } from "./library/client.js";
import { DriveThruRpgSdk } from "./sdk.js";

const tokenResponse: AuthTokenResponse = {
  token: "jwt-token",
  refreshToken: "refresh-token",
  refreshTokenTtl: 1_771_547_233,
};

describe("DriveThruRpgSdk session lifecycle", () => {
  it("is unconfigured by default", () => {
    const sdk = new DriveThruRpgSdk();

    expect(sdk.config).toBeUndefined();
    expect(sdk.session).toBeUndefined();
    expect(() => sdk.requireConfig()).toThrow(UnconfiguredError);
  });

  it("requires configuration before a session can be applied", () => {
    const sdk = new DriveThruRpgSdk();

    expect(() => sdk.applyAuthResponse(tokenResponse)).toThrow(UnconfiguredError);
  });

  it("stores an authenticated session after configuration", () => {
    const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "app-key" }));

    const session = sdk.applyAuthResponse(tokenResponse);

    expect(session.token).toBe("jwt-token");
    expect(session.refreshToken).toBe("refresh-token");
    expect(session.refreshTokenExpiredAt(1_771_547_232)).toBe(false);
    expect(session.refreshTokenExpiredAt(1_771_547_233)).toBe(true);
    expect(sdk.session).toBe(session);
  });

  it("configure() can be called after construction and does not clear an existing session", () => {
    const sdk = new DriveThruRpgSdk();
    sdk.configure(new Config({ applicationKey: "app-key" }));
    sdk.applyAuthResponse(tokenResponse);

    sdk.configure(new Config({ applicationKey: "another-key" }));

    expect(sdk.session).toBeDefined();
    expect(sdk.config?.applicationKey).toBe("another-key");
  });

  it("clearSession() silently removes the session with no error recorded", () => {
    const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "app-key" }));
    sdk.applyAuthResponse(tokenResponse);

    sdk.clearSession();

    expect(sdk.session).toBeUndefined();
    expect(() => sdk.requireSession()).toThrow(UnauthenticatedError);
  });

  it("invalidateSession() clears the session and returns the same error unmodified", () => {
    const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "app-key" }));
    sdk.applyAuthResponse(tokenResponse);

    const error = new AuthSessionError(
      "token_expired",
      "The authentication token has expired.",
      "token_expired",
    );

    const returned = sdk.invalidateSession(error);

    expect(returned).toBe(error);
    expect(sdk.session).toBeUndefined();
    expect(() => sdk.requireSession()).toThrow(UnauthenticatedError);
  });

  it("invalidateSession() throws UnauthenticatedError when no session is active", () => {
    const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "app-key" }));
    const error = new AuthSessionError("token_expired", "expired", "token_expired");

    expect(() => sdk.invalidateSession(error)).toThrow(UnauthenticatedError);
  });

  it("libraryClient() throws UnconfiguredError before any HTTP request when unconfigured", () => {
    const sdk = new DriveThruRpgSdk();

    expect(() => sdk.libraryClient()).toThrow(UnconfiguredError);
  });

  it("libraryClient() throws UnauthenticatedError when configured but unauthenticated", () => {
    const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "app-key" }));

    expect(() => sdk.libraryClient()).toThrow(UnauthenticatedError);
  });

  it("libraryClient() returns a LibraryClient once configured and authenticated", () => {
    const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "app-key" }));
    sdk.applyAuthResponse(tokenResponse);

    const client = sdk.libraryClient();

    expect(client).toBeInstanceOf(LibraryClient);
  });
});

describe("DriveThruRpgSdk.refreshSession", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const sdkWithSession = (): DriveThruRpgSdk => {
    const sdk = DriveThruRpgSdk.withConfig(
      new Config({ applicationKey: "app-key", baseUrl: "http://mock-api" }),
    );
    sdk.applyAuthResponse(tokenResponse);
    return sdk;
  };

  it("replaces the stored session with the refreshed one", async () => {
    server.use(
      http.post("http://mock-api/vBeta/auth/refresh", ({ request }) => {
        expect(request.headers.get("cookie")).toBe("refreshToken=refresh-token");
        return HttpResponse.json({
          token: "new-jwt",
          refreshToken: "new-refresh",
          refreshTokenTTL: 2_000_000_000,
        });
      }),
    );
    const sdk = sdkWithSession();

    const session = await sdk.refreshSession();

    expect(session.token).toBe("new-jwt");
    expect(session.refreshToken).toBe("new-refresh");
    expect(sdk.requireSession()).toBe(session);
  });

  it("keeps the old session when the refresh token is rejected", async () => {
    server.use(
      http.post(
        "http://mock-api/vBeta/auth/refresh",
        () => new HttpResponse("{}", { status: 401 }),
      ),
    );
    const sdk = sdkWithSession();

    await expect(sdk.refreshSession()).rejects.toBeInstanceOf(DecodeFailedError);

    expect(sdk.requireSession().token).toBe("jwt-token");
  });

  it("requires a configuration and a session", async () => {
    await expect(new DriveThruRpgSdk().refreshSession()).rejects.toBeInstanceOf(UnconfiguredError);
    const configured = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "app-key" }));
    await expect(configured.refreshSession()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
