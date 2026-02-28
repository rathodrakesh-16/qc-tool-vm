<?php

namespace Tests\Unit;

use App\Domain\QualityControl\GeminiValidationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GeminiValidationServiceTest extends TestCase
{
    public function test_it_maps_prefixed_pdm_keys_from_ai_response(): void
    {
        config()->set('qualitycontrol.gemini.enabled', true);
        config()->set('qualitycontrol.gemini.api_key', 'test-key');
        config()->set('qualitycontrol.gemini.model', 'gemini-2.5-flash');
        config()->set('qualitycontrol.gemini.verify_ssl', true);
        Cache::flush();

        Http::fake([
            '*' => Http::response($this->geminiPayload(json_encode([
                'PDM 24001001' => [
                    ['text' => 'Grammar: subject-verb disagreement', 'flags' => ['Grammar'], 'suggestions' => []]
                ],
            ])), 200),
        ]);

        /** @var GeminiValidationService $service */
        $service = app(GeminiValidationService::class);
        $result = $service->validateDescriptions([
            '24001001' => 'We provides industrial machining services.',
        ]);

        $this->assertTrue($result['enabled']);
        $this->assertNull($result['warning']);
        $this->assertCount(1, $result['results']);
        $this->assertSame('24001001', $result['results'][0]['pdmNum']);
        $this->assertSame('Grammar: subject-verb disagreement', $result['results'][0]['aiErrors'][0]['text']);
    }

    public function test_invalid_ai_shape_returns_warning_and_is_not_cached(): void
    {
        config()->set('qualitycontrol.gemini.enabled', true);
        config()->set('qualitycontrol.gemini.api_key', 'test-key');
        config()->set('qualitycontrol.gemini.model', 'gemini-2.5-flash');
        config()->set('qualitycontrol.gemini.verify_ssl', true);
        Cache::flush();

        Http::fakeSequence()
            ->push($this->geminiPayload(json_encode(['unexpected' => ['Malformed key']])) , 200)
            ->push($this->geminiPayload(json_encode([
                '24001002' => [
                    ['text' => 'Spelling: "recieve" should be "receive"', 'flags' => ['Spelling'], 'suggestions' => []]
                ],
            ])), 200);

        /** @var GeminiValidationService $service */
        $service = app(GeminiValidationService::class);

        $first = $service->validateDescriptions([
            '24001002' => 'Please recieve the document.',
        ]);
        $this->assertTrue($first['enabled']);
        $this->assertNotNull($first['warning']);
        $this->assertSame([], $first['results']);

        $second = $service->validateDescriptions([
            '24001002' => 'Please recieve the document.',
        ]);

        $this->assertNull($second['warning']);
        $this->assertCount(1, $second['results']);
        $this->assertSame('24001002', $second['results'][0]['pdmNum']);
        $this->assertSame('Spelling: "recieve" should be "receive"', $second['results'][0]['aiErrors'][0]['text']);
    }

    public function test_it_maps_flags_and_suggestions(): void
    {
        config()->set('qualitycontrol.gemini.enabled', true);
        config()->set('qualitycontrol.gemini.api_key', 'test-key');
        config()->set('qualitycontrol.gemini.model', 'gemini-2.5-flash');
        config()->set('qualitycontrol.gemini.verify_ssl', true);
        Cache::flush();

        Http::fake([
            '*' => Http::response($this->geminiPayload(json_encode([
                '24001003' => [
                    [
                        'text' => 'Spelling issue',
                        'flags' => ['Spelling', 'Grammar'],
                        'suggestions' => ['Use "receive" instead']
                    ]
                ],
            ])), 200),
        ]);

        /** @var GeminiValidationService $service */
        $service = app(GeminiValidationService::class);

        $result = $service->validateDescriptions([
            '24001003' => 'Please recieve updates.',
        ]);

        $this->assertTrue($result['enabled']);
        $this->assertNull($result['warning']);
        $this->assertCount(1, $result['results']);
        $this->assertSame('24001003', $result['results'][0]['pdmNum']);
        $this->assertSame('Spelling issue', $result['results'][0]['aiErrors'][0]['text']);
        $this->assertSame(['Spelling', 'Grammar'], $result['results'][0]['aiErrors'][0]['flags']);
        $this->assertSame(['Use "receive" instead'], $result['results'][0]['aiErrors'][0]['suggestions']);
    }

    /**
     * @return array<string, mixed>
     */
    private function geminiPayload(string $text): array
    {
        return [
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            ['text' => $text],
                        ],
                    ],
                ],
            ],
        ];
    }
}
