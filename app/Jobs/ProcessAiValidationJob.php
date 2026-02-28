<?php

namespace App\Jobs;

use App\Domain\QualityControl\GeminiValidationService;
use App\Models\AiValidationTask;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ProcessAiValidationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $timeout = 900;  // 15 min max (8 chunks × ~120s each)
    public int $tries = 1;      // GeminiValidationService already retries internally

    public function __construct(
        private string $taskId,
        private array $filtered,
        private string $cacheKey,
    ) {}

    public function handle(GeminiValidationService $service): void
    {
        $task = AiValidationTask::find($this->taskId);
        if (!$task) {
            return; // task was deleted by expired cleanup
        }

        $task->update(['status' => 'processing']);

        $chunks = array_chunk($this->filtered, 25, true);
        $allResults = [];

        foreach ($chunks as $i => $chunk) {
            try {
                $parsed = $service->processChunk($chunk);

                if ($parsed['warning'] !== null) {
                    Log::warning('AI validation chunk returned warning', [
                        'task_id' => $this->taskId,
                        'batch' => $i + 1,
                        'warning' => $parsed['warning'],
                    ]);
                } else {
                    foreach ($parsed['results'] as $item) {
                        $allResults[] = $item;
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('AI validation batch failed', [
                    'task_id' => $this->taskId,
                    'batch' => $i + 1,
                    'error' => $e->getMessage(),
                ]);
            }

            // Update progress after each chunk so the frontend can poll partial results
            $task->update([
                'completed_batches' => $i + 1,
                'results' => $allResults,
            ]);
        }

        $fullResult = ['results' => $allResults, 'warning' => null, 'enabled' => true];
        Cache::put($this->cacheKey, $fullResult, now()->addMinutes(15));

        $task->update(['status' => 'complete']);
    }

    public function failed(\Throwable $e): void
    {
        Log::error('ProcessAiValidationJob failed', [
            'task_id' => $this->taskId,
            'error' => $e->getMessage(),
        ]);

        $task = AiValidationTask::find($this->taskId);
        $task?->update([
            'status' => 'failed',
            'warning' => 'AI validation failed. Please try again.',
        ]);
    }
}
