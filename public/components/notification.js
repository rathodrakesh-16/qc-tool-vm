// Notifications - Modern Professional Design
function getNotificationAnchorX() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const rect = mainContent.getBoundingClientRect();
        return rect.left + (rect.width / 2);
    }
    return window.innerWidth / 2;
}

function positionAlert(alertElement) {
    if (!alertElement) return;
    alertElement.style.left = `${Math.round(getNotificationAnchorX())}px`;
}

function cleanupAlertResources(alertElement) {
    if (!alertElement) return;

    if (alertElement.dataset.autoHideTimer) {
        clearTimeout(Number(alertElement.dataset.autoHideTimer));
        delete alertElement.dataset.autoHideTimer;
    }

    if (alertElement._resizeHandler) {
        window.removeEventListener('resize', alertElement._resizeHandler);
        delete alertElement._resizeHandler;
    }
}

/**
 * Show an alert notification
 * @param {string} type - Alert type: 'success', 'warning', 'error', 'info'
 * @param {string} message - Alert message text
 * @param {number} duration - Auto-hide duration in milliseconds (default: 5000ms = 5 seconds, 0 = no auto-hide)
 */
export function showAlert(type, message, duration = 5000) {
    const existingAlert = document.querySelector('.alert-notification');
    if (existingAlert) {
        cleanupAlertResources(existingAlert);
        existingAlert.remove();
    }

    const icons = {
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
    };

    const alert = document.createElement('div');
    alert.className = `alert-notification alert-${type}`;

    // Build the progress bar HTML only if duration > 0
    const progressHTML = duration > 0 ? `
        <div class="alert-progress">
            <div class="alert-progress-bar" style="animation-duration: ${duration}ms;"></div>
        </div>
    ` : '';

    alert.innerHTML = `
        <div class="alert-inner">
            <i class="fas ${icons[type]} alert-icon"></i>
            <div class="alert-content">
                <div class="alert-message">${message}</div>
            </div>
            <button class="alert-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
        ${progressHTML}
    `;

    document.body.appendChild(alert);
    positionAlert(alert);

    const resizeHandler = () => positionAlert(alert);
    alert._resizeHandler = resizeHandler;
    window.addEventListener('resize', resizeHandler);

    // Close button listener
    const closeBtn = alert.querySelector('.alert-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => hideAlert(alert));
    }

    // Trigger show animation
    setTimeout(() => {
        alert.classList.add('show');
    }, 10);

    // Auto-hide after duration (if duration > 0)
    if (duration > 0) {
        const autoHideTimer = setTimeout(() => {
            hideAlert(alert);
        }, duration);

        alert.dataset.autoHideTimer = autoHideTimer;
    }
}

/**
 * Hide and remove an alert notification
 * @param {HTMLElement} alertElement - The alert element to hide
 */
export function hideAlert(alertElement) {
    if (!alertElement) return;
    if (alertElement.classList.contains('hide')) return;

    cleanupAlertResources(alertElement);

    alertElement.classList.remove('show');
    alertElement.classList.add('hide');

    setTimeout(() => {
        if (alertElement.parentElement) {
            alertElement.remove();
        }
    }, 350);
}

// Window bridges removed - functions are exported
