<?php

namespace Tests\Feature\Workspace;

use App\Domain\Dashboard\AccountIdFormatter;
use App\Models\Account;
use App\Models\Heading;
use App\Models\Pdm;
use App\Models\PdmHeading;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkspacePhase4RefactorTest extends TestCase
{
    use RefreshDatabase;

    public function test_pdm_crud_and_status_endpoints_work_with_audit_events(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);
        $account = $this->createAccount($user, 12345678);
        $heading = $this->createHeading($account, $user, 9001);
        $accountCode = AccountIdFormatter::toDisplay((int) $account->account_id);

        $createResponse = $this->postJson("/api/dashboard/accounts/{$accountCode}/pdms", [
            'is_copro' => true,
            'company_type' => ['B2B'],
            'description' => 'Sample description text',
            'heading_ids' => [
                ['id' => (int) $heading->heading_id, 'sort_order' => 1],
            ],
        ]);

        $createResponse->assertStatus(201);
        $pdmId = (int) $createResponse->json('pdm.pdmId');
        $this->assertGreaterThan(0, $pdmId);

        $this->patchJson("/api/dashboard/accounts/{$accountCode}/pdms/{$pdmId}/uploaded", [
            'uploaded' => true,
        ])->assertOk();

        $this->patchJson("/api/dashboard/accounts/{$accountCode}/pdms/{$pdmId}/qc-status", [
            'qc_status' => 'checked',
        ])->assertOk();

        $this->deleteJson("/api/dashboard/accounts/{$accountCode}/pdms/{$pdmId}")
            ->assertNoContent();

        $this->assertDatabaseHas('pdm_status_events', [
            'pdm_id' => $pdmId,
            'event_type' => 'deleted',
        ]);
    }

    public function test_qc_feedback_submit_updates_pdm_and_history(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);
        $account = $this->createAccount($user, 22223333);
        $heading = $this->createHeading($account, $user, 9010);
        $pdm = $this->createPdm($account, $user);
        PdmHeading::query()->create([
            'pdm_id' => $pdm->pdm_id,
            'heading_id' => $heading->heading_id,
            'sort_order' => 1,
        ]);
        $accountCode = AccountIdFormatter::toDisplay((int) $account->account_id);

        $this->postJson("/api/dashboard/accounts/{$accountCode}/pdms/{$pdm->pdm_id}/feedback", [
            'updated_description' => 'Updated by QC',
            'comment' => 'Needs revision',
            'error_categories' => ['Fact mismatch'],
        ])->assertStatus(201);

        $this->assertDatabaseHas('pdm_feedback_history', [
            'pdm_id' => $pdm->pdm_id,
            'comment' => 'Needs revision',
        ]);

        $this->assertDatabaseHas('pdms', [
            'pdm_id' => $pdm->pdm_id,
            'qc_status' => 'error',
            'is_qc_edited' => true,
        ]);
    }

    public function test_qc_error_crud_endpoints_work(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);
        $account = $this->createAccount($user, 33334444);
        $heading = $this->createHeading($account, $user, 9020);
        $accountCode = AccountIdFormatter::toDisplay((int) $account->account_id);

        $create = $this->postJson("/api/dashboard/accounts/{$accountCode}/qc-errors", [
            'heading_id' => (int) $heading->heading_id,
            'error_category' => 'Broken claim',
            'comment' => 'Initial report',
        ]);
        $create->assertStatus(201);
        $errorId = (int) $create->json('error.id');

        $this->patchJson("/api/dashboard/accounts/{$accountCode}/qc-errors/{$errorId}", [
            'rectification_status' => 'Done',
            'validation_status' => 'Done',
            'qc_status' => 'checked',
        ])->assertOk();

        $this->deleteJson("/api/dashboard/accounts/{$accountCode}/qc-errors/{$errorId}")
            ->assertNoContent();
    }

    public function test_non_numeric_route_ids_are_rejected(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);
        $account = $this->createAccount($user, 77778888);
        $heading = $this->createHeading($account, $user, 9030);
        $pdm = $this->createPdm($account, $user);
        PdmHeading::query()->create([
            'pdm_id' => $pdm->pdm_id,
            'heading_id' => $heading->heading_id,
            'sort_order' => 1,
        ]);

        $error = $this->postJson('/api/dashboard/accounts/'.AccountIdFormatter::toDisplay((int) $account->account_id).'/qc-errors', [
            'heading_id' => (int) $heading->heading_id,
            'error_category' => 'Invalid route check',
        ])->assertCreated();

        $accountCode = AccountIdFormatter::toDisplay((int) $account->account_id);
        $this->patchJson("/api/dashboard/accounts/{$accountCode}/pdms/{$pdm->pdm_id}abc/qc-status", [
            'qc_status' => 'checked',
        ])->assertNotFound();

        $errorId = (int) $error->json('error.id');
        $this->patchJson("/api/dashboard/accounts/{$accountCode}/qc-errors/{$errorId}abc", [
            'qc_status' => 'checked',
        ])->assertNotFound();
    }

    public function test_workspace_preferences_show_and_update_work(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);
        $account = $this->createAccount($user, 44445555);

        $this->getJson('/api/user/preferences')->assertOk();

        $this->putJson('/api/user/preferences', [
            'last_account_id' => AccountIdFormatter::toDisplay((int) $account->account_id),
            'active_mode' => 'qc',
            'active_route' => 'qc_review',
            'filters_json' => ['tab' => 'qc'],
        ])->assertOk()
            ->assertJsonPath('preferences.activeMode', 'qc')
            ->assertJsonPath('preferences.activeRoute', 'qc_review');
    }

    public function test_report_endpoints_return_success(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);
        $account = $this->createAccount($user, 55556666);
        $accountCode = AccountIdFormatter::toDisplay((int) $account->account_id);

        $this->getJson("/api/dashboard/accounts/{$accountCode}/reports/production")
            ->assertOk()
            ->assertJsonStructure(['total_headings', 'total_pdms', 'total_word_count']);

        $this->getJson("/api/dashboard/accounts/{$accountCode}/reports/qc")
            ->assertOk()
            ->assertJsonStructure(['total_pdms_reviewed', 'feedback_summary']);
    }

    public function test_heading_import_and_existing_snapshot_upload_work(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);
        $account = $this->createAccount($user, 66667777);
        $accountCode = AccountIdFormatter::toDisplay((int) $account->account_id);

        $importCsv = UploadedFile::fake()->createWithContent(
            'headings.csv',
            "classification,classification_id,definition,family,rank_points,company_type,site_link\n".
            "Cloud Ops,9100,Definition one,Infra,5,B2B,https://example.com\n"
        );

        $this->postJson("/api/dashboard/accounts/{$accountCode}/headings/import", [
            'file' => $importCsv,
            'context_family' => 'Infra',
        ])->assertStatus(201)
            ->assertJsonPath('headings_count', 1);

        $existingCsv = UploadedFile::fake()->createWithContent(
            'beforeproof.csv',
            "classification,classification_id,definition,category,rank_points,family,company_type,profile_description,site_link,quality,source_last_updated\n".
            "Cloud Ops,9100,Definition one,Category A,5,Infra,B2B,123456,https://example.com,Good,2026-01-01\n"
        );

        $this->postJson("/api/dashboard/accounts/{$accountCode}/existing-headings/upload", [
            'file' => $existingCsv,
        ])->assertStatus(201)
            ->assertJsonPath('items_count', 1);

        $this->assertDatabaseHas('existing_heading_snapshots', [
            'account_id' => $account->account_id,
            'is_active' => true,
        ]);
    }

    private function createUser(): User
    {
        $email = Str::lower(Str::random(10)).'@example.com';

        return User::query()->create([
            'userId' => $email,
            'username' => 'test_'.Str::random(8),
            'email' => $email,
            'role' => 'user',
            'designation' => 'QA',
            'team' => 'Quality',
            'location' => 'US',
            'department' => 'Engineering',
            'password' => 'password123',
        ]);
    }

    private function createAccount(User $user, int $accountId): Account
    {
        return Account::query()->create([
            'account_id' => $accountId,
            'account_name' => 'Account '.$accountId,
            'editor_user_id' => $user->userId,
            'qc_user_id' => $user->userId,
            'status' => 'assigned',
            'assigned_date' => now()->toDateString(),
            'delivery_date' => now()->addDay()->toDateString(),
            'is_system' => false,
            'created_by_user_id' => $user->userId,
            'updated_by_user_id' => $user->userId,
        ]);
    }

    private function createHeading(Account $account, User $user, int $headingId): Heading
    {
        return Heading::query()->create([
            'heading_id' => $headingId,
            'account_id' => (int) $account->account_id,
            'heading_name' => 'Heading '.$headingId,
            'workflow_stage' => 'imported',
            'status' => 'additional',
            'created_by_user_id' => $user->userId,
            'updated_by_user_id' => $user->userId,
        ]);
    }

    private function createPdm(Account $account, User $user): Pdm
    {
        return Pdm::query()->create([
            'pdm_id' => 26001001,
            'account_id' => (int) $account->account_id,
            'is_copro' => true,
            'url' => null,
            'company_type' => ['B2B'],
            'type_of_proof' => null,
            'description' => 'Initial description',
            'comment' => null,
            'word_count' => 2,
            'uploaded' => false,
            'qc_status' => 'pending',
            'rectification_status' => 'Not Needed',
            'validation_status' => 'Pending',
            'is_qc_edited' => false,
            'is_description_updated' => false,
            'created_by_user_id' => $user->userId,
            'updated_by_user_id' => $user->userId,
        ]);
    }
}
