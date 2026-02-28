<?php

namespace App\Rules;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ExistingDashboardUser implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            $fail('The :attribute must match an existing user.');
            return;
        }

        $lower = strtolower($normalized);

        $user = User::query()
            ->whereRaw('LOWER("userId") = ?', [$lower])
            ->orWhereRaw('LOWER("email") = ?', [$lower])
            ->orWhereRaw('LOWER("username") = ?', [$lower])
            ->first();

        if (!$user) {
            $fail('The :attribute must match an existing user username, userId, or email.');
        }
    }
}
