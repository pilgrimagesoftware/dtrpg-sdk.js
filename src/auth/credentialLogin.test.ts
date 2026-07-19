import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Config } from "../config.js";
import {
  ApplicationKeyRequestFailedError,
  DecodeFailedError,
  InvalidCredentialsError,
} from "../errors.js";

import { doLogin, loginWithCredentials } from "./credentialLogin.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("doLogin", () => {
  it("returns the application key for valid credentials", async () => {
    server.use(
      http.post("http://mock-website/validate_login_credentials.php", () =>
        HttpResponse.json(["password", true, "Locked", true]),
      ),
      http.post("http://mock-website/create_account_app.php", () =>
        HttpResponse.json({ status: "success", message: { key: "test-app-key-abc123" } }),
      ),
    );

    const key = await doLogin("user@example.com", "secret", "http://mock-website");

    expect(key).toBe("test-app-key-abc123");
  });

  it("throws InvalidCredentialsError without calling the key endpoint", async () => {
    let keyEndpointCalled = false;
    server.use(
      http.post("http://mock-website/validate_login_credentials.php", () =>
        HttpResponse.json(["password", false, "Invalid", false]),
      ),
      http.post("http://mock-website/create_account_app.php", () => {
        keyEndpointCalled = true;
        return HttpResponse.json({});
      }),
    );

    await expect(
      doLogin("user@example.com", "wrong", "http://mock-website"),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(keyEndpointCalled).toBe(false);
  });

  it("throws ApplicationKeyRequestFailedError when the key request fails after valid credentials", async () => {
    server.use(
      http.post("http://mock-website/validate_login_credentials.php", () =>
        HttpResponse.json(["password", true, "Locked", true]),
      ),
      http.post("http://mock-website/create_account_app.php", () =>
        HttpResponse.json({ status: "error", message: { key: "" } }),
      ),
    );

    const error = await doLogin("user@example.com", "secret", "http://mock-website").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApplicationKeyRequestFailedError);
    expect((error as ApplicationKeyRequestFailedError).status).toBe("error");
  });

  it("throws DecodeFailedError when validate_login_credentials.php returns a short array", async () => {
    server.use(
      http.post("http://mock-website/validate_login_credentials.php", () =>
        HttpResponse.json(["password", true]),
      ),
    );

    await expect(
      doLogin("user@example.com", "secret", "http://mock-website"),
    ).rejects.toBeInstanceOf(DecodeFailedError);
  });
});

describe("loginWithCredentials", () => {
  it("targets www.drivethrurpg.com regardless of the configured API base URL", async () => {
    server.use(
      http.post("https://www.drivethrurpg.com/validate_login_credentials.php", () =>
        HttpResponse.json(["password", true, "Locked", true]),
      ),
      http.post("https://www.drivethrurpg.com/create_account_app.php", () =>
        HttpResponse.json({ status: "success", message: { key: "website-key" } }),
      ),
    );

    const config = new Config({
      applicationKey: "placeholder",
      baseUrl: "http://this-should-be-ignored",
    });
    const key = await loginWithCredentials("user@example.com", "secret", config);

    expect(key).toBe("website-key");
  });
});
