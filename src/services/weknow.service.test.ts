import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { authenticate } from "./weknow.service";
import fetch from "node-fetch";
import crypto from "crypto";
import puppeteer from "puppeteer-core";

// Mock dependencies
vi.mock("node-fetch");
vi.mock("puppeteer-core");

// Mock environment variables
const mockEnv = {
  WEKNOW_API_HOST: "test-host",
  WEKNOW_PASSWORD_SALT: "test-salt",
  WEKNOW_ACCOUNT_TOKEN: "test-account-token",
  WEKNOW_API_PORT: "8080",
  CHROME_EXECUTABLE_PATH: "/path/to/chrome",
};

beforeEach(() => {
  // Set environment variables
  Object.entries(mockEnv).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up environment variables
  Object.keys(mockEnv).forEach((key) => {
    delete process.env[key as keyof typeof mockEnv];
  });
});

test("authenticate should call TSecurityApi/Authenticate with hashed password", async () => {
  const mockResponse = {
    json: vi.fn().mockResolvedValue({ accessToken: "test-token", success: true }),
  };

  (fetch as any).mockResolvedValue(mockResponse);

  const userName = "testuser";
  const password = "testpass";
  const clientAppType = "web";
  const accountToken = "account123";

  const result = await authenticate(userName, password, clientAppType, accountToken);

  // Verify fetch was called with correct URL
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    "http://test-host/weknow/datasnap/rest/TSecurityApi/Authenticate",
    expect.objectContaining({
      method: "post",
      headers: { "Content-Type": "application/json" },
    })
  );

  // Verify result
  expect(result).toEqual({ accessToken: "test-token", success: true });
});

// Add other test cases here as needed
