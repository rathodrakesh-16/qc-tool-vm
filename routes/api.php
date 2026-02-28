<?php

use App\Http\Controllers\AccountDataController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\QualityControlController;
use App\Http\Controllers\WorkspaceActivityLogController;
use App\Http\Controllers\WorkspaceExistingHeadingController;
use App\Http\Controllers\WorkspaceHeadingController;
use App\Http\Controllers\WorkspacePdmController;
use App\Http\Controllers\WorkspacePreferenceController;
use App\Http\Controllers\WorkspaceQcErrorController;
use App\Http\Controllers\WorkspaceQcFeedbackController;
use App\Http\Controllers\WorkspaceReportController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);

    Route::prefix('users')->group(function () {
        Route::get('/names', [AuthController::class, 'listUserNames']);
        Route::get('/by-userid/{userId}', [AuthController::class, 'showByUserId']);
        Route::get('/{uuid}', [AuthController::class, 'show']);
        Route::get('/', [AuthController::class, 'listUsers']);
        Route::post('/', [AuthController::class, 'createUser']);
        Route::put('/{uuid}', [AuthController::class, 'updateUser']);
        Route::delete('/{uuid}', [AuthController::class, 'deleteUser']);
    });

    Route::prefix('dashboard')->group(function () {
        Route::get('/metadata', [DashboardController::class, 'metadata']);
        Route::get('/accounts', [DashboardController::class, 'listAccounts']);
        Route::post('/accounts', [DashboardController::class, 'createAccount']);
        Route::put('/accounts/{accountCode}', [DashboardController::class, 'updateAccount']);
        Route::delete('/accounts/{accountCode}', [DashboardController::class, 'deleteAccount']);

        Route::get('/documents', [DashboardController::class, 'listDocuments']);
        Route::post('/documents', [DashboardController::class, 'createDocument']);
        Route::delete('/documents/{documentId}', [DashboardController::class, 'deleteDocument']);

        Route::prefix('accounts/{accountCode}')->group(function () {
            // Files
            Route::get('/files', [AccountDataController::class, 'listFiles']);
            Route::post('/files', [AccountDataController::class, 'uploadFiles']);
            Route::get('/files/{fileId}/download', [AccountDataController::class, 'downloadFile']);
            Route::get('/files/{fileId}/preview', [AccountDataController::class, 'previewFile']);
            Route::delete('/files/{fileId}', [AccountDataController::class, 'deleteFile']);

            // Notes
            Route::get('/notes', [AccountDataController::class, 'listNotes']);
            Route::post('/notes', [AccountDataController::class, 'storeNote']);
            Route::put('/notes/{noteId}', [AccountDataController::class, 'updateNote']);
            Route::delete('/notes/{noteId}', [AccountDataController::class, 'deleteNote']);

            // Comments
            Route::get('/comments', [AccountDataController::class, 'listComments']);
            Route::post('/comments', [AccountDataController::class, 'storeComment']);
            Route::put('/comments/{commentId}', [AccountDataController::class, 'updateComment']);
            Route::delete('/comments/{commentId}', [AccountDataController::class, 'deleteComment']);

            // Workspace: Headings
            Route::get('/headings', [WorkspaceHeadingController::class, 'index']);
            Route::get('/headings/families', [WorkspaceHeadingController::class, 'families']);
            Route::post('/headings/import', [WorkspaceHeadingController::class, 'import']);
            Route::put('/headings/{headingId}', [WorkspaceHeadingController::class, 'update']);
            Route::delete('/headings/{headingId}', [WorkspaceHeadingController::class, 'destroy']);
            Route::get('/import-batches', [WorkspaceHeadingController::class, 'importBatches']);

            // Workspace: PDMs
            Route::get('/pdms', [WorkspacePdmController::class, 'index']);
            Route::post('/pdms', [WorkspacePdmController::class, 'store']);
            Route::put('/pdms/{pdmId}', [WorkspacePdmController::class, 'update']);
            Route::delete('/pdms/{pdmId}', [WorkspacePdmController::class, 'destroy']);
            Route::patch('/pdms/{pdmId}/uploaded', [WorkspacePdmController::class, 'updateUploaded']);
            Route::patch('/pdms/{pdmId}/qc-status', [WorkspacePdmController::class, 'updateQcStatus']);
            Route::patch('/pdms/{pdmId}/rectification', [WorkspacePdmController::class, 'updateRectification']);
            Route::patch('/pdms/{pdmId}/validation', [WorkspacePdmController::class, 'updateValidation']);

            // Workspace: QC Feedback
            Route::get('/pdms/{pdmId}/feedback', [WorkspaceQcFeedbackController::class, 'show']);
            Route::post('/pdms/{pdmId}/feedback', [WorkspaceQcFeedbackController::class, 'store']);
            Route::get('/pdms/{pdmId}/feedback/history', [WorkspaceQcFeedbackController::class, 'history']);

            // Workspace: QC Errors
            Route::get('/qc-errors', [WorkspaceQcErrorController::class, 'index']);
            Route::post('/qc-errors', [WorkspaceQcErrorController::class, 'store']);
            Route::patch('/qc-errors/{errorId}', [WorkspaceQcErrorController::class, 'update']);
            Route::delete('/qc-errors/{errorId}', [WorkspaceQcErrorController::class, 'destroy']);

            // Workspace: Reports
            Route::get('/reports/production', [WorkspaceReportController::class, 'production']);
            Route::get('/reports/qc', [WorkspaceReportController::class, 'qc']);
            Route::post('/reports/qc/export', [WorkspaceReportController::class, 'exportQc']);

            // Workspace: Activity Logs
            Route::get('/activity-logs', [WorkspaceActivityLogController::class, 'index']);

            // Workspace: Existing Headings
            Route::post('/existing-headings/upload', [WorkspaceExistingHeadingController::class, 'upload']);
            Route::get('/existing-headings', [WorkspaceExistingHeadingController::class, 'active']);
            Route::get('/existing-headings/snapshots', [WorkspaceExistingHeadingController::class, 'snapshots']);
        });
    });

    Route::prefix('user')->group(function () {
        Route::get('/preferences', [WorkspacePreferenceController::class, 'show']);
        Route::put('/preferences', [WorkspacePreferenceController::class, 'update']);
    });

    Route::prefix('qc')->group(function () {
        Route::post('/classifications', [QualityControlController::class, 'classifications']);
        Route::post('/report', [QualityControlController::class, 'report']);
        Route::post('/export', [QualityControlController::class, 'export']);
        Route::get('/config', [QualityControlController::class, 'config']);
        Route::post('/ai-validate', [QualityControlController::class, 'aiValidate'])
            ->middleware('throttle:ai-validate');
    });
});
