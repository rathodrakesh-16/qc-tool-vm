<?php

namespace App\Http\Requests\Dashboard;

use App\Domain\Dashboard\AccountIdFormatter;
use App\Rules\ExistingDashboardUser;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateAccountRequest extends FormRequest
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
        $routeAccountId = AccountIdFormatter::toStoredNullable((string) $this->route('accountCode'));

        return [
            'account_id' => [
                'required',
                "regex:{$accountIdRegex}",
                Rule::unique('accounts', 'account_id')
                    ->ignore($routeAccountId, 'account_id'),
            ],
            'account_name' => ['required', 'string', 'max:255'],
            'editor' => ['required', 'string', 'max:255', new ExistingDashboardUser],
            'qc' => ['required', 'string', 'max:255', new ExistingDashboardUser],
            'status' => ['nullable', Rule::in($statusValues)],
            'assigned_date' => ['nullable', 'date'],
            'delivery_date' => ['nullable', 'date', 'after_or_equal:assigned_date'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $routeAccountId = AccountIdFormatter::toStoredNullable((string) $this->route('accountCode'));
            $payloadAccountId = AccountIdFormatter::toStoredNullable((string) $this->input('account_id'));

            if ($routeAccountId === null || $payloadAccountId === null) {
                return;
            }

            if ($routeAccountId !== $payloadAccountId) {
                $validator->errors()->add('account_id', 'Account ID cannot be changed during edit.');
            }
        });
    }
}
