// Centralized Production State
export const productionState = {
    selectedPDM: null,
    searchQuery: '', // For Library
    supportedSearchQuery: '', // For Supported Headings
    selectedFamily: 'all',
    selectedSupportedLink: 'all', // For Supported Link filter
    selectedImportIds: new Set(),
    selectedSupportedIds: new Set(),
    isCoProMode: false
};

// Window bridge removed - import directly from this module
