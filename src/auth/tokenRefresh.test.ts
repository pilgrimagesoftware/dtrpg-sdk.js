import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Config } from "../config.js";
import { DecodeFailedError, HttpError } from "../errors.js";

import { refresh } from "./tokenRefresh.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const config = new Config({ applicationKey: "my-app-key", baseUrl: "http://mock-api" });

describe("refresh", () => {
  it("sends the refresh token as a cookie and decodes the response", async () => {
    server.use(
      http.post("http://mock-api/vBeta/auth/refresh", ({ request }) => {
        expect(request.headers.get("cookie")).toBe("refreshToken=old-refresh");
        return HttpResponse.json({
          token: "new-jwt",
          refreshToken: "new-refresh",
          refreshTokenTTL: 2_000_000_000,
        });
      }),
    );

    const response = await refresh("old-refresh", config);

    expect(response).toEqual({
      token: "new-jwt",
      refreshToken: "new-refresh",
      refreshTokenTtl: 2_000_000_000,
    });
  });

  it("throws DecodeFailedError carrying the status when the token is rejected", async () => {
    server.use(
      http.post(
        "http://mock-api/vBeta/auth/refresh",
        () => new HttpResponse(JSON.stringify({ errorCode: "refresh_expired" }), { status: 401 }),
      ),
    );

    const error = await refresh("expired", config).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DecodeFailedError);
    expect((error as DecodeFailedError).status).toBe(401);
  });

  it("throws HttpError when the request itself fails", async () => {
    server.use(http.post("http://mock-api/vBeta/auth/refresh", () => HttpResponse.error()));

    await expect(refresh("old-refresh", config)).rejects.toBeInstanceOf(HttpError);
  });
});
