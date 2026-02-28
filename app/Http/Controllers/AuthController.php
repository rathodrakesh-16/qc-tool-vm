<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Get a specific user.
     */
    public function show(Request $request, string $uuid)
    {
        $user = User::where('uuid', $uuid)->firstOrFail();
        $this->authorize('view', $user);

        return response()->json([
            'user' => (new UserResource($user))->toArray($request),
        ]);
    }

    /**
     * Get a specific user by userId (case-insensitive).
     */
    public function showByUserId(Request $request, string $userId)
    {
        $normalizedUserId = strtolower($userId);
        $user = User::where('userId', $normalizedUserId)->firstOrFail();
        $this->authorize('view', $user);

        return response()->json([
            'user' => (new UserResource($user))->toArray($request),
        ]);
    }

    /**
     * Handle user login.
     */
    public function login(LoginRequest $request)
    {
        $validated = $request->validated();
        $normalizedUserId = $validated['userId'];
        $remember = (bool) ($validated['remember'] ?? false);

        if (Auth::attempt(['userId' => $normalizedUserId, 'password' => $validated['password']], $remember)) {
            $request->session()->regenerate();

            $user = Auth::user();

            return response()->json([
                'user' => $user ? (new UserResource($user))->toArray($request) : null,
                'message' => 'Login successful',
            ]);
        }

        throw ValidationException::withMessages([
            'userId' => ['The provided credentials do not match our records.'],
        ]);
    }

    /**
     * Handle user logout.
     */
    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Get the authenticated user.
     */
    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => $user ? (new UserResource($user))->toArray($request) : null,
            'authenticated' => Auth::check(),
        ]);
    }

    /**
     * Create a new user.
     */
    public function createUser(StoreUserRequest $request)
    {
        $this->authorize('create', User::class);
        $validated = $request->validated();

        $user = User::create([
            'userId' => $validated['userId'],
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'designation' => $validated['designation'],
            'team' => $validated['team'],
            'department' => $validated['department'],
            'location' => $validated['location'],
        ]);

        return response()->json([
            'user' => (new UserResource($user))->toArray($request),
            'message' => 'User created successfully',
        ], 201);
    }

    /**
     * Update an existing user.
     */
    public function updateUser(UpdateUserRequest $request, string $uuid)
    {
        $user = User::where('uuid', $uuid)->firstOrFail();
        $this->authorize('update', $user);
        $validated = $request->validated();

        $user->update([
            'userId' => $validated['userId'],
            'username' => $validated['username'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'designation' => $validated['designation'],
            'team' => $validated['team'],
            'department' => $validated['department'],
            'location' => $validated['location'],
        ]);

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
            $user->save();
        }

        return response()->json([
            'user' => (new UserResource($user->fresh()))->toArray($request),
            'message' => 'User updated successfully',
        ]);
    }

    /**
     * Delete a user.
     */
    public function deleteUser(string $uuid)
    {
        $user = User::where('uuid', $uuid)->firstOrFail();
        $this->authorize('delete', $user);

        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    /**
     * Get all users.
     */
    public function listUsers(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $users = User::query()->orderBy('username')->get();

        return response()->json([
            'users' => $users
                ->map(fn (User $user) => (new UserResource($user))->toArray($request))
                ->values(),
        ]);
    }

    /**
     * List users with minimal fields (available to all authenticated users).
     */
    public function listUserNames()
    {
        $users = User::select('uuid', 'username')->orderBy('username')->get();

        return response()->json([
            'users' => $users,
        ]);
    }

}
