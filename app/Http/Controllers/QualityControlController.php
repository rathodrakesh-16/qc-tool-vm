<?php

namespace App\Http\Controllers;

use App\Domain\QualityControl\ClassificationService;
use App\Domain\QualityControl\ExportService;
use App\Domain\QualityControl\GeminiValidationService;
use App\Domain\QualityControl\ReportService;
use App\Http\Requests\QualityControl\ClassificationsRequest;
use App\Http\Requests\QualityControl\ExportRequest;
use App\Http\Requests\QualityControl\ReportRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        // Allow up to 3 minutes for API response
        set_time_limit(180);
        
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
}
