import { authManager } from '../../../core/auth/AuthManager.js';

function buildBasePath(accountCode) {
    return `/api/dashboard/accounts/${encodeURIComponent(accountCode)}`;
}

async function requestJson(url, options, fallbackMessage) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw await authManager.parseApiError(response, fallbackMessage);
    }

    return await response.json();
}

function buildCsrfHeaders() {
    const token = authManager.getCookieValue('XSRF-TOKEN');
    const headers = { Accept: 'application/json' };

    if (token) {
        headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
    }

    return headers;
}

export async function listFiles(accountCode) {
    const payload = await requestJson(
        `${buildBasePath(accountCode)}/files`,
        {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        },
        'Failed to fetch account files.'
    );

    return payload?.files || [];
}

export async function uploadFiles(accountCode, files) {
    await authManager.ensureCsrfCookie();

    const formData = new FormData();
    files.forEach((file) => {
        formData.append('files[]', file);
    });

    return await requestJson(
        `${buildBasePath(accountCode)}/files`,
        {
            method: 'POST',
            credentials: 'include',
            headers: buildCsrfHeaders(),
            body: formData,
        },
        'Failed to upload files.'
    );
}

export async function deleteFile(accountCode, fileId) {
    await authManager.ensureCsrfCookie();

    return await requestJson(
        `${buildBasePath(accountCode)}/files/${encodeURIComponent(fileId)}`,
        {
            method: 'DELETE',
            credentials: 'include',
            headers: buildCsrfHeaders(),
        },
        'Failed to delete file.'
    );
}

export async function listNotes(accountCode) {
    const payload = await requestJson(
        `${buildBasePath(accountCode)}/notes`,
        {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        },
        'Failed to fetch notes.'
    );

    return payload?.notes || [];
}

export async function createNote(accountCode, noteData) {
    await authManager.ensureCsrfCookie();

    return await requestJson(
        `${buildBasePath(accountCode)}/notes`,
        {
            method: 'POST',
            credentials: 'include',
            headers: authManager.buildJsonHeaders(),
            body: JSON.stringify(noteData),
        },
        'Failed to create note.'
    );
}

export async function deleteNote(accountCode, noteId) {
    await authManager.ensureCsrfCookie();

    return await requestJson(
        `${buildBasePath(accountCode)}/notes/${encodeURIComponent(noteId)}`,
        {
            method: 'DELETE',
            credentials: 'include',
            headers: buildCsrfHeaders(),
        },
        'Failed to delete note.'
    );
}

export async function listComments(accountCode) {
    const payload = await requestJson(
        `${buildBasePath(accountCode)}/comments`,
        {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        },
        'Failed to fetch comments.'
    );

    return payload?.comments || [];
}

export async function createComment(accountCode, commentData) {
    await authManager.ensureCsrfCookie();

    return await requestJson(
        `${buildBasePath(accountCode)}/comments`,
        {
            method: 'POST',
            credentials: 'include',
            headers: authManager.buildJsonHeaders(),
            body: JSON.stringify(commentData),
        },
        'Failed to create comment.'
    );
}

export async function updateComment(accountCode, commentId, commentData) {
    await authManager.ensureCsrfCookie();

    return await requestJson(
        `${buildBasePath(accountCode)}/comments/${encodeURIComponent(commentId)}`,
        {
            method: 'PUT',
            credentials: 'include',
            headers: authManager.buildJsonHeaders(),
            body: JSON.stringify(commentData),
        },
        'Failed to update comment.'
    );
}

export async function deleteComment(accountCode, commentId) {
    await authManager.ensureCsrfCookie();

    return await requestJson(
        `${buildBasePath(accountCode)}/comments/${encodeURIComponent(commentId)}`,
        {
            method: 'DELETE',
            credentials: 'include',
            headers: buildCsrfHeaders(),
        },
        'Failed to delete comment.'
    );
}
