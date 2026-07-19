import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Config } from "../config.js";
import { DecodeFailedError, HttpError } from "../errors.js";

import { authenticate } from "./keyExchange.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("authenticate", () => {
  it("exchanges an application key for a session token", async () => {
    server.use(
      http.post("http://mock-api/vBeta/auth_key", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("applicationKey")).toBe("my-app-key");
        return HttpResponse.json({
          token: "jwt-token",
          refreshToken: "refresh-token",
          refreshTokenTTL: 1_771_547_233,
        });
      }),
    );

    const config = new Config({ applicationKey: "my-app-key", baseUrl: "http://mock-api" });
    const response = await authenticate("my-app-key", config);

    expect(response).toEqual({
      token: "jwt-token",
      refreshToken: "refresh-token",
      refreshTokenTtl: 1_771_547_233,
    });
  });

  it("throws DecodeFailedError with the status and payload on a non-success response", async () => {
    server.use(
      http.post(
        "http://mock-api/vBeta/auth_key",
        () =>
          new HttpResponse(JSON.stringify({ message: "invalid application key" }), {
            status: 401,
          }),
      ),
    );

    const config = new Config({ applicationKey: "bad-key", baseUrl: "http://mock-api" });

    const error = await authenticate("bad-key", config).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DecodeFailedError);
    const decodeError = error as DecodeFailedError;
    expect(decodeError.status).toBe(401);
    expect(decodeError.payload).toContain("invalid application key");
  });

  it("throws DecodeFailedError when the success body is malformed", async () => {
    server.use(
      http.post("http://mock-api/vBeta/auth_key", () =>
        HttpResponse.json({ token: "only-a-token" }),
      ),
    );

    const config = new Config({ applicationKey: "my-app-key", baseUrl: "http://mock-api" });

    await expect(authenticate("my-app-key", config)).rejects.toBeInstanceOf(DecodeFailedError);
  });

  it("throws HttpError when the network request itself fails", async () => {
    server.use(http.post("http://mock-api/vBeta/auth_key", () => HttpResponse.error()));

    const config = new Config({ applicationKey: "my-app-key", baseUrl: "http://mock-api" });

    await expect(authenticate("my-app-key", config)).rejects.toBeInstanceOf(HttpError);
  });
});
