import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import weknowService from './weknow.service.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import puppeteer from 'puppeteer-core';

// Mock dependencies
vi.mock('node-fetch');
vi.mock('puppeteer-core');

// Mock environment variables
const mockEnv = {
    WEKNOW_API_HOST: 'test-host',
    WEKNOW_PASSWORD_SALT: 'test-salt',
    WEKNOW_ACCOUNT_TOKEN: 'test-account-token',
    WEKNOW_API_PORT: '8080',
    CHROME_EXECUTABLE_PATH: '/path/to/chrome'
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
    Object.keys(mockEnv).forEach(key => {
        delete process.env[key];
    });
});

test('authenticate should call TSecurityApi/Authenticate with hashed password', async () => {
    const mockResponse = {
        json: vi.fn().mockResolvedValue({ accessToken: 'test-token', success: true })
    };

    fetch.mockResolvedValue(mockResponse);

    const userName = 'testuser';
    const password = 'testpass';
    const clientAppType = 'web';
    const accountToken = 'account123';

    const result = await weknowService.authenticate(userName, password, clientAppType, accountToken);

    // Verify fetch was called with correct URL
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
        'http://test-host/weknow/datasnap/rest/TSecurityApi/Authenticate',
        expect.objectContaining({
            method: 'post',
            headers: { 'Content-Type': 'application/json' }
        })
    );

    // Verify password was hashed correctly
    const callArgs = fetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.userName).toBe(userName);
    expect(body.clientAppType).toBe(clientAppType);
    expect(body.accountToken).toBe(accountToken);
    expect(body.passwordHash64).toBeDefined();

    // Verify the password hash
    const expectedHash = crypto.createHash('sha512')
        .update('test-salt' + password)
        .digest('base64');
    expect(body.passwordHash64).toBe(expectedHash);

    // Verify result
    expect(result).toEqual({ accessToken: 'test-token', success: true });
});

test('getMetadataSummary should call TMetadataApi/Summary and cache result', async () => {
    const mockResponse = {
        json: vi.fn().mockResolvedValue({ fields: ['field1', 'field2'] })
    };

    fetch.mockResolvedValue(mockResponse);

    const metadataId = '123';
    const accessToken = 'token123';

    // First call - should fetch from API
    const result1 = await weknowService.getMetadataSummary(metadataId, accessToken);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
        'http://test-host/weknow/datasnap/rest/TMetadataApi/Summary',
        expect.objectContaining({
            method: 'post',
            body: JSON.stringify({ metadataId, accessToken }),
            headers: { 'Content-Type': 'application/json' }
        })
    );

    expect(result1).toEqual({ fields: ['field1', 'field2'] });

    // Second call - should return cached result
    const result2 = await weknowService.getMetadataSummary(metadataId, accessToken);

    // Fetch should still only be called once (cached)
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result2).toEqual({ fields: ['field1', 'field2'] });
});

test('executeComponent should call TComponentApi/Execute', async () => {
    const mockResponse = {
        json: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Test' }] })
    };

    fetch.mockResolvedValue(mockResponse);

    const contents = { config: 'test-config' };
    const accessToken = 'token123';

    const result = await weknowService.executeComponent(contents, accessToken);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
        'http://test-host/weknow/datasnap/rest/TComponentApi/Execute',
        expect.objectContaining({
            method: 'post',
            body: JSON.stringify({ contents, accessToken }),
            headers: { 'Content-Type': 'application/json' }
        })
    );

    expect(result).toEqual({ data: [{ id: 1, name: 'Test' }] });
});

test('executeMetadata should call TMetadataApi/Execute', async () => {
    const mockResponse = {
        json: vi.fn().mockResolvedValue({
            data: [{ id: 1, value: 'Test Data' }],
            success: true
        })
    };

    fetch.mockResolvedValue(mockResponse);

    const metadataId = '456';
    const accessToken = 'token456';

    const result = await weknowService.executeMetadata(metadataId, accessToken);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
        'http://test-host/weknow/datasnap/rest/TMetadataApi/Execute',
        expect.objectContaining({
            method: 'post',
            body: JSON.stringify({ metadataId, accessToken }),
            headers: { 'Content-Type': 'application/json' }
        })
    );

    expect(result).toEqual({
        data: [{ id: 1, value: 'Test Data' }],
        success: true
    });
});

test('renderComponent should use puppeteer to render table component', async () => {
    const mockPage = {
        evaluateOnNewDocument: vi.fn(),
        goto: vi.fn(),
        evaluate: vi.fn(),
        waitForSelector: vi.fn(),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png-data'))
    };

    const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn()
    };

    puppeteer.launch.mockResolvedValue(mockBrowser);

    const config = { type: 3 }; // ObjectTypes.Table = 3
    const data = [{ id: 1, name: 'Test' }];

    const result = await weknowService.renderComponent(config, data);

    // Verify puppeteer.launch was called with correct options
    expect(puppeteer.launch).toHaveBeenCalledWith({
        executablePath: '/path/to/chrome'
    });

    // Verify page navigation
    expect(mockPage.goto).toHaveBeenCalledTimes(2);
    expect(mockPage.goto).toHaveBeenNthCalledWith(1, 'http://test-host:8080/#/desktopstart');
    expect(mockPage.goto).toHaveBeenNthCalledWith(2, 'http://test-host:8080/#/objectViewer');

    // Verify page.evaluate was called
    expect(mockPage.evaluate).toHaveBeenCalled();

    // Verify waitForSelector for table
    expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '.dx-datagrid, .component-load-error',
        { visible: true }
    );

    // Verify screenshot was taken
    expect(mockPage.screenshot).toHaveBeenCalledWith({
        encoding: 'binary',
        type: 'png'
    });

    // Verify browser was closed
    expect(mockBrowser.close).toHaveBeenCalled();

    // Verify result
    expect(result).toBeInstanceOf(Buffer);
});

test('renderComponent should use puppeteer to render chart component', async () => {
    const mockPage = {
        evaluateOnNewDocument: vi.fn(),
        goto: vi.fn(),
        evaluate: vi.fn(),
        waitForSelector: vi.fn(),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png-data'))
    };

    const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn()
    };

    puppeteer.launch.mockResolvedValue(mockBrowser);

    const config = { type: 5 }; // ObjectTypes.Chart = 5
    const data = [{ x: 1, y: 10 }];

    const result = await weknowService.renderComponent(config, data);

    // Verify waitForSelector for chart
    expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '.highcharts-container, .component-load-error',
        { visible: true }
    );

    expect(result).toBeInstanceOf(Buffer);
});

test('getUrl should build correct URL with default host', () => {
    delete process.env.WEKNOW_API_HOST;

    const mockResponse = {
        json: vi.fn().mockResolvedValue({ success: true })
    };

    fetch.mockResolvedValue(mockResponse);

    weknowService.authenticate('user', 'pass', 'web', 'token');

    // Verify URL uses localhost as default
    expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost/weknow/datasnap/rest/'),
        expect.any(Object)
    );
});
