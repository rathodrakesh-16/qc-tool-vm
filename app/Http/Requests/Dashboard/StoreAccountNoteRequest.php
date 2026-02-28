<?php

namespace App\Http\Requests\Dashboard;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAccountNoteRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'subject' => is_string($this->input('subject')) ? trim($this->input('subject')) : $this->input('subject'),
            'content' => is_string($this->input('content')) ? trim($this->input('content')) : $this->input('content'),
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
        $subjects = config('dashboard.note_subjects', []);

        return [
            'subject' => ['required', 'string', Rule::in($subjects)],
            'content' => ['required', 'string', 'max:10000'],
        ];
    }
}
