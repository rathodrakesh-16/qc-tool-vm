<?php

namespace App\Http\Controllers;

use App\Domain\QualityControl\ClassificationService;
use App\Domain\QualityControl\ExportService;
use App\Domain\QualityControl\GeminiValidationService;
use App\Domain\QualityControl\ReportService;
use App\Http\Requests\QualityControl\ClassificationsRequest;
use App\Http\Requests\QualityControl\ExportRequest;
use App\Http\Requests\QualityControl\ReportRequest;
use App\Jobs\ProcessAiValidationJob;
use App\Models\AiValidationTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class QualityControlController extends Controller
{
    public function classifications(
        ClassificationsRequest $request,
        ClassificationService $classificationService
    ): JsonResponse
    {
        return response()->json(
            $classificationService->generate($request->validated())
        );
    }

    public function report(
        ReportRequest $request,
        ReportService $reportService
    ): JsonResponse
    {
        return response()->json(
            $reportService->generate($request->validated())
        );
    }

    public function export(
        ExportRequest $request,
        ExportService $exportService
    ): JsonResponse|BinaryFileResponse
    {
        try {
            $exportResult = $exportService->generate($request->validated());

            return response()
                ->download($exportResult['path'], $exportResult['filename'])
                ->deleteFileAfterSend();
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'errors' => (object) [],
            ], 503);
        }
    }

    public function config(): JsonResponse
    {
        return response()->json([
            'qualityControl' => config('qualitycontrol'),
        ]);
    }

    public function aiValidate(
        Request $request,
        GeminiValidationService $geminiService
    ): JsonResponse
    {
        // Allow up to 6 minutes — batched requests (up to 4 chunks × 120s each)
        set_time_limit(360);
        
        $pdmDescriptions = $request->input('pdmDescriptions', []);

        if (!is_array($pdmDescriptions)) {
            return response()->json([
                'results' => [],
                'warning' => 'Invalid input format.',
                'enabled' => false,
            ]);
        }

        // Limit batch size to prevent abuse
        if (count($pdmDescriptions) > 100) {
            return response()->json([
                'results' => [],
                'warning' => 'Too many PDM descriptions. Maximum 100 per request.',
                'enabled' => true,
            ]);
        }

        // Ensure all keys and values are strings (PHP JSON decode might parse numeric keys as int)
        $cleaned = [];
        foreach ($pdmDescriptions as $key => $value) {
            if ((is_string($key) || is_int($key)) && is_string($value)) {
                $cleaned[(string)$key] = $value;
            }
        }

        return response()->json(
            $geminiService->validateDescriptions($cleaned)
        );
    }

    public function aiValidateStart(Request $request): JsonResponse
    {
        $request->validate([
            'pdmDescriptions' => ['required', 'array', 'max:200'],
            'pdmDescriptions.*' => ['string'],
        ]);

        $apiKey = config('qualitycontrol.gemini.api_key', '');
        $enabled = config('qualitycontrol.gemini.enabled', true);

        if (!$enabled || trim($apiKey) === '') {
            return response()->json(['enabled' => false]);
        }

        // Filter empty descriptions
        $filtered = [];
        foreach ($request->input('pdmDescriptions') as $pdmNum => $text) {
            $trimmed = trim((string) $text);
            if ($trimmed !== '') {
                $filtered[(string) $pdmNum] = $trimmed;
            }
        }

        if (empty($filtered)) {
            return response()->json(['enabled' => true, 'cached' => true, 'results' => [], 'warning' => null]);
        }

        $cacheKey = 'gemini_validation_' . md5(json_encode($filtered));

        // Return cached result immediately if available
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return response()->json(array_merge($cached, ['cached' => true]));
        }

        // Prune expired tasks
        AiValidationTask::where('expires_at', '<', now())->delete();

        $chunks = array_chunk($filtered, 25, true);
        $totalBatches = count($chunks);

        $task = AiValidationTask::create([
            'id' => (string) Str::uuid(),
            'status' => 'pending',
            'total_batches' => $totalBatches,
            'completed_batches' => 0,
            'results' => [],
            'warning' => null,
            'expires_at' => now()->addMinutes(20),
        ]);

        ProcessAiValidationJob::dispatch($task->id, $filtered, $cacheKey);

        return response()->json([
            'cached' => false,
            'enabled' => true,
            'jobId' => $task->id,
            'totalBatches' => $totalBatches,
        ]);
    }

    public function aiValidateStatus(string $taskId): JsonResponse
    {
        $task = AiValidationTask::find($taskId);

        if (!$task) {
            return response()->json([
                'status' => 'failed',
                'warning' => 'AI validation session not found. Please try again.',
                'enabled' => true,
                'completedBatches' => 0,
                'totalBatches' => 0,
                'results' => [],
            ]);
        }

        return response()->json([
            'status' => $task->status,
            'completedBatches' => $task->completed_batches,
            'totalBatches' => $task->total_batches,
            'results' => $task->results,
            'warning' => $task->warning,
            'enabled' => true,
        ]);
    }
}
