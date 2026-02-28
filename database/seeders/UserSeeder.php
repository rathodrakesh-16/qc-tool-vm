<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            [
                'userId' => 'admin@technosofteng.com',
                'username' => 'admin',
                'email' => 'admin@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'admin',
                'designation' => 'Admin',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'dshah@technosofteng.com',
                'username' => 'Dolly Shah',
                'email' => 'dshah@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'admin',
                'designation' => 'Project Manager',
                'team' => 'Supplier Content',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'mbjadhav@technosofteng.com',
                'username' => 'Mohini Jadhav',
                'email' => 'mbjadhav@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'admin',
                'designation' => 'Project Lead',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'rrobert@technosofteng.com',
                'username' => 'Rohan Robert',
                'email' => 'rrobert@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'admin',
                'designation' => 'Team Lead',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'mkamble@technosofteng.com',
                'username' => 'Mahesh Kamble',
                'email' => 'mkamble@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'admin',
                'designation' => 'Team Lead',
                'team' => 'Map Headings',
                'department' => 'ITeS',
                'location' => 'Pune, Maharashtra'
            ],
            [
                'userId' => 'testuser@technosofteng.com',
                'username' => 'Test User',
                'email' => 'testuser@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'admin',
                'designation' => 'Technical Content Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'rrathod@technosofteng.com',
                'username' => 'Rakesh Rathod',
                'email' => 'rrathod@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Sr. QA Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'acgupta@technosofteng.com',
                'username' => 'Aman Gupta',
                'email' => 'acgupta@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Sr. QA Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'kmadav@technosofteng.com',
                'username' => 'Karan Madav',
                'email' => 'kmadav@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Sr. QA Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'tdeshpande@technosofteng.com',
                'username' => 'Tejas Deshpande',
                'email' => 'tdeshpande@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Technical Content Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'hranoliya@technosofteng.com',
                'username' => 'Hardik Ranoliya',
                'email' => 'hranoliya@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Technical Content Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'aasharma@technosofteng.com',
                'username' => 'Anamika Sharma',
                'email' => 'aasharma@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Technical Content Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'aashraful@technosofteng.com',
                'username' => 'Ashraf Ansari',
                'email' => 'aashraful@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Technical Content Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'bkocharekar@technosofteng.com',
                'username' => 'Bhavita Kocharekar',
                'email' => 'bkocharekar@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Technical Content Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'tshaikh@technosofteng.com',
                'username' => 'Tanveer Shaikh',
                'email' => 'tshaikh@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Junior Data Analyst',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Pune, Maharashtra'
            ],
            [
                'userId' => 'amenge@technosofteng.com',
                'username' => 'Akshay Menge',
                'email' => 'amenge@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Data Analyst',
                'team' => 'Map Headings',
                'department' => 'ITeS',
                'location' => 'Pune, Maharashtra'
            ],
            [
                'userId' => 'pkulkarni@technosofteng.com',
                'username' => 'Prasad Kulkarni',
                'email' => 'pkulkarni@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Data Analyst',
                'team' => 'Map Headings',
                'department' => 'ITeS',
                'location' => 'Pune, Maharashtra'
            ],
            [
                'userId' => 'asangar@technosofteng.com',
                'username' => 'Atharva Sangar',
                'email' => 'asangar@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Data Analyst',
                'team' => 'Map Headings',
                'department' => 'ITeS',
                'location' => 'Pune, Maharashtra'
            ],
            [
                'userId' => 'vkumbhar@technosofteng.com',
                'username' => 'Vishal Kumbhar',
                'email' => 'vkumbhar@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Data Analyst',
                'team' => 'Map Headings',
                'department' => 'ITeS',
                'location' => 'Pune, Maharashtra'
            ],
            [
                'userId' => 'ipatil@technosofteng.com',
                'username' => 'Indrajit Patil',
                'email' => 'ipatil@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Data Analyst',
                'team' => 'Map Headings',
                'department' => 'ITeS',
                'location' => 'Pune, Maharashtra'
            ],
            [
                'userId' => 'amistry@technosofteng.com',
                'username' => 'Affan Mistry',
                'email' => 'amistry@technosofteng.com',
                'password' => 'Technosoft',
                'role' => 'user',
                'designation' => 'Technical Content Engineer',
                'team' => 'Client Accounts',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'demoeditor@technosofteng.com',
                'username' => 'Demo Editor',
                'email' => 'demoeditor@technosofteng.com',
                'password' => 'Demo@1234',
                'role' => 'user',
                'designation' => 'Demo',
                'team' => 'Training',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ],
            [
                'userId' => 'demoqc@technosofteng.com',
                'username' => 'Demo QC',
                'email' => 'demoqc@technosofteng.com',
                'password' => 'Demo@1234',
                'role' => 'user',
                'designation' => 'Demo',
                'team' => 'Training',
                'department' => 'ITeS',
                'location' => 'Thane, Maharashtra'
            ]
        ];

        foreach ($users as $userData) {
            User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'userId' => $userData['userId'],
                    'username' => $userData['username'],
                    'password' => Hash::make($userData['password']),
                    'role' => $userData['role'],
                    'designation' => $userData['designation'],
                    'team' => $userData['team'],
                    'department' => $userData['department'],
                    'location' => $userData['location'],
                ]
            );
        }
    }
}
