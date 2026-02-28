<?php

namespace App\Extensions;

use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Support\Facades\Auth;

class UsernameDatabaseSessionHandler extends DatabaseSessionHandler
{
    /**
     * Add the username to the session data array.
     *
     * @param  array  $payload
     * @return array
     */
    protected function getDefaultPayload($data)
    {
        $payload = parent::getDefaultPayload($data);

        if (Auth::check()) {
            $payload['username'] = Auth::user()->username;
        }

        return $payload;
    }
}
