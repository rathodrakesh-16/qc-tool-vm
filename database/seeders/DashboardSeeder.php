<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Seeder;

class DashboardSeeder extends Seeder
{
    /**
     * Seed the dashboard with default document and training account.
     */
    public function run(): void
    {
        // Default SOP document
        Document::updateOrCreate(
            [
                'doccument_name' => 'Thomas Supplier Content Guidelines',
            ],
            [
                'doccument_link' => 'https://technosoftengpl-my.sharepoint.com/:b:/g/personal/rrathod_technosofteng_com/IQBLnl2gDk6GTa01fmdeLKHuAdCbQJrHVB4HjmK7gYZcHCk?e=tPg2Cd',
                'doc_type' => 'pdf',
                'icon_class' => 'fa-file-pdf',
                'is_system' => true,
            ]
        );

        // Training account
        $editorUser = User::whereRaw('LOWER("username") = ?', ['demo editor'])->first();
        $qcUser = User::whereRaw('LOWER("username") = ?', ['demo qc'])->first();

        if ($editorUser && $qcUser) {
            Account::updateOrCreate(
                ['account_id' => 99999],
                [
                    'account_name' => 'Training Account',
                    'editor_user_id' => $editorUser->userId,
                    'qc_user_id' => $qcUser->userId,
                    'status' => 'assigned',
                    'assigned_date' => now()->toDateString(),
                    'is_system' => true,
                ]
            );
        }
    }
}
