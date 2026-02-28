<?php

namespace App\Http\Controllers;

use App\Domain\Dashboard\AccountIdFormatter;
use App\Http\Requests\Dashboard\StoreAccountRequest;
use App\Http\Requests\Dashboard\StoreDocumentRequest;
use App\Http\Requests\Dashboard\UpdateAccountRequest;
use App\Http\Resources\AccountResource;
use App\Http\Resources\DocumentResource;
use App\Models\Account;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    /**
     * Get all accounts.
     */
    public function listAccounts()
    {
        $accounts = Account::query()
            ->with(['editorUser:userId,username,email', 'qcUser:userId,username,email'])
            ->orderByDesc('is_system')
            ->orderBy('account_id')
            ->get();

        return response()->json([
            'accounts' => $accounts
                ->map(fn (Account $account) => (new AccountResource($account))->toArray(request()))
                ->values(),
        ]);
    }

    /**
     * Create an account card.
     */
    public function createAccount(StoreAccountRequest $request)
    {
        $validated = $request->validated();

        $editorUser = $this->resolveDashboardUser($validated['editor']);
        if (!$editorUser) {
            return $this->validationErrorResponse('editor', 'Editor must match an existing user.');
        }

        $qcUser = $this->resolveDashboardUser($validated['qc']);
        if (!$qcUser) {
            return $this->validationErrorResponse('qc', 'QC must match an existing user.');
        }

        $currentUser = Auth::user();
        $normalizedAccountId = AccountIdFormatter::toStored($validated['account_id']);

        try {
            $account = Account::create([
                'account_id' => $normalizedAccountId,
                'account_name' => trim($validated['account_name']),
                'editor_user_id' => $editorUser->userId,
                'qc_user_id' => $qcUser->userId,
                'status' => $validated['status'] ?? 'assigned',
                'assigned_date' => $validated['assigned_date'] ?? null,
                'delivery_date' => $validated['delivery_date'] ?? null,
                'created_by_user_id' => $currentUser?->userId,
                'updated_by_user_id' => $currentUser?->userId,
            ]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') {
                return $this->validationErrorResponse('account_id', 'An account with this ID already exists.');
            }
            throw $e;
        }

        $account->load(['editorUser:userId,username,email', 'qcUser:userId,username,email']);

        return response()->json([
            'account' => (new AccountResource($account))->toArray(request()),
            'message' => 'Account created successfully',
        ], 201);
    }

    /**
     * Update an account card.
     */
    public function updateAccount(UpdateAccountRequest $request, string $accountCode)
    {
        $routeAccountId = AccountIdFormatter::toStoredNullable($accountCode);
        abort_if($routeAccountId === null, 404);

        $account = Account::where('account_id', $routeAccountId)->firstOrFail();
        $validated = $request->validated();

        $editorUser = $this->resolveDashboardUser($validated['editor']);
        if (!$editorUser) {
            return $this->validationErrorResponse('editor', 'Editor must match an existing user.');
        }

        $qcUser = $this->resolveDashboardUser($validated['qc']);
        if (!$qcUser) {
            return $this->validationErrorResponse('qc', 'QC must match an existing user.');
        }

        $account->fill([
            'account_name' => trim($validated['account_name']),
            'editor_user_id' => $editorUser->userId,
            'qc_user_id' => $qcUser->userId,
            'status' => $validated['status'] ?? $account->status,
            'assigned_date' => $validated['assigned_date'] ?? null,
            'delivery_date' => $validated['delivery_date'] ?? null,
            'updated_by_user_id' => Auth::user()?->userId,
        ]);

        try {
            $account->save();
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') {
                return $this->validationErrorResponse('account_id', 'An account with this ID already exists.');
            }
            throw $e;
        }

        $account->load(['editorUser:userId,username,email', 'qcUser:userId,username,email']);

        return response()->json([
            'account' => (new AccountResource($account))->toArray(request()),
            'message' => 'Account updated successfully',
        ]);
    }

    /**
     * Soft-delete an account card.
     */
    public function deleteAccount(string $accountCode)
    {
        $storedAccountId = AccountIdFormatter::toStoredNullable($accountCode);
        abort_if($storedAccountId === null, 404);

        $account = Account::where('account_id', $storedAccountId)->firstOrFail();

        if ($account->is_system) {
            return $this->forbiddenResponse('System accounts cannot be deleted.');
        }

        $account->delete();

        return response()->json(['message' => 'Account deleted successfully']);
    }

    /**
     * Get all documents.
     */
    public function listDocuments()
    {
        $documents = Document::query()
            ->orderByDesc('is_system')
            ->orderBy('doccument_name')
            ->get();

        return response()->json([
            'documents' => $documents
                ->map(fn (Document $document) => (new DocumentResource($document))->toArray(request()))
                ->values(),
        ]);
    }

    /**
     * Create a document.
     */
    public function createDocument(StoreDocumentRequest $request)
    {
        $validated = $request->validated();

        $currentUser = Auth::user();

        $document = Document::create([
            'doccument_name' => trim($validated['doccument_name']),
            'doccument_link' => trim($validated['doccument_link']),
            'doc_type' => $validated['doc_type'] ?? 'other',
            'icon_class' => $validated['icon_class'] ?? null,
            'is_system' => $validated['is_system'] ?? false,
            'created_by_user_id' => $currentUser?->userId,
            'updated_by_user_id' => $currentUser?->userId,
        ]);

        return response()->json([
            'document' => (new DocumentResource($document))->toArray(request()),
            'message' => 'Document created successfully',
        ], 201);
    }

    /**
     * Delete a document.
     */
    public function deleteDocument(string $documentId)
    {
        abort_unless($this->isAdmin(), 403, 'Forbidden');

        $document = Document::where('id', $documentId)->firstOrFail();

        abort_if($document->is_system, 403, 'System documents cannot be deleted.');

        $document->delete();

        return response()->json(['message' => 'Document deleted successfully']);
    }

    /**
     * Get metadata used by dashboard UI.
     */
    public function metadata()
    {
        $statuses = collect(config('dashboard.statuses', []))
            ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
            ->values();
        $documentTypes = collect(config('dashboard.document_types', []))
            ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
            ->values();
        $noteSubjects = collect(config('dashboard.note_subjects', []))
            ->filter(fn ($subject) => is_string($subject) && trim($subject) !== '')
            ->values();
        $accountFileTypes = collect(config('dashboard.account_file_types', []))
            ->map(function ($extensions, $value) {
                $normalizedValue = (string) $value;
                $labelMap = [
                    'excel' => 'Excel',
                    'pdf' => 'PDF',
                    'image' => 'Images',
                    'video' => 'Videos',
                ];

                return [
                    'value' => $normalizedValue,
                    'label' => $labelMap[$normalizedValue] ?? ucfirst($normalizedValue),
                    'extensions' => collect($extensions)
                        ->filter(fn ($extension) => is_string($extension) && trim($extension) !== '')
                        ->values(),
                ];
            })
            ->values();

        return response()->json([
            'statuses' => $statuses,
            'documentTypes' => $documentTypes,
            'noteSubjects' => $noteSubjects,
            'accountFileTypes' => $accountFileTypes,
            'accountIdPolicy' => [
                'regex' => config('dashboard.account_id.regex'),
                'min' => config('dashboard.account_id.min'),
                'max' => config('dashboard.account_id.max'),
                'displayLength' => config('dashboard.account_id.display_length'),
            ],
        ]);
    }

    private function resolveDashboardUser(string $identifier): ?User
    {
        $normalized = trim($identifier);
        if ($normalized === '') {
            return null;
        }

        $lower = strtolower($normalized);

        return User::query()
            ->whereRaw('LOWER("userId") = ?', [$lower])
            ->orWhereRaw('LOWER("email") = ?', [$lower])
            ->orWhereRaw('LOWER("username") = ?', [$lower])
            ->first();
    }

    private function isAdmin(): bool
    {
        $currentUser = Auth::user();
        return $currentUser && $currentUser->role === 'admin';
    }

    private function forbiddenResponse(string $message = 'Forbidden')
    {
        return response()->json([
            'message' => $message,
            'errors' => (object) [],
        ], 403);
    }

    private function validationErrorResponse(string $field, string $message)
    {
        return response()->json([
            'message' => 'Validation failed',
            'errors' => [$field => [$message]],
        ], 422);
    }
}
