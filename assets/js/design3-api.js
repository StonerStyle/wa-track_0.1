// Design 3 - MVP Dashboard with Real API Integration

class WAMonitorDashboard {
    constructor() {
        this.statusInterval = null;
        this.qrInterval = null;
        this.groups = [];
        this.messages = [];
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.searchTimeout = null;
        this.apiBaseUrl = '/api';
        
        this.init();
    }

    init() {
        console.log('WA Monitor initializing with API integration...');
        this.bindEvents();
        this.loadGroups();
        this.loadMessages();
        this.loadSystemActivity();
        
        // Force initial status update
        this.fetchStatus();
        
        this.startStatusPolling();
        this.startQRPolling();
        console.log('WA Monitor initialized successfully');
    }

    bindEvents() {
        // Header buttons
        document.getElementById('btn-logout-google').addEventListener('click', () => this.logoutGoogle());
        document.getElementById('btn-wa-disconnect').addEventListener('click', () => this.disconnectWhatsApp());
        
        // QR controls
        const refreshQRBtn = document.getElementById('btn-refresh-qr');
        if (refreshQRBtn) {
            refreshQRBtn.addEventListener('click', () => this.refreshQR());
        }
        
        // Groups controls
        document.getElementById('btn-fetch-groups').addEventListener('click', () => this.fetchNewGroups());
        document.getElementById('groups-search').addEventListener('input', (e) => this.handleSearch(e));
        document.getElementById('groups-prev').addEventListener('click', () => this.prevPage());
        document.getElementById('groups-next').addEventListener('click', () => this.nextPage());
        
        // Message filters
        document.getElementById('msg-filter-group').addEventListener('change', () => this.loadMessages());
        document.getElementById('msg-filter-kind').addEventListener('change', () => this.loadMessages());
        
        // Activity clear button
        document.getElementById('btn-clear-activity').addEventListener('click', () => this.clearActivity());
    }

