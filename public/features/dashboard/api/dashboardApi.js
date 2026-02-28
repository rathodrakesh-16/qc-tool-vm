import { authManager } from '../../../core/auth/AuthManager.js';

const EMPTY_METADATA = Object.freeze({
    statuses: [],
    documentTypes: [],
    noteSubjects: [],
    accountFileTypes: [],
    accountIdPolicy: {},
});

let metadataCache = null;

function normalizeOptionList(options, fallback) {
    if (!Array.isArray(options)) {
        return fallback;
    }

    const cleaned = options
        .filter(item => item && typeof item.value === 'string' && item.value.trim() !== '')
        .map(item => ({
            value: item.value.trim(),
            label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.value.trim(),
        }));

    return cleaned.length > 0 ? cleaned : fallback;
}

function cloneMetadataShape(source = EMPTY_METADATA) {
    return {
        statuses: Array.isArray(source.statuses) ? [...source.statuses] : [],
        documentTypes: Array.isArray(source.documentTypes) ? [...source.documentTypes] : [],
        noteSubjects: Array.isArray(source.noteSubjects) ? [...source.noteSubjects] : [],
        accountFileTypes: Array.isArray(source.accountFileTypes) ? [...source.accountFileTypes] : [],
        accountIdPolicy: { ...(source.accountIdPolicy || {}) },
    };
}

function normalizeStringList(values, fallback) {
    if (!Array.isArray(values)) {
        return fallback;
    }

    const cleaned = values
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean);

    return cleaned.length > 0 ? cleaned : fallback;
}

function normalizeAccountFileTypes(values, fallback) {
    if (!Array.isArray(values)) {
        return fallback;
    }

    const cleaned = values
        .filter(item => item && typeof item.value === 'string' && item.value.trim() !== '')
        .map(item => ({
            value: item.value.trim(),
            label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.value.trim(),
            extensions: normalizeStringList(item.extensions, []),
        }));

    return cleaned.length > 0 ? cleaned : fallback;
}

export function getCachedDashboardMetadata() {
    return metadataCache || cloneMetadataShape();
}

export async function fetchDashboardMetadata(forceRefresh = false) {
    if (!forceRefresh && metadataCache) {
        return metadataCache;
    }

    const response = await fetch('/api/dashboard/metadata', {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw await authManager.parseApiError(response, `Failed to fetch dashboard metadata (${response.status})`);
    }

    const payload = await response.json();
    const fallback = cloneMetadataShape(metadataCache || EMPTY_METADATA);

    metadataCache = {
        statuses: normalizeOptionList(payload?.statuses, fallback.statuses),
        documentTypes: normalizeOptionList(payload?.documentTypes, fallback.documentTypes),
        noteSubjects: normalizeStringList(payload?.noteSubjects, fallback.noteSubjects),
        accountFileTypes: normalizeAccountFileTypes(payload?.accountFileTypes, fallback.accountFileTypes),
        accountIdPolicy: { ...(payload?.accountIdPolicy || fallback.accountIdPolicy) },
    };

    return metadataCache;
}

export async function fetchAccounts() {
    return authManager.fetchAccounts();
}

export async function createAccount(accountData) {
    return authManager.createAccount(accountData);
}

export async function updateAccount(accountId, accountData) {
    return authManager.updateAccount(accountId, accountData);
}

export async function deleteAccount(accountId) {
    return authManager.deleteAccount(accountId);
}

export async function fetchDocuments() {
    return authManager.fetchDocuments();
}

export async function createDocument(documentData) {
    return authManager.createDocument(documentData);
}

export async function deleteDocument(documentId) {
    return authManager.deleteDocument(documentId);
}
