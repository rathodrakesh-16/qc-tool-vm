
// Logic for the User Profile Page
import { authManager } from '../../core/auth/AuthManager.js';
import { router } from '../../core/app.js';
import { handleLogout } from '../login/loginPage.js';
import {
    renderUserProfileSkeleton,
    setSkeletonBusyState
} from '../../components/skeleton.js';

export async function renderUserProfilePage(userId) {
    const container = document.getElementById('userProfilePage');
    if (!container) return;

    const sessionUser = authManager.getUser() || {};
    let user = sessionUser;
    const requestedUserId = (userId || '').trim();
    const normalizedRequestedUserId = requestedUserId.toLowerCase();
    const sessionUserId = (sessionUser.userId || '').toLowerCase();

    if (!requestedUserId) {
        if (sessionUserId) {
            router.navigate('/users/:userId', { userId: sessionUserId });
            return;
        }
        renderUserProfileNotFound(container);
        return;
    }

    if (sessionUserId !== normalizedRequestedUserId) {
        renderUserProfileSkeleton(container);
        try {
            const fetchedUser = await authManager.fetchUserByUserId(normalizedRequestedUserId);
            if (!fetchedUser) {
                renderUserProfileNotFound(container);
                return;
            }
            user = fetchedUser;
        } catch (error) {
            if (error?.status === 403) {
                renderUserProfileAccessDenied(container);
                return;
            }
            if (error?.status === 404) {
                renderUserProfileNotFound(container);
                return;
            }
            renderUserProfileNotFound(container);
            return;
        }
    }

    const canonicalUserId = (user.userId || '').toLowerCase();
    if (canonicalUserId && canonicalUserId !== requestedUserId) {
        router.navigate('/users/:userId', { userId: canonicalUserId });
        return;
    }

    container.innerHTML = `

            
            <div class="user-profile-section">
                <div class="user-profile-section-header">
                    <h2>User Information</h2>
                    <button class="logout-btn-header">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>

                <div class="user-profile-body">
                    <!-- Personal Details Group -->
                    <div class="profile-details-group">
                        <h3 class="profile-group-title">Personal Details</h3>
                        <div class="profile-info-grid">
                            <div class="profile-info-item">
                                <i class="fas fa-user"></i>
                                <div class="profile-info-content">
                                    <span class="profile-label">Full Name</span>
                                    <span class="profile-value">${user.username || 'Unknown User'}</span>
                                </div>
                            </div>
                            <div class="profile-info-item">
                                <i class="fas fa-briefcase"></i>
                                <div class="profile-info-content">
                                    <span class="profile-label">Role</span>
                                    <span class="profile-value">${user.designation || user.role || 'User'}</span>
                                </div>
                            </div>

                            <div class="profile-info-item">
                                <i class="fas fa-envelope"></i>
                                <div class="profile-info-content">
                                    <span class="profile-label">Email Address</span>
                                    <span class="profile-value">${user.email || user.userId || '\u2014'}</span>
                                </div>
                            </div>
                            <div class="profile-info-item">
                                <i class="fas fa-users"></i>
                                <div class="profile-info-content">
                                    <span class="profile-label">Team</span>
                                    <span class="profile-value">${user.team || '\u2014'}</span>
                                </div>
                            </div>
                            <div class="profile-info-item">
                                <i class="far fa-building"></i>
                                <div class="profile-info-content">
                                    <span class="profile-label">Department</span>
                                    <span class="profile-value">${user.department || '\u2014'}</span>
                                </div>
                            </div>
                            <div class="profile-info-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <div class="profile-info-content">
                                    <span class="profile-label">Location</span>
                                    <span class="profile-value">${user.location || '\u2014'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="profile-divider"></div>

                    <!-- Stats Group -->
                    <div class="profile-stats-group">
                        <h3 class="profile-group-title">Performance Overview</h3>
                        <div class="profile-stats-grid">
                            <div class="profile-stat-box">
                                <div class="profile-stat-header">
                                    <i class="fas fa-chart-pie"></i>
                                    <span>Productivity (Current Month)</span>
                                </div>
                                <span class="profile-stat-value">--</span>
                            </div>
                            <div class="profile-stat-box">
                                <div class="profile-stat-header">
                                    <i class="far fa-clock"></i>
                                    <span>Productivity (Last Month)</span>
                                </div>
                                <span class="profile-stat-value">--</span>
                            </div>
                            <div class="profile-stat-box">
                                <div class="profile-stat-header">
                                    <i class="fas fa-calendar-check"></i>
                                    <span>Planned Leaves</span>
                                </div>
                                <span class="profile-stat-value">--</span>
                            </div>
                            <div class="profile-stat-box">
                                <div class="profile-stat-header">
                                    <i class="fas fa-user-clock"></i>
                                    <span>Unplanned Leaves</span>
                                </div>
                                <span class="profile-stat-value">--</span>
                            </div>
                            <div class="profile-stat-box">
                                <div class="profile-stat-header">
                                    <i class="fas fa-clipboard-check"></i>
                                    <span>Internal Quality</span>
                                </div>
                                <span class="profile-stat-value">--</span>
                            </div>
                            <div class="profile-stat-box">
                                <div class="profile-stat-header">
                                    <i class="fas fa-award"></i>
                                    <span>External Quality</span>
                                </div>
                                <span class="profile-stat-value">--</span>
                            </div>
                        </div>
                    </div>

                    <div class="profile-divider"></div>

                    <!-- Team Information Group -->
                    <div class="profile-team-group">
                        <h3 class="profile-group-title">Team Information</h3>
                        <div class="profile-team-placeholder">
                            <p>Team information will be displayed here.</p>
                        </div>
                    </div>
                </div>
            </div>

    `;

    setSkeletonBusyState(container, false);

    // Initialize event listeners for user profile page
    initializeUserProfileEvents();
}

function initializeUserProfileEvents() {
    const logoutBtn = document.querySelector('.logout-btn-header');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout(e.currentTarget);
        });
    }
}

export function getUserEmail(user) {
    return user.email || user.userId || '';
}

// Open the current user's profile page
export function openUserProfilePage() {
    const sessionUser = authManager.getUser();
    if (!sessionUser) return;

    if (sessionUser.role === 'admin') {
        const cleanAdminName = (sessionUser.username || 'admin').toLowerCase().replace(/\s+/g, '_');
        router.navigate('/admin/:adminname', { adminname: cleanAdminName });
    } else {
        if (!sessionUser.userId) {
            router.navigate('/dashboard');
            return;
        }
        router.navigate('/users/:userId', { userId: sessionUser.userId.toLowerCase() });
    }
}

function renderUserProfileNotFound(container) {
    container.innerHTML = `
        <div class="user-profile-section">
            <div class="user-profile-body">
                <div class="profile-team-placeholder">
                    <p>User profile not found.</p>
                </div>
            </div>
        </div>
    `;
    setSkeletonBusyState(container, false);
}

function renderUserProfileAccessDenied(container) {
    container.innerHTML = `
        <div class="user-profile-section">
            <div class="user-profile-body">
                <div class="profile-team-placeholder">
                    <p>Access denied for this user profile.</p>
                </div>
            </div>
        </div>
    `;
    setSkeletonBusyState(container, false);
}

// Window bridges removed - functions are exported and imported where needed
