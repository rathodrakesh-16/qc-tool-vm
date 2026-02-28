<?php

namespace App\Policies;

use App\Models\AccountComment;
use App\Models\User;

class AccountCommentPolicy
{
    public function update(User $actor, AccountComment $comment): bool
    {
        return $actor->userId === $comment->user_id;
    }

    public function delete(User $actor, AccountComment $comment): bool
    {
        return $actor->userId === $comment->user_id || $actor->role === 'admin';
    }
}
