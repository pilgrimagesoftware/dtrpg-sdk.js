import { describe, expect, it } from "vitest";

import { Config, DEFAULT_API_VERSION, DEFAULT_BASE_URL } from "./config.js";

describe("Config", () => {
  it("defaults baseUrl and apiVersion when only applicationKey is given", () => {
    const config = new Config({ applicationKey: "my-app-key" });

    expect(config.applicationKey).toBe("my-app-key");
    expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(config.apiVersion).toBe(DEFAULT_API_VERSION);
  });

  it("uses a custom baseUrl when provided", () => {
    const config = new Config({
      applicationKey: "my-app-key",
      baseUrl: "http://localhost:8080/api",
    });

    expect(config.baseUrl).toBe("http://localhost:8080/api");
    expect(config.apiVersion).toBe(DEFAULT_API_VERSION);
  });

  it("uses a custom apiVersion when provided", () => {
    const config = new Config({ applicationKey: "my-app-key", apiVersion: "v2" });

    expect(config.apiVersion).toBe("v2");
  });

  it("does not fall back to an environment variable for applicationKey", () => {
    const originalValue = process.env["DTRPG_APPLICATION_KEY"];
    process.env["DTRPG_APPLICATION_KEY"] = "env-key-should-be-ignored";

    try {
      const config = new Config({ applicationKey: "explicit-key" });
      expect(config.applicationKey).toBe("explicit-key");
      expect(config.applicationKey).not.toBe(process.env["DTRPG_APPLICATION_KEY"]);
    } finally {
      if (originalValue === undefined) {
        delete process.env["DTRPG_APPLICATION_KEY"];
      } else {
        process.env["DTRPG_APPLICATION_KEY"] = originalValue;
      }
    }
  });
});
