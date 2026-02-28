<?php

namespace App\Http\Controllers;

use App\Domain\Dashboard\AccountIdFormatter;
use App\Domain\Dashboard\FileTypeClassifier;
use App\Http\Requests\Dashboard\StoreAccountCommentRequest;
use App\Http\Requests\Dashboard\StoreAccountNoteRequest;
use App\Http\Requests\Dashboard\UpdateAccountNoteRequest;
use App\Http\Requests\Dashboard\UploadAccountDataFileRequest;
use App\Http\Resources\AccountCommentResource;
use App\Http\Resources\AccountDataFileResource;
use App\Http\Resources\AccountNoteResource;
use App\Models\Account;
use App\Models\AccountComment;
use App\Models\AccountDataFile;
use App\Models\AccountNote;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class AccountDataController extends Controller
{
    // ──────────────────────────────────────────────
    //  Files
    // ──────────────────────────────────────────────

    public function listFiles(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $files = $account->files()
            ->with('uploadedBy:userId,username')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'files' => $files
                ->map(fn (AccountDataFile $f) => (new AccountDataFileResource($f))->toArray(request()))
                ->values(),
        ]);
    }

    public function uploadFiles(UploadAccountDataFileRequest $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $currentUser = Auth::user();
        $uploaded = [];
        $storedFiles = [];

        DB::beginTransaction();

        try {
            foreach ($request->file('files') as $file) {
                $originalName = $file->getClientOriginalName();
                $extension = strtolower($file->getClientOriginalExtension());
                $storedName = Str::uuid7()->toString() . '.' . $extension;
                $directory = "account_files/{$account->account_id}";
                $path = "{$directory}/{$storedName}";

                Storage::disk('local')->putFileAs($directory, $file, $storedName);
                $storedFiles[] = ['disk' => 'local', 'path' => $path];

                $record = AccountDataFile::create([
                    'account_id' => $account->account_id,
                    'original_name' => $originalName,
                    'stored_name' => $storedName,
                    'disk' => 'local',
                    'path' => $path,
                    'mime_type' => $file->getClientMimeType(),
                    'file_type' => FileTypeClassifier::classify($originalName),
                    'size' => $file->getSize(),
                    'uploaded_by_user_id' => $currentUser?->userId,
                ]);

                $record->load('uploadedBy:userId,username');
                $uploaded[] = (new AccountDataFileResource($record))->toArray(request());
            }

            DB::commit();
        } catch (InvalidArgumentException $e) {
            DB::rollBack();
            $this->cleanupStoredFiles($storedFiles);

            return $this->validationErrorResponse('files', $e->getMessage());
        } catch (QueryException $e) {
            DB::rollBack();
            $this->cleanupStoredFiles($storedFiles);

            if ($e->getCode() === '23505') {
                return $this->validationErrorResponse('files', 'A file with the same storage path already exists.');
            }

            throw $e;
        } catch (Throwable $e) {
            DB::rollBack();
            $this->cleanupStoredFiles($storedFiles);
            throw $e;
        }

        return response()->json([
            'files' => $uploaded,
            'message' => count($uploaded) . ' file(s) uploaded successfully',
        ], 201);
    }

    public function downloadFile(string $accountCode, string $fileId)
    {
        $account = $this->resolveAccount($accountCode);
        $file = $account->files()->where('id', $fileId)->firstOrFail();

        abort_unless(Storage::disk($file->disk)->exists($file->path), 404, 'File not found on disk.');

        return Storage::disk($file->disk)->download($file->path, $file->original_name);
    }

    public function previewFile(string $accountCode, string $fileId)
    {
        $account = $this->resolveAccount($accountCode);
        $file = $account->files()->where('id', $fileId)->firstOrFail();

        abort_unless(Storage::disk($file->disk)->exists($file->path), 404, 'File not found on disk.');

        return response()->file(
            Storage::disk($file->disk)->path($file->path),
            ['Content-Type' => $file->mime_type]
        );
    }

    public function deleteFile(string $accountCode, string $fileId)
    {
        $account = $this->resolveAccount($accountCode);
        $file = $account->files()->where('id', $fileId)->firstOrFail();

        Storage::disk($file->disk)->delete($file->path);
        $file->delete();

        return response()->json(['message' => 'File deleted successfully']);
    }

    // ──────────────────────────────────────────────
    //  Notes
    // ──────────────────────────────────────────────

    public function listNotes(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $notes = $account->notes()
            ->with('createdBy:userId,username')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'notes' => $notes
                ->map(fn (AccountNote $n) => (new AccountNoteResource($n))->toArray(request()))
                ->values(),
        ]);
    }

    public function storeNote(StoreAccountNoteRequest $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $validated = $request->validated();
        $currentUser = Auth::user();

        $note = AccountNote::create([
            'account_id' => $account->account_id,
            'subject' => $validated['subject'],
            'content' => $validated['content'],
            'created_by_user_id' => $currentUser?->userId,
            'updated_by_user_id' => $currentUser?->userId,
        ]);

        $note->load('createdBy:userId,username');

        return response()->json([
            'note' => (new AccountNoteResource($note))->toArray(request()),
            'message' => 'Note created successfully',
        ], 201);
    }

    public function updateNote(UpdateAccountNoteRequest $request, string $accountCode, string $noteId)
    {
        $account = $this->resolveAccount($accountCode);
        $note = $account->notes()->where('id', $noteId)->firstOrFail();
        $validated = $request->validated();

        $note->fill($validated);
        $note->updated_by_user_id = Auth::user()?->userId;
        $note->save();

        $note->load('createdBy:userId,username');

        return response()->json([
            'note' => (new AccountNoteResource($note))->toArray(request()),
            'message' => 'Note updated successfully',
        ]);
    }

    public function deleteNote(string $accountCode, string $noteId)
    {
        $account = $this->resolveAccount($accountCode);
        $note = $account->notes()->where('id', $noteId)->firstOrFail();

        $note->delete();

        return response()->json(['message' => 'Note deleted successfully']);
    }

    // ──────────────────────────────────────────────
    //  Comments
    // ──────────────────────────────────────────────

    public function listComments(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $comments = $account->comments()
            ->with('user:userId,username')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'comments' => $comments
                ->map(fn (AccountComment $c) => (new AccountCommentResource($c))->toArray(request()))
                ->values(),
        ]);
    }

    public function storeComment(StoreAccountCommentRequest $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $validated = $request->validated();
        $currentUser = Auth::user();

        $comment = AccountComment::create([
            'account_id' => $account->account_id,
            'text' => $validated['text'],
            'user_id' => $currentUser?->userId,
        ]);

        $comment->load('user:userId,username');

        return response()->json([
            'comment' => (new AccountCommentResource($comment))->toArray(request()),
            'message' => 'Comment created successfully',
        ], 201);
    }

    public function updateComment(StoreAccountCommentRequest $request, string $accountCode, string $commentId)
    {
        $account = $this->resolveAccount($accountCode);
        $comment = $account->comments()->where('id', $commentId)->firstOrFail();
        $this->authorize('update', $comment);

        $comment->update(['text' => $request->validated()['text']]);
        $comment->load('user:userId,username');

        return response()->json([
            'comment' => (new AccountCommentResource($comment))->toArray(request()),
            'message' => 'Comment updated successfully',
        ]);
    }

    public function deleteComment(string $accountCode, string $commentId)
    {
        $account = $this->resolveAccount($accountCode);
        $comment = $account->comments()->where('id', $commentId)->firstOrFail();
        $this->authorize('delete', $comment);

        $comment->delete();

        return response()->json(['message' => 'Comment deleted successfully']);
    }

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    private function resolveAccount(string $accountCode): Account
    {
        $storedId = AccountIdFormatter::toStoredNullable($accountCode);
        abort_if($storedId === null, 404);

        return Account::where('account_id', $storedId)->firstOrFail();
    }

    /**
     * @param array<int, array{disk:string, path:string}> $storedFiles
     */
    private function cleanupStoredFiles(array $storedFiles): void
    {
        foreach (array_reverse($storedFiles) as $storedFile) {
            Storage::disk($storedFile['disk'])->delete($storedFile['path']);
        }
    }

    private function validationErrorResponse(string $field, string $message)
    {
        return response()->json([
            'message' => 'Validation failed',
            'errors' => [$field => [$message]],
        ], 422);
    }
}
