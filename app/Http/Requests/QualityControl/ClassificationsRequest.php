<?php

namespace App\Http\Requests\QualityControl;

use Illuminate\Validation\Validator;

class ClassificationsRequest extends BaseQualityControlRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'dataTableData' => ['required', 'array', 'min:1', 'max:15000'],
            'dataTableData.*' => ['required', 'array', 'size:11'],

            'dataTablePDMData' => ['sometimes', 'nullable', 'array', 'max:15000'],
            'dataTablePDMData.*' => ['required', 'array', 'size:5'],

            'pulldataBackupTableData' => ['sometimes', 'nullable', 'array', 'max:15000'],
            'pulldataBackupTableData.*' => ['required', 'array', 'size:11'],
        ];
    }

    /**
     * @return array<int, string>
     */
    protected function allowedRootFields(): array
    {
        return [
            'dataTableData',
            'dataTablePDMData',
            'pulldataBackupTableData',
        ];
    }

    protected function validateTableShapes(Validator $validator): void
    {
        $this->validateRowTable($validator, 'dataTableData', 11);
        $this->validateRowTable($validator, 'dataTablePDMData', 5);
        $this->validateRowTable($validator, 'pulldataBackupTableData', 11);
    }
}
