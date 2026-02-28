<?php

namespace App\Http\Requests\Dashboard;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $allowedTypes = array_keys(config('dashboard.document_types', []));

        return [
            'doccument_name' => ['required', 'string', 'max:255'],
            'doccument_link' => ['required', 'url', 'max:2048'],
            'doc_type' => ['nullable', Rule::in($allowedTypes)],
            'icon_class' => ['nullable', 'string', 'max:100'],
            'is_system' => ['nullable', 'boolean'],
        ];
    }
}
