<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    protected function prepareForValidation(): void
    {
        $password = trim((string) $this->input('password', ''));

        $this->merge([
            'userId' => strtolower(trim((string) $this->input('userId', ''))),
            'username' => trim((string) $this->input('username', '')),
            'email' => strtolower(trim((string) $this->input('email', ''))),
            'role' => strtolower(trim((string) $this->input('role', ''))),
            'designation' => trim((string) $this->input('designation', '')),
            'team' => trim((string) $this->input('team', '')),
            'department' => trim((string) $this->input('department', '')),
            'location' => trim((string) $this->input('location', '')),
            'password' => $password === '' ? null : $password,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $uuid = (string) $this->route('uuid');

        return [
            'userId' => [
                'required',
                'email',
                Rule::unique('users', 'userId')
                    ->whereNull('deleted_at')
                    ->ignore($uuid, 'uuid'),
            ],
            'username' => [
                'required',
                'string',
                'max:255',
                Rule::unique('users', 'username')
                    ->whereNull('deleted_at')
                    ->ignore($uuid, 'uuid'),
            ],
            'email' => [
                'required',
                'email',
                'same:userId',
                Rule::unique('users', 'email')
                    ->whereNull('deleted_at')
                    ->ignore($uuid, 'uuid'),
            ],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in(['admin', 'user'])],
            'designation' => ['required', 'string', 'max:255'],
            'team' => ['required', 'string', 'max:255'],
            'department' => ['required', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
        ];
    }
}
