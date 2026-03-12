import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { config as loadEnv } from "dotenv";

const mockEnv = {
  WEKNOW_API_HOST: "test-host",
  WEKNOW_ACCOUNT_TOKEN: "test-account-token",
  WEKNOW_USER_NAME: "test-user",
  WEKNOW_PASSWORD: "test-password",
  WEKNOW_CLIENT_TYPE: "TEST",
};

const BASE_URL = "http://test-host/weknow/datasnap/rest";
const MOCK_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAMockKey\n-----END PUBLIC KEY-----";
const MOCK_ENCRYPTED_BASE64 = "bW9ja0VuY3J5cHRlZA==";

function setupEnv() {
  Object.entries(mockEnv).forEach(([key, value]) => (process.env[key] = value));
}

function teardownEnv() {
  Object.keys(mockEnv).forEach((key) => delete process.env[key]);
}

function createFetchResponse(body: any, options: { cookie?: string } = {}) {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: {
      get: vi.fn((name: string) => (name === "set-cookie" ? (options.cookie ?? null) : null)),
    },
    status: 200,
    statusText: "OK",
  };
}

/**
 * Each describe block uses vi.resetModules() + vi.doMock() + dynamic import
 * to get a fresh module instance with a clean cache before every test.
 */
async function setupMocks(mockFetch: Mock) {
  const mockEncryptWithPublicKey = vi.fn().mockReturnValue(MOCK_ENCRYPTED_BASE64);

  vi.doMock("node-fetch", () => ({ default: mockFetch }));
  vi.doMock("../utils/utils", () => ({
    encryptWithPublicKey: mockEncryptWithPublicKey,
  }));

  return { mockEncryptWithPublicKey };
}

// ── getPublicKey ────────────────────────────────────────────────────────────

