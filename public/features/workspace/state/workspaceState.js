// Centralized Workspace State
export const workspaceState = {
    // Central registry for headings (prevents duplication)
    headingsRegistry: {},

    // Workflow tracking (ID references only)
    importedHeadingIds: [],
    supportedHeadingIds: [],

    currentPDM: {
        headings: [],
        url: '',
        description: '',
        companyType: [],
        typeOfProof: '',
        comment: ''
    },
    savedPDMs: [],
    selectedFamily: 'all',
    selectedSupportedFamily: 'all',
    availableFamilies: [],
    importHistory: [],
    searchQuery: '',
    existingHeadings: []
};

// Window bridge removed - import directly from this module
