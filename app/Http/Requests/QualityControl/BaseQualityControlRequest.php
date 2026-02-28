<?php

namespace App\Http\Requests\QualityControl;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

abstract class BaseQualityControlRequest extends FormRequest
{
    private const MAX_CELL_LENGTH = 20000;

    public function authorize(): bool
    {
        return true;
    }

    public function withValidator($validator): void
    {
        $validator->after(function (Validator $validator): void {
            $this->rejectUnexpectedRootFields($validator);
            $this->validateTableShapes($validator);
        });
    }

    /**
     * @return array<int, string>
     */
    abstract protected function allowedRootFields(): array;

    protected function validateTableShapes(Validator $validator): void
    {
        // Implemented in subclasses.
    }

    protected function validateRowTable(Validator $validator, string $field, int $expectedColumns): void
    {
        $rows = $this->input($field);
        if (!is_array($rows)) {
            return;
        }

        foreach ($rows as $rowIndex => $row) {
            if (!is_array($row)) {
                $validator->errors()->add("{$field}.{$rowIndex}", 'Each row must be an array.');
                continue;
            }

            if (count($row) !== $expectedColumns) {
                $validator->errors()->add(
                    "{$field}.{$rowIndex}",
                    "Each row must contain exactly {$expectedColumns} columns."
                );
            }

            foreach ($row as $cellIndex => $cell) {
                if (!is_null($cell) && !is_scalar($cell)) {
                    $validator->errors()->add(
                        "{$field}.{$rowIndex}.{$cellIndex}",
                        'Each cell must be a scalar value or null.'
                    );
                    continue;
                }

                if (is_string($cell) && mb_strlen($cell) > self::MAX_CELL_LENGTH) {
                    $validator->errors()->add(
                        "{$field}.{$rowIndex}.{$cellIndex}",
                        'Cell value exceeds max supported length.'
                    );
                }
            }
        }
    }

    private function rejectUnexpectedRootFields(Validator $validator): void
    {
        $unexpected = array_values(array_diff(array_keys($this->all()), $this->allowedRootFields()));

        if ($unexpected === []) {
            return;
        }

        $validator->errors()->add(
            'payload',
            'Unexpected fields present: '.implode(', ', $unexpected)
        );
    }
}