describe("getPublicKey", () => {
  let mockFetch: Mock;

  beforeEach(async () => {
    setupEnv();
    vi.resetModules();
    mockFetch = vi.fn();
    await setupMocks(mockFetch);
  });

  afterEach(teardownEnv);

  test("calls TServerApi/Hello with accountToken and returns publicKey", async () => {
    mockFetch.mockResolvedValue(
      createFetchResponse({ serverInfo: { security: { publicKey: MOCK_PUBLIC_KEY } } })
    );

    const { getPublicKey } = await import("./weknow.service");
    const result = await getPublicKey("my-token");

    expect(result).toBe(MOCK_PUBLIC_KEY);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/TServerApi/Hello`,
      expect.objectContaining({
        method: "post",
        body: JSON.stringify({ accountToken: "my-token" }),
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  test("returns undefined when publicKey is absent from response", async () => {
    mockFetch.mockResolvedValue(createFetchResponse({ serverInfo: {} }));

    const { getPublicKey } = await import("./weknow.service");
    const result = await getPublicKey("my-token");

    expect(result).toBeUndefined();
  });

  test("returns undefined when serverInfo is absent from response", async () => {
    mockFetch.mockResolvedValue(createFetchResponse({}));

    const { getPublicKey } = await import("./weknow.service");
    const result = await getPublicKey("my-token");

    expect(result).toBeUndefined();
  });
});

// ── getAccessToken ──────────────────────────────────────────────────────────

describe("getAccessToken", () => {
  let mockFetch: Mock;
  let mockEncryptWithPublicKey: Mock;

  beforeEach(async () => {
    setupEnv();
    vi.resetModules();
    mockFetch = vi.fn();
    ({ mockEncryptWithPublicKey } = await setupMocks(mockFetch));
  });

  afterEach(teardownEnv);

  test("fetches public key, encrypts password with RSA-OAEP and extracts token from Set-Cookie", async () => {
    mockFetch
      .mockResolvedValueOnce(
        createFetchResponse({ serverInfo: { security: { publicKey: MOCK_PUBLIC_KEY } } })
      )
      .mockResolvedValueOnce(
        createFetchResponse({}, { cookie: "access-token=abc123; Path=/; HttpOnly" })
      );

    const { getAccessToken } = await import("./weknow.service");
    const token = await getAccessToken();

    expect(token).toBe("abc123");

    // Verify password was encrypted with the fetched public key
    expect(mockEncryptWithPublicKey).toHaveBeenCalledWith(mockEnv.WEKNOW_PASSWORD, MOCK_PUBLIC_KEY);

    // Verify authenticate POST body
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `${BASE_URL}/TSecurityApi/Authenticate`,
      expect.objectContaining({
        method: "post",
        body: JSON.stringify({
          userName: mockEnv.WEKNOW_USER_NAME,
          passwordEncrypted: MOCK_ENCRYPTED_BASE64,
          clientAppType: mockEnv.WEKNOW_CLIENT_TYPE,
          accountToken: mockEnv.WEKNOW_ACCOUNT_TOKEN,
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  test("caches token and skips re-authentication on subsequent calls", async () => {
    mockFetch
      .mockResolvedValueOnce(
        createFetchResponse({ serverInfo: { security: { publicKey: MOCK_PUBLIC_KEY } } })
      )
      .mockResolvedValueOnce(
        createFetchResponse({}, { cookie: "access-token=cached-token; Path=/" })
      );

    const { getAccessToken } = await import("./weknow.service");
    const first = await getAccessToken();
    const second = await getAccessToken();

    expect(first).toBe("cached-token");
    expect(second).toBe("cached-token");
    expect(mockFetch).toHaveBeenCalledTimes(2); // getPublicKey + authenticate — not repeated
  });

  test("throws when Set-Cookie header is missing from authenticate response", async () => {
    mockFetch
      .mockResolvedValueOnce(
        createFetchResponse({ serverInfo: { security: { publicKey: MOCK_PUBLIC_KEY } } })
      )
      .mockResolvedValueOnce(createFetchResponse({})); // no Set-Cookie

    const { getAccessToken } = await import("./weknow.service");

    await expect(getAccessToken()).rejects.toThrow(
      "Falha na autenticação: não foi possível extrair o accessToken dos cookies."
    );
  });
});

// ── getMetadataSummary ──────────────────────────────────────────────────────

describe("getMetadataSummary", () => {
  let mockFetch: Mock;

  beforeEach(async () => {
    setupEnv();
    vi.resetModules();
    mockFetch = vi.fn();
    await setupMocks(mockFetch);
  });

  afterEach(teardownEnv);

  test("calls TMetadataApi/Summary with metadataId and accessToken", async () => {
    const mockData = { fields: [{ completeName: "FIELD_1" }] };
    mockFetch.mockResolvedValue(createFetchResponse(mockData));

    const { getMetadataSummary } = await import("./weknow.service");
    const result = await getMetadataSummary(42, "my-token");

    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/TMetadataApi/Summary`,
      expect.objectContaining({
        method: "post",
        body: JSON.stringify({ metadataId: 42, accessToken: "my-token" }),
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  test("caches result for the same metadataId and avoids re-fetching", async () => {
    mockFetch.mockResolvedValue(createFetchResponse({ fields: [] }));

    const { getMetadataSummary } = await import("./weknow.service");
    await getMetadataSummary(1, "token");
    await getMetadataSummary(1, "token");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("fetches independently for different metadataIds", async () => {
    mockFetch.mockResolvedValue(createFetchResponse({ fields: [] }));

    const { getMetadataSummary } = await import("./weknow.service");
    await getMetadataSummary(1, "token");
    await getMetadataSummary(2, "token");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ── getAccessToken (integration) ────────────────────────────────────────────

describe("getAccessToken (integration)", () => {
  const hasCredentials = Boolean(
    process.env.WEKNOW_API_HOST &&
    process.env.WEKNOW_ACCOUNT_TOKEN &&
    process.env.WEKNOW_USER_NAME &&
    process.env.WEKNOW_PASSWORD
  );

  beforeEach(() => {
    // Reload .env values — unit test teardowns delete these vars from process.env
    loadEnv({ override: true });
    vi.resetModules();
    // Remove any vi.doMock registrations so real modules are used
    vi.doUnmock("node-fetch");
    vi.doUnmock("../utils/utils");
  });

  test.skipIf(!hasCredentials)("returns a non-empty token string using real API", async () => {
    const { getAccessToken } = await import("./weknow.service");
    const token = await getAccessToken();

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });
});

// ── executeComponent ────────────────────────────────────────────────────────

describe("executeComponent", () => {
  let mockFetch: Mock;

  beforeEach(async () => {
    setupEnv();
    vi.resetModules();
    mockFetch = vi.fn();
    await setupMocks(mockFetch);
  });

  afterEach(teardownEnv);

  test("calls TComponentApi/Execute with contents and accessToken", async () => {
    const mockResult = { cols: [{ completeName: "COL_1" }], rows: [{ cells: [{ value: "A" }] }] };
    mockFetch.mockResolvedValue(createFetchResponse(mockResult));

    const body = JSON.stringify({ contents: { version: "5.2.1", type: 3 }, accessToken: "my-token" });
    const { executeComponent } = await import("./weknow.service");
    const result = await executeComponent(body);

    expect(result).toEqual(mockResult);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/TComponentApi/Execute`,
      expect.objectContaining({
        method: "post",
        body: JSON.stringify({ contents: { version: "5.2.1", type: 3 }, accessToken: "my-token" }),
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});

// ── executeMetadata ─────────────────────────────────────────────────────────

describe("executeMetadata", () => {
  let mockFetch: Mock;

  beforeEach(async () => {
    setupEnv();
    vi.resetModules();
    mockFetch = vi.fn();
    await setupMocks(mockFetch);
  });

  afterEach(teardownEnv);

  test("calls TMetadataApi/Execute with metadataId and accessToken", async () => {
    const mockResult = { cols: [], rows: [] };
    mockFetch.mockResolvedValue(createFetchResponse(mockResult));

    const { executeMetadata } = await import("./weknow.service");
    const result = await executeMetadata(99, "my-token");

    expect(result).toEqual(mockResult);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/TMetadataApi/Execute`,
      expect.objectContaining({
        method: "post",
        body: JSON.stringify({ metadataId: 99, accessToken: "my-token" }),
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});
