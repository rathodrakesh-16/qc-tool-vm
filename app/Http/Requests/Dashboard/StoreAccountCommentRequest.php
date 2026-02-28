<?php

namespace App\Http\Requests\Dashboard;

use Illuminate\Foundation\Http\FormRequest;

class StoreAccountCommentRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'text' => is_string($this->input('text')) ? trim($this->input('text')) : $this->input('text'),
        ]);
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'max:5000'],
        ];
    }
}
