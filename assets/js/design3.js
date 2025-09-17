// Design 3 - MVP Dashboard with Clean Control Panel Structure

class WAMonitorDashboard {
    constructor() {
        this.statusInterval = null;
        this.qrInterval = null;
        this.groups = [];
        this.messages = [];
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.searchTimeout = null;
        
        this.init();
    }

    init() {
        console.log('WA Monitor initializing...');
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
        
        // Google login (if button exists)
        const googleLoginBtn = document.getElementById('btn-login-google');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => this.loginGoogle());
        }
        
        // QR controls (if buttons exist)
        const openQRBtn = document.getElementById('btn-open-qr');
        if (openQRBtn) {
            openQRBtn.addEventListener('click', () => this.openQR());
        }
        
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
    }




    // Status polling
    startStatusPolling() {
        this.statusInterval = setInterval(() => {
            this.fetchStatus();
        }, 2000);
    }

    async fetchStatus() {
        try {
            // Simulate API call with dummy data - Google always connected, WhatsApp cycles through states
            const whatsappStates = ['connected', 'connecting', 'disconnected'];
            const currentTime = Date.now();
            const stateIndex = Math.floor(currentTime / 3000) % whatsappStates.length; // Change every 3 seconds
            
            const data = {
                google: {
                    connected: true, // Always connected
                    avatar: 'https://via.placeholder.com/32/4285F4/FFFFFF?text=G',
                    email: 'user@example.com'
                },
                whatsapp: {
                    state: whatsappStates[stateIndex],
                    name: 'John Doe',
                    number: '+1234567890'
                }
            };
            this.updateStatusCards(data);
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
                    <img id="google-avatar" src="${status.google.avatar}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #E5E7EB;">
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
            const response = await fetch('/api/qr');
            const data = await response.json();
            this.updateQR(data);
        } catch (error) {
            console.error('Failed to fetch QR:', error);
        }
    }

    updateQR(qrData) {
        const qrContent = document.getElementById('qr-content');
        
        if (qrData.connected) {
            qrContent.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6B7280;">
                    Connected — no QR needed.
                </div>
            `;
        } else if (qrData.qrCode) {
            qrContent.innerHTML = `
                <div class="qr-placeholder">
                    <canvas id="qr-canvas" width="240" height="240"></canvas>
                    <div id="qr-expires" class="qr-expires">Expires in ${qrData.expiresIn}s</div>
                    <button id="btn-refresh-qr" class="btn-refresh">↻</button>
                </div>
            `;
            
            // Draw QR code
            this.drawQRCode(qrData.qrCode);
            
            // Re-bind refresh button
            document.getElementById('btn-refresh-qr').addEventListener('click', () => this.refreshQR());
            
            // Update expires label
            this.updateExpiresLabel(qrData.expiresAt);
        } else {
            qrContent.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6B7280;">
                    Click Open QR to connect.
                </div>
            `;
        }
    }

    drawQRCode(qrData) {
        const canvas = document.getElementById('qr-canvas');
        const ctx = canvas.getContext('2d');
        
        // Simple QR code representation (in real app, use a QR library)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 240, 240);
        ctx.fillStyle = '#000000';
        
        // Draw a simple pattern (replace with actual QR rendering)
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

    // Groups functionality - Clean control table
    async loadGroups() {
        try {
            console.log('Loading groups...', this.groups?.length);
            // Use dummy data instead of API call
            this.renderGroups();
        } catch (error) {
            console.error('Failed to load groups:', error);
        }
    }

    renderGroups() {
        console.log('Rendering groups...', this.groups?.length);
        const tbody = document.querySelector('#groups-table tbody');
        if (!tbody) {
            console.error('Groups table tbody not found');
            return;
        }
        
        if (!this.groups || this.groups.length === 0) {
            console.log('No groups to render');
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No groups found</td></tr>';
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageGroups = this.groups.slice(startIndex, endIndex);
        
        tbody.innerHTML = pageGroups.map(group => `
            <tr class="${group.monitor ? 'monitoring' : ''}">
                <td title="${group.name}">${this.truncateText(group.name, 30)}</td>
                <td>
                    <span class="mono-font">${group.id}</span>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${group.id}')" title="Copy ID"><i class="fas fa-copy"></i></button>
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
        
        // Update pagination
        document.getElementById('groups-page').textContent = `Page ${this.currentPage}`;
        document.getElementById('groups-prev').disabled = this.currentPage === 1;
        document.getElementById('groups-next').disabled = endIndex >= this.groups.length;
    }

    async toggleGroupMonitor(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        try {
            // Simulate API call with dummy data
            group.monitor = !group.monitor;
            this.renderGroups();
            this.showToast(`Monitoring ${group.monitor ? 'enabled' : 'disabled'} for ${group.name}`, 'success');
            
            // Add to system activity
            this.addActivity(`Group monitoring ${group.monitor ? 'enabled' : 'disabled'} for ${group.name}`, 'info');
        } catch (error) {
            console.error('Failed to toggle group monitor:', error);
            this.showToast('Network error', 'error');
        }
    }

    async fetchNewGroups() {
        try {
            const response = await fetch('/api/fetch-groups-now', { method: 'POST' });
            if (response.ok) {
                this.showToast('Discovery triggered', 'success');
                // Reload groups after a short delay
                setTimeout(() => this.loadGroups(), 2000);
            } else {
                this.showToast('Failed to trigger discovery', 'error');
            }
        } catch (error) {
            console.error('Failed to fetch new groups:', error);
            this.showToast('Network error', 'error');
        }
    }

    handleSearch(event) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            const query = event.target.value.toLowerCase();
            this.groups = this.groups.filter(group => 
                group.name.toLowerCase().includes(query) || 
                group.id.toLowerCase().includes(query)
            );
            this.currentPage = 1;
            this.renderGroups();
        }, 250);
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderGroups();
        }
    }

    nextPage() {
        const maxPage = Math.ceil(this.groups.length / this.itemsPerPage);
        if (this.currentPage < maxPage) {
            this.currentPage++;
            this.renderGroups();
        }
    }

    // Messages functionality - Clean structured rows
    async loadMessages() {
        const groupFilter = document.getElementById('msg-filter-group').value;
        const kindFilter = document.getElementById('msg-filter-kind').value;
        
        try {
            console.log('Loading messages...', this.messages?.length);
            // Use dummy data instead of API call
            this.renderMessages();
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderMessages() {
        console.log('Rendering messages...', this.messages?.length);
        const messagesList = document.getElementById('messages-list');
        if (!messagesList) {
            console.error('Messages list container not found');
            return;
        }
        
        if (!this.messages || this.messages.length === 0) {
            console.log('No messages to render');
            messagesList.innerHTML = `
                <div class="empty-state">No messages yet.</div>
            `;
            return;
        }
        
        messagesList.innerHTML = this.messages.map(msg => `
            <div class="msg-item">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <div class="msg-time">${this.formatTime(msg.timestamp)}</div>
                    <div class="msg-group">${msg.groupName}</div>
                </div>
                <div class="msg-sender" style="margin-bottom: 4px;">
                    <span class="kind-badge">${msg.kind}</span>
                    <span style="color: #6B7280; font-family: ui-monospace, monospace;">${msg.sender}</span>
                </div>
                <div class="msg-content">
                    ${msg.kind === 'text' ? this.truncateText(msg.content, 100) : 
                      `<button class="msg-media-btn" onclick="window.waMonitor.openMedia('${msg.mediaUrl}')">Open media</button>`}
                    ${msg.parentId ? '<span class="chain-icon" title="Linked to related message"><i class="fas fa-link"></i></span>' : ''}
                </div>
            </div>
        `).join('');
    }

    openMedia(mediaUrl) {
        window.open(mediaUrl, '_blank');
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

    // Action methods
    async loginGoogle() {
        // Implement Google OAuth flow
        this.showToast('Redirecting to Google...', 'success');
    }

    async logoutGoogle() {
        // Implement Google logout
        this.showToast('Logged out from Google', 'success');
    }

    async disconnectWhatsApp() {
        // Implement WhatsApp disconnect
        this.showToast('WhatsApp disconnected', 'success');
    }

    async openQR() {
        // Implement QR opening logic
        this.showToast('QR panel opened', 'success');
    }

    async refreshQR() {
        // Force refresh QR code
        this.fetchQR();
        this.showToast('QR code refreshed', 'success');
    }

    // System Activity functionality
    loadSystemActivity() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        // Start with empty activity log
        activityList.innerHTML = '<div class="activity-empty">No recent activity</div>';
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing WA Monitor...');
    window.waMonitor = new WAMonitorDashboard();
});

// Add global toggle function for groups
window.toggleGroupMonitor = function(groupId) {
    const monitor = window.waMonitor;
    if (monitor) {
        monitor.toggleGroupMonitor(groupId);
    }
};
