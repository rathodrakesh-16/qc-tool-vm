<?php

namespace App\Http\Requests\Dashboard;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAccountNoteRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $merged = [];

        if ($this->has('subject')) {
            $merged['subject'] = is_string($this->input('subject')) ? trim($this->input('subject')) : $this->input('subject');
        }

        if ($this->has('content')) {
            $merged['content'] = is_string($this->input('content')) ? trim($this->input('content')) : $this->input('content');
        }

        if ($merged !== []) {
            $this->merge($merged);
        }
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
            'subject' => ['sometimes', 'required', 'string', Rule::in($subjects)],
            'content' => ['sometimes', 'required', 'string', 'max:10000'],
        ];
    }
}
