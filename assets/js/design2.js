// Design 2 - Simplified MVP WA Monitor JavaScript

class WAMonitorMVP {
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
        this.bindEvents();
        this.startStatusPolling();
        this.startQRPolling();
        this.loadGroups();
        this.loadMessages();
    }

    bindEvents() {
        // Header buttons
        document.getElementById('btn-logout-google').addEventListener('click', () => this.logoutGoogle());
        document.getElementById('btn-wa-disconnect').addEventListener('click', () => this.disconnectWhatsApp());
        
        // Google login
        document.getElementById('btn-login-google').addEventListener('click', () => this.loginGoogle());
        
        // QR controls
        document.getElementById('btn-open-qr').addEventListener('click', () => this.openQR());
        document.getElementById('btn-refresh-qr').addEventListener('click', () => this.refreshQR());
        
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
            const response = await fetch('/api/status');
            const data = await response.json();
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
                <div class="google-connected">
                    <img src="${status.google.avatar}" alt="Avatar" class="avatar" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;">
                    <span>${status.google.email}</span>
                </div>
            `;
        } else {
            googleBadge.textContent = 'disconnected';
            googleBadge.className = 'badge badge-disconnected';
            googleContent.innerHTML = `
                <div class="not-signed-in">
                    <span>Not signed in</span>
                    <button id="btn-login-google" class="btn btn-primary">Sign in</button>
                </div>
            `;
            // Re-bind the login button
            document.getElementById('btn-login-google').addEventListener('click', () => this.loginGoogle());
        }

        // Update WhatsApp status
        const waBadge = document.getElementById('wa-state-badge');
        const waContent = document.getElementById('wa-content');
        
        waBadge.textContent = status.whatsapp.state;
        waBadge.className = `badge badge-${status.whatsapp.state}`;
        
        if (status.whatsapp.connected) {
            waContent.innerHTML = `
                <div class="wa-connected">
                    <div>${status.whatsapp.name}</div>
                    <div>${status.whatsapp.number}</div>
                </div>
            `;
        } else {
            waContent.innerHTML = `
                <div class="helper-text">Use QR panel to connect.</div>
            `;
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
        const qrCanvas = document.getElementById('qr-canvas');
        const qrExpires = document.getElementById('qr-expires');
        
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
                if ((i + j) % 3 === 0) {
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
            } else {
                qrExpires.textContent = 'Expired';
                qrExpires.style.color = '#EF4444';
            }
        }
    }

    // Groups functionality - Clean tabular design
    async loadGroups() {
        try {
            const response = await fetch('/api/groups');
            const data = await response.json();
            this.groups = data.groups;
            this.renderGroups();
        } catch (error) {
            console.error('Failed to load groups:', error);
        }
    }

    renderGroups() {
        const tbody = document.querySelector('#groups-table tbody');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageGroups = this.groups.slice(startIndex, endIndex);
        
        tbody.innerHTML = pageGroups.map(group => `
            <tr>
                <td title="${group.name}">${this.truncateText(group.name, 30)}</td>
                <td>
                    <span class="mono-font">${group.id}</span>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${group.id}')" title="Copy ID">📋</button>
                </td>
                <td>
                    <div class="toggle-switch ${group.monitor ? 'active' : ''}" 
                         data-group-id="${group.id}" 
                         onclick="this.toggleGroupMonitor('${group.id}')">
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
            const response = await fetch(`/api/groups/${groupId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monitor: !group.monitor })
            });
            
            if (response.ok) {
                group.monitor = !group.monitor;
                this.renderGroups();
                this.showToast('Updated', 'success');
            } else {
                this.showToast('Update failed', 'error');
            }
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

    // Messages functionality - Structured rows, not chat bubbles
    async loadMessages() {
        const groupFilter = document.getElementById('msg-filter-group').value;
        const kindFilter = document.getElementById('msg-filter-kind').value;
        
        try {
            const params = new URLSearchParams({
                limit: '50',
                offset: '0',
                groupId: groupFilter,
                kind: kindFilter
            });
            
            const response = await fetch(`/api/messages?${params}`);
            const data = await response.json();
            this.messages = data.messages;
            this.renderMessages();
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderMessages() {
        const messagesList = document.getElementById('messages-list');
        
        messagesList.innerHTML = this.messages.map(msg => `
            <div class="msg-item">
                <div class="msg-time">${this.formatTime(msg.timestamp)}</div>
                <div class="msg-group">${msg.groupName}</div>
                <div class="msg-sender">
                    <span class="kind-badge">${msg.kind}</span>
                    <span>${msg.sender}</span>
                </div>
                <div class="msg-content">
                    ${msg.kind === 'text' ? this.truncateText(msg.content, 100) : 
                      `<button class="msg-media-btn" onclick="this.openMedia('${msg.mediaUrl}')">Open media</button>`}
                    ${msg.parentId ? '<span title="Linked to related message">🔗</span>' : ''}
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new WAMonitorMVP();
});

// Add global toggle function for groups
window.toggleGroupMonitor = function(groupId) {
    const monitor = window.waMonitor;
    if (monitor) {
        monitor.toggleGroupMonitor(groupId);
    }
};
