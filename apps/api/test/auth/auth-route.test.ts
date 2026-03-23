import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { createApiApp } from "@/app";

const originalFetch = globalThis.fetch;

beforeAll(() => {
  process.env.MAP_APP_AUTH_ALLOWED_EMAIL_DOMAIN = "datacenterhawk.com";
  process.env.MAP_APP_AUTH_IAM_BASE_URL = "https://datacenterhawk.com";
  process.env.MAP_APP_AUTH_SESSION_COOKIE_NAME = "map_playground_auth";
  process.env.MAP_APP_AUTH_SESSION_SECRET = "test-session-secret-should-be-long-enough";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function toRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

describe("map app auth routes", () => {
  it("creates an authenticated session from the upstream IAM login", async () => {
    globalThis.fetch = (input, init) => {
      const requestUrl = toRequestUrl(input);
      expect(requestUrl).toBe("https://datacenterhawk.com/login_post.htm");
      expect(init?.method).toBe("POST");

      return Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              email: "robert@datacenterhawk.com",
              name: "Robert Farris",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      );
    };

    const app = createApiApp();
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "map-playground.datacenterhawk.com",
      },
      body: JSON.stringify({
        email: "robert@datacenterhawk.com",
        password: "super-secret-password",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.authenticated).toBe(true);
    expect(payload.user.email).toBe("robert@datacenterhawk.com");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("map_playground_auth=");
  });

  it("requires an authenticated session for external geo routes", async () => {
    const app = createApiApp();
    app.get("/api/geo/test-auth", (c) =>
      c.json({
        ok: true,
      })
    );

    const unauthorizedResponse = await app.request("/api/geo/test-auth", {
      headers: {
        host: "map-playground.datacenterhawk.com",
      },
    });
    const unauthorizedPayload = await unauthorizedResponse.json();

    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedPayload.error.code).toBe("AUTH_SESSION_REQUIRED");

    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              email: "robert@datacenterhawk.com",
              name: "Robert Farris",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      );

    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "map-playground.datacenterhawk.com",
      },
      body: JSON.stringify({
        email: "robert@datacenterhawk.com",
        password: "super-secret-password",
      }),
    });
    const sessionCookieHeader = loginResponse.headers.get("set-cookie");
    expect(typeof sessionCookieHeader).toBe("string");
    if (typeof sessionCookieHeader !== "string") {
      throw new Error("Expected auth login to set a session cookie");
    }

    const sessionCookie = sessionCookieHeader.split(";")[0];

    const authorizedResponse = await app.request("/api/geo/test-auth", {
      headers: {
        cookie: sessionCookie,
        host: "map-playground.datacenterhawk.com",
      },
    });
    const authorizedPayload = await authorizedResponse.json();

    expect(authorizedResponse.status).toBe(200);
    expect(authorizedPayload.ok).toBe(true);
  });
});
