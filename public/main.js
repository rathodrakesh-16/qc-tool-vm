/**
 * main.js - Single Entry Point for QC Tool ES Modules
 *
 * This file replaces the 40+ individual <script type="module"> tags in index.html.
 * ES Modules only load when imported, so all modules must be reachable from here.
 *
 * Import order matters: modules that expose window globals must load before
 * modules that consume those globals.
 */

// 1. State modules (no dependencies, some consumed as globals)

import './features/workspace/state/workspaceState.js';
import './features/workspace/state/workspaceAccountsState.js';
import './features/workspace/state/productionState.js';
import './features/workspace/state/qcModeState.js';
import './features/workspace/state/qcSectionState.js';


// 2. Shared components & utilities (leaf modules not imported elsewhere)

import './features/workspace/sharedComponents/filters.js';


// 3. Workspace modules that expose window bridges (must load before modules that consume those globals)

import './features/workspace/editor/productionReport.js';
import './features/workspace/modals/headingDetailsModal.js';
import './features/workspace/modals/familyAssignModal.js';
import './features/workspace/modals/changeLogModal.js';
import './features/workspace/qc/qcReview.js';
import './features/workspace/qc/qcValidation.js';


// 4. Quality Control modules (leaf modules not imported elsewhere)

import './features/qualityControl/qcReport/qcReport.js';
import './features/qualityControl/qcReport/qcExport.js';


// 5. Core app entry — triggers initialization
//    (imports Router, eventHandlers, AuthManager internally,
//    which in turn import dashboard, workspace, importSection, etc.)

import './core/app.js';
