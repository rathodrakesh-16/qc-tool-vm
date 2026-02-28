<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/logout', [AuthController::class, 'logout']);

Route::get('/{any?}', function () {
    return file_get_contents(public_path('index.html'));
})->where('any', '^(?!api(?:/|$)).*');
