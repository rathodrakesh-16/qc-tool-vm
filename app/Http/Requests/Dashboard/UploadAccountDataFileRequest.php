<?php

namespace App\Http\Requests\Dashboard;

use App\Domain\Dashboard\FileTypeClassifier;
use Illuminate\Foundation\Http\FormRequest;

class UploadAccountDataFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $mimeTypes = implode(',', FileTypeClassifier::allowedMimeTypes());
        $extensions = implode(',', FileTypeClassifier::allowedExtensions());

        return [
            'files' => ['required', 'array', 'min:1', 'max:10'],
            'files.*' => ['required', 'file', 'max:51200', "mimetypes:{$mimeTypes}", "extensions:{$extensions}"],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'files.max' => 'You may upload a maximum of 10 files at once.',
            'files.*.max' => 'Each file must not exceed 50 MB.',
            'files.*.mimetypes' => 'The file type is not allowed. Accepted types: Excel, PDF, images, and videos.',
        ];
    }
}
