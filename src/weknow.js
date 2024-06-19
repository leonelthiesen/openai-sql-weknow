import fetch from 'node-fetch';
import crypto from 'crypto';

let metadataSummaryCache = {};

function getUrl(path) {
    return `http://${process.env.WEKNOW_API_HOST | 'localhost'}/weknow/datasnap/rest/${path}`;
}

export async function authenticate(userName, password, clientAppType, accountToken) {
    let url = getUrl('TSecurityApi/Authenticate');

    const passwordHash64 = crypto.createHash('sha512').update(process.env.WEKNOW_PASSWORD_SALT + password).digest('base64');

    const body = { userName, passwordHash64, clientAppType, accountToken };

    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
}

export async function getMetadataSummary(metadataId, accessToken) {
    if (metadataSummaryCache[metadataId]) {
        return metadataSummaryCache[metadataId];
    }

    let url = getUrl('TMetadataApi/Summary');

    const body = { metadataId, accessToken };

    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    metadataSummaryCache[metadataId] = await response.json();
    return await metadataSummaryCache[metadataId];
}

export async function executeComponent(contents, accessToken) {
    let url = getUrl('TComponentApi/Execute');

    const body = { contents, accessToken };

    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
}
