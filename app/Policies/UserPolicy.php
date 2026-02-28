<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->role === 'admin';
    }

    public function view(User $actor, User $target): bool
    {
        if ($actor->role === 'admin') {
            return true;
        }

        return $actor->uuid === $target->uuid;
    }

    public function create(User $actor): bool
    {
        return $actor->role === 'admin';
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->role === 'admin';
    }

    public function delete(User $actor, User $target): Response
    {
        if ($actor->role !== 'admin') {
            return Response::deny('Forbidden');
        }

        if ($actor->uuid === $target->uuid) {
            return Response::deny('You cannot delete your own account');
        }

        return Response::allow();
    }
}
