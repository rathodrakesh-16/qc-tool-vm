<?php

namespace App\Http\Requests\QualityControl;

use Illuminate\Validation\Validator;

class ReportRequest extends BaseQualityControlRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'classificationDetails' => ['required', 'array', 'min:1', 'max:15000'],
            'classificationDetails.*' => ['required', 'array', 'size:11'],

            'accountDetails' => ['nullable', 'array:accountName,accountId,editorName,qcName'],
            'accountDetails.accountName' => ['nullable', 'string', 'max:255'],
            'accountDetails.accountId' => ['nullable', 'string', 'max:100'],
            'accountDetails.editorName' => ['nullable', 'string', 'max:255'],
            'accountDetails.qcName' => ['nullable', 'string', 'max:255'],

            'companyProfile' => ['nullable', 'string', 'max:20000'],
        ];
    }

    /**
     * @return array<int, string>
     */
    protected function allowedRootFields(): array
    {
        return [
            'classificationDetails',
            'accountDetails',
            'companyProfile',
        ];
    }

    protected function validateTableShapes(Validator $validator): void
    {
        $this->validateRowTable($validator, 'classificationDetails', 11);
    }
}