    // API Helper Methods
    async fetchJSON(url, options = {}) {
        try {
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            // Handle 401 redirects - only redirect if not already on login page
            if (response.status === 401) {
                if (window.location.pathname !== '/') {
                    window.location.href = '/';
                }
                return null;
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'server_error', message: 'Request failed' }));
                throw new Error(error.message || 'Request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            this.showToast(error.message || 'Network error', 'error');
            throw error;
        }
    }

    // Status polling
    startStatusPolling() {
        this.statusInterval = setInterval(() => {
            this.fetchStatus();
        }, 2000);
    }

    async fetchStatus() {
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/status`);
            if (data) {
                this.updateStatusCards(data);
            }
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    }

    updateStatusCards(status) {
        // Update Google status
        const googleBadge = document.getElementById('google-state-badge');
        const googleContent = document.getElementById('google-content');
        
        if (status.google.connected) {
            googleBadge.textContent = 'connected';
            googleBadge.className = 'badge badge-connected';
            googleContent.innerHTML = `
                <div class="google-connected" style="display: flex; align-items: center; gap: 8px;">
                    <img id="google-avatar" src="${status.google.avatar || 'https://via.placeholder.com/32/4285F4/FFFFFF?text=G'}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #E5E7EB;">
                    <span id="google-email">${status.google.email}</span>
                </div>
            `;
        } else {
            googleBadge.textContent = 'disconnected';
            googleBadge.className = 'badge badge-disconnected';
            googleContent.innerHTML = `
                <div class="not-signed-in">
                    <span>Not signed in</span>
                </div>
            `;
        }

        // Update WhatsApp status with integrated QR
        const waBadge = document.getElementById('wa-state-badge');
        const qrSection = document.getElementById('wa-qr-section');
        const profileSection = document.getElementById('wa-profile-section');
        
        waBadge.textContent = status.whatsapp.state;
        waBadge.className = `badge badge-${status.whatsapp.state}`;
        
        if (status.whatsapp.state === 'connected') {
            // Show profile, hide QR
            qrSection.style.display = 'none';
            profileSection.style.display = 'block';
            
            const waAvatar = document.getElementById('wa-avatar');
            const waName = document.getElementById('wa-name');
            const waNumber = document.getElementById('wa-number');
            
            if (waAvatar) waAvatar.src = 'https://via.placeholder.com/32/25D366/FFFFFF?text=WA';
            if (waName) waName.textContent = status.whatsapp.name;
            if (waNumber) waNumber.textContent = status.whatsapp.number;
        } else if (status.whatsapp.state === 'connecting') {
            // Show QR with connecting state
            qrSection.style.display = 'block';
            profileSection.style.display = 'none';
            
            // Update QR expiration to show connecting
            const qrExpires = document.getElementById('qr-expires');
            if (qrExpires) {
                qrExpires.textContent = 'Connecting...';
                qrExpires.className = 'qr-expires connecting';
            }
        } else {
            // Show QR with normal expiration
            qrSection.style.display = 'block';
            profileSection.style.display = 'none';
            
            // Reset QR expiration
            const qrExpires = document.getElementById('qr-expires');
            if (qrExpires) {
                qrExpires.textContent = 'Expires in 30s';
                qrExpires.className = 'qr-expires';
            }
        }
    }

    // QR functionality
    startQRPolling() {
        this.qrInterval = setInterval(() => {
            this.fetchQR();
        }, 2000);
    }

    async fetchQR() {
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/qr`);
            if (data) {
                this.updateQR(data);
            }
        } catch (error) {
            console.error('Failed to fetch QR:', error);
        }
    }

    updateQR(qrData) {
        const canvas = document.getElementById('qr-canvas');
        const qrExpires = document.getElementById('qr-expires');
        
        if (qrData.qr && canvas) {
            // Draw QR code (simplified - in production use a QR library)
            this.drawQRCode(qrData.qr);
            
            // Update expiration
            if (qrData.expiresAt && qrExpires) {
                this.updateExpiresLabel(qrData.expiresAt);
            }
        } else if (canvas) {
            // Clear QR when not available
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 240, 240);
            ctx.fillStyle = '#F3F4F6';
            ctx.fillRect(0, 0, 240, 240);
            ctx.fillStyle = '#6B7280';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No QR available', 120, 120);
        }
    }

    drawQRCode(qrData) {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas) return;
        
        // Clear canvas first
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 240, 240);
        
        // Use QRCode.js library to generate QR code
        if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, qrData, {
                width: 240,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) {
                    console.error('QR code generation failed:', error);
                    // Fallback to simple pattern
                    this.drawFallbackQR(canvas);
                }
            });
        } else {
            // Fallback if QRCode library not loaded
            this.drawFallbackQR(canvas);
        }
    }

    drawFallbackQR(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 240, 240);
        ctx.fillStyle = '#000000';
        
        // Draw a simple pattern as fallback
        for (let i = 0; i < 20; i++) {
            for (let j = 0; j < 20; j++) {
                if (((i + j) % 3 === 0) || (i === j) || (j === 0) || (j === 19)) {
                    ctx.fillRect(i * 12, j * 12, 10, 10);
                }
            }
        }
    }

    updateExpiresLabel(expiresAt) {
        const qrExpires = document.getElementById('qr-expires');
        if (qrExpires) {
            const now = new Date().getTime();
            const expires = new Date(expiresAt).getTime();
            const remaining = Math.max(0, Math.floor((expires - now) / 1000));
            
            if (remaining > 0) {
                qrExpires.textContent = `Expires in ${remaining}s`;
                qrExpires.className = 'qr-expires';
            } else {
                qrExpires.textContent = 'Expired';
                qrExpires.className = 'qr-expires expired';
                // Dim the QR canvas when expired
                const canvas = document.getElementById('qr-canvas');
                if (canvas) {
                    canvas.style.opacity = '0.5';
                }
            }
        }
    }

    // Groups functionality
    async loadGroups() {
        try {
            const search = document.getElementById('groups-search').value;
            const offset = (this.currentPage - 1) * this.itemsPerPage;
            
            const params = new URLSearchParams({
                search: search,
                limit: this.itemsPerPage,
                offset: offset
            });
            
            const data = await this.fetchJSON(`${this.apiBaseUrl}/groups?${params}`);
            if (data) {
                this.groups = data.items || [];
                this.renderGroups();
                this.updatePagination(data.total || 0);
            }
        } catch (error) {
            console.error('Failed to load groups:', error);
        }
    }

    renderGroups() {
        const tbody = document.querySelector('#groups-table tbody');
        if (!tbody) return;
        
        if (!this.groups || this.groups.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No groups found</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.groups.map(group => `
            <tr class="${group.monitor ? 'monitoring' : ''}">
                <td title="${group.name}">${this.truncateText(group.name, 30)}</td>
                <td>
                    <span class="mono-font">${group.wa_group_id}</span>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${group.wa_group_id}')" title="Copy ID"><i class="fas fa-copy"></i></button>
                </td>
                <td>
                <div class="toggle-switch ${group.monitor ? 'active' : ''}" 
                     data-group-id="${group.id}" 
                     onclick="toggleGroupMonitor('${group.id}')"
                     role="switch"
                     aria-checked="${group.monitor}"
                     tabindex="0"
                     title="${group.monitor ? 'Monitoring enabled' : 'Monitoring disabled'}">
                </div>
                </td>
            </tr>
        `).join('');
    }

    updatePagination(total) {
        const maxPage = Math.ceil(total / this.itemsPerPage);
        document.getElementById('groups-page').textContent = `Page ${this.currentPage} (${total} total)`;
        document.getElementById('groups-prev').disabled = this.currentPage === 1;
        document.getElementById('groups-next').disabled = this.currentPage >= maxPage;
    }

    async toggleGroupMonitor(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        const newMonitorState = !group.monitor;
        
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/groups/${groupId}/toggle`, {
                method: 'POST',
                body: JSON.stringify({ monitor: newMonitorState })
            });
            
            if (data) {
                group.monitor = newMonitorState;
                this.renderGroups();
                this.showToast(`Monitoring ${newMonitorState ? 'enabled' : 'disabled'} for ${group.name}`, 'success');
                this.addActivity(`Group monitoring ${newMonitorState ? 'enabled' : 'disabled'} for ${group.name}`, 'info');
            }
        } catch (error) {
            console.error('Failed to toggle group monitor:', error);
            this.showToast('Failed to update monitoring status', 'error');
        }
    }

    async fetchNewGroups() {
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/fetch-groups-now`, { method: 'POST' });
            if (data) {
                this.showToast('Discovery triggered', 'success');
                this.addActivity('Group discovery triggered', 'info');
                // Reload groups after a short delay
                setTimeout(() => this.loadGroups(), 2000);
            }
        } catch (error) {
            console.error('Failed to fetch new groups:', error);
        }
    }

    handleSearch(event) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.currentPage = 1;
            this.loadGroups();
        }, 300);
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadGroups();
        }
    }

    nextPage() {
        this.currentPage++;
        this.loadGroups();
    }

    // Messages functionality
    async loadMessages() {
        const groupFilter = document.getElementById('msg-filter-group').value;
        const kindFilter = document.getElementById('msg-filter-kind').value;
        
        try {
            const params = new URLSearchParams({
                limit: 50,
                offset: 0
            });
            
            if (groupFilter) params.append('groupId', groupFilter);
            if (kindFilter) params.append('kind', kindFilter);
            
            const data = await this.fetchJSON(`${this.apiBaseUrl}/messages?${params}`);
            if (data) {
                this.messages = data || [];
                this.renderMessages();
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderMessages() {
        const messagesList = document.getElementById('messages-list');
        if (!messagesList) return;
        
        if (!this.messages || this.messages.length === 0) {
            messagesList.innerHTML = '<div class="empty-state">No messages yet.</div>';
            return;
        }
        
        messagesList.innerHTML = this.messages.map(msg => `
            <div class="msg-item">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <div class="msg-time">${this.formatTime(msg.ts)}</div>
                    <div class="msg-group">${msg.group}</div>
                </div>
                <div class="msg-sender" style="margin-bottom: 4px;">
                    <span class="kind-badge">${msg.kind}</span>
                    <span style="color: #6B7280; font-family: ui-monospace, monospace;">${msg.sender}</span>
                </div>
                <div class="msg-content">
                    ${msg.kind === 'text' ? this.truncateText(msg.text || '', 100) : 
                      `<button class="msg-media-btn" onclick="window.waMonitor.openMedia('${msg.mediaUrl}')">Open media</button>`}
                    ${msg.parentId ? '<span class="chain-icon" title="Linked to related message"><i class="fas fa-link"></i></span>' : ''}
                </div>
            </div>
        `).join('');
    }

    openMedia(mediaUrl) {
        if (mediaUrl) {
            window.open(mediaUrl, '_blank');
        }
    }

    // System Activity functionality
    async loadSystemActivity() {
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/activity?limit=20`);
            if (data) {
                this.renderActivity(data);
            }
        } catch (error) {
            console.error('Failed to load activity:', error);
        }
    }

    renderActivity(activities) {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        if (!activities || activities.length === 0) {
            activityList.innerHTML = '<div class="activity-empty">No recent activity</div>';
            return;
        }

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.icon}">
                    <i class="fas fa-${activity.icon === 'success' ? 'check' : activity.icon === 'error' ? 'times' : 'info'}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-time">${this.formatTime(activity.at)}</div>
                    <div class="activity-message">${activity.message}</div>
                </div>
            </div>
        `).join('');
    }

    clearActivity() {
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            activityList.innerHTML = '<div class="activity-empty">Activity cleared</div>';
        }
    }

    addActivity(message, type = 'info') {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        const now = new Date();
        const time = now.toISOString().slice(0, 19).replace('T', ' ');
        
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon ${type}">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-time">${time}</div>
                <div class="activity-message">${message}</div>
            </div>
        `;

        // Add to top of list
        activityList.insertBefore(activityItem, activityList.firstChild);

        // Keep only last 5 activities
        const items = activityList.querySelectorAll('.activity-item');
        if (items.length > 5) {
            activityList.removeChild(items[items.length - 1]);
        }
    }

    // Action methods
    async logoutGoogle() {
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/logout`, { method: 'POST' });
            if (data) {
                this.showToast('Logged out from Google', 'success');
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    }

    async disconnectWhatsApp() {
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/wa/disconnect`, { method: 'POST' });
            if (data) {
                this.showToast('WhatsApp disconnect requested', 'success');
                this.addActivity('WhatsApp disconnect requested', 'info');
            }
        } catch (error) {
            console.error('Failed to disconnect WhatsApp:', error);
        }
    }

    async refreshQR() {
        try {
            const data = await this.fetchJSON(`${this.apiBaseUrl}/wa/refresh-qr`, { method: 'POST' });
            if (data) {
                this.showToast('QR code refresh requested', 'success');
                this.addActivity('QR code refresh requested', 'info');
            }
        } catch (error) {
            console.error('Failed to refresh QR:', error);
        }
    }

    // Utility functions
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString('sv-SE');
    }

    showToast(message, type = 'success') {
        const toaster = document.getElementById('toaster');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toaster.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing WA Monitor with API integration...');
    window.waMonitor = new WAMonitorDashboard();
});

// Add global toggle function for groups
window.toggleGroupMonitor = function(groupId) {
    const monitor = window.waMonitor;
    if (monitor) {
        monitor.toggleGroupMonitor(groupId);
    }
};
