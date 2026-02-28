<?php

namespace App\Http\Requests\Dashboard;

use App\Rules\ExistingDashboardUser;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAccountRequest extends FormRequest
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
        $statusValues = array_keys(config('dashboard.statuses', []));
        $accountIdRegex = (string) config('dashboard.account_id.regex', '/^(?!0+$)\d{1,8}$/');

        return [
            'account_id' => [
                'required',
                "regex:{$accountIdRegex}",
                Rule::unique('accounts', 'account_id'),
            ],
            'account_name' => ['required', 'string', 'max:255'],
            'editor' => ['required', 'string', 'max:255', new ExistingDashboardUser],
            'qc' => ['required', 'string', 'max:255', new ExistingDashboardUser],
            'status' => ['nullable', Rule::in($statusValues)],
            'assigned_date' => ['nullable', 'date'],
            'delivery_date' => ['nullable', 'date', 'after_or_equal:assigned_date'],
        ];
    }
}
