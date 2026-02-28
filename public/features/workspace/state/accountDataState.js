// Centralized Account Data State
// Shared across Editor and QC modes for files, notes, and comments

export const accountDataState = {
    currentAccountId: null,
    currentAccountData: {
        files: [],
        notes: [],
        comments: []
    },
    loading: false,
    error: null,
    activeRequestId: 0,
    noteSubjects: [],
    accountFileTypes: [],
    initialized: false
};

// Backward compatibility export for existing imports.
export const accountFilesState = accountDataState;
