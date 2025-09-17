# WA Monitor Dashboard - Technical Documentation

## 📋 Overview

The WA Monitor Dashboard is a **single-page application (SPA)** designed for monitoring WhatsApp and Google connections. It provides real-time status updates, group management, message logging, and system activity tracking in a clean, responsive interface.

## 🏗️ Architecture

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Icons**: Font Awesome 6.0.0
- **Layout**: CSS Grid + Flexbox
- **Architecture**: Class-based JavaScript with real-time polling

### File Structure
```
wa-track/
├── designs/
│   └── index.html              # Main dashboard
├── assets/
│   ├── css/
│   │   └── design3.css         # Stylesheet
│   └── js/
│       └── design3.js          # Application logic
└── README.md                   # This documentation
```

## 🎨 Design System

### Layout Structure

#### Desktop Layout (≥1024px)
```
┌─────────────────────────────────────────────────────────┐
│ Header: WA Monitor                    [Logout] [Disconnect] │
├─────────────────────────────────────────────────────────┤
│ Left Column (66%)        │ Right Column (34%)          │
│ ┌─────────────────────┐  │ ┌─────────────────────────┐  │
│ │ Google Status Card  │  │ │ System Activity Panel  │  │
│ └─────────────────────┘  │ └─────────────────────────┘  │
│ ┌─────────────────────┐  │ ┌─────────────────────────┐  │
│ │ WhatsApp Status     │  │ │ Message Log Panel      │  │
│ │ (with QR/Profile)   │  │ └─────────────────────────┘  │
│ └─────────────────────┘  │                             │
│ ┌─────────────────────┐  │                             │
│ │ Groups Panel        │  │                             │
│ └─────────────────────┘  │                             │
└─────────────────────────────────────────────────────────┘
```

#### Mobile Layout (<1024px)
```
┌─────────────────────────┐
│ Header: WA Monitor      │
│ [Logout] [Disconnect]   │
├─────────────────────────┤
│ Google Status Card      │
├─────────────────────────┤
│ WhatsApp Status Card    │
├─────────────────────────┤
│ Groups Panel            │
├─────────────────────────┤
│ Message Log Panel       │
├─────────────────────────┤
│ System Activity Panel   │
└─────────────────────────┘
```

## 🔧 Component Documentation

### 1. Header Section

**Purpose**: Global controls and branding

**HTML Structure**:
```html
<header class="header">
    <div class="header-container">
        <h1 class="header-title">WA Monitor</h1>
        <div class="header-actions">
            <button id="btn-logout-google" class="btn btn-secondary">Logout Google</button>
            <button id="btn-wa-disconnect" class="btn btn-secondary">Disconnect WhatsApp</button>
        </div>
    </div>
</header>
```

**Features**:
- Responsive button layout
- Consistent styling with design system
- Event handlers for logout/disconnect actions

### 2. Google Status Card

**Purpose**: Display Google connection status and user profile

**HTML Structure**:
```html
<div id="card-google" class="card">
    <div class="card-header">
        <div class="card-icon google"><i class="fab fa-google"></i></div>
        <span class="card-title">Google</span>
    </div>
    <div class="card-body">
        <div id="google-state-badge" class="badge badge-connected">connected</div>
        <div id="google-content">
            <img id="google-avatar" src="..." alt="Avatar">
            <span id="google-email">user@example.com</span>
        </div>
    </div>
</div>
```

**States**:
- **Connected**: Green badge + avatar + email
- **Disconnected**: Gray badge + "Not signed in" message

**Styling**:
- Square card with equal height to WhatsApp card
- Google brand colors (blue icon, green connected badge)
- No sign-in button (removed per requirements)

### 3. WhatsApp Status Card

**Purpose**: Display WhatsApp connection status with dynamic QR/profile switching

**HTML Structure**:
```html
<div id="card-whatsapp" class="card">
    <div class="card-header">
        <div class="card-icon whatsapp"><i class="fab fa-whatsapp"></i></div>
        <span class="card-title">WhatsApp</span>
    </div>
    <div class="card-body">
        <div id="wa-state-badge" class="badge badge-disconnected">disconnected</div>
        <div id="wa-content">
            <!-- QR Section (disconnected/connecting) -->
            <div id="wa-qr-section" class="wa-qr-section">
                <div class="qr-container">
                    <canvas id="qr-canvas" width="240" height="240"></canvas>
                    <button id="btn-refresh-qr" class="btn-refresh">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div id="qr-expires" class="qr-expires">Expires in 30s</div>
            </div>
            
            <!-- Profile Section (connected) -->
            <div id="wa-profile-section" class="wa-profile-section">
                <div class="wa-connected">
                    <img id="wa-avatar" src="..." alt="Avatar">
                    <div class="wa-profile-info">
                        <div id="wa-name">John Doe</div>
                        <div id="wa-number">+1234567890</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Dynamic States**:

| State | Badge Color | Display | QR Expiration |
|-------|-------------|---------|---------------|
| **Disconnected** | Gray | QR Code | "Expires in 30s" |
| **Connecting** | Amber | QR Code | "Connecting..." |
| **Connected** | Green | Profile Info | Hidden |

**Features**:
- Integrated QR code within the card (no separate panel)
- Real-time state cycling every 3 seconds
- Responsive QR hiding on mobile when connected
- WhatsApp brand colors (green icon, color-coded badges)

### 4. Groups Management Panel

**Purpose**: Display and manage WhatsApp groups with monitoring controls

**HTML Structure**:
```html
<div id="panel-groups" class="card">
    <div class="card-header">
        <h2 class="card-title">Groups</h2>
        <div class="card-controls">
            <input id="groups-search" type="text" 
                   placeholder="Search by name or id..." class="search-input">
            <button id="btn-fetch-groups" class="btn btn-primary">
                <i class="fas fa-sync-alt"></i> Fetch new groups
            </button>
        </div>
    </div>
    <div class="card-body">
        <div class="table-container">
            <table id="groups-table" class="groups-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Group ID</th>
                        <th>Monitor</th>
                    </tr>
                </thead>
                <tbody id="groups-tbody"></tbody>
            </table>
        </div>
        <div class="pagination">
            <button id="groups-prev">Prev</button>
            <span id="groups-page">Page 1</span>
            <button id="groups-next">Next</button>
        </div>
    </div>
</div>
```

**Features**:
- **Real-time Search**: Debounced input with 300ms delay
- **Pagination**: 10 groups per page with navigation controls
- **Monitoring Toggles**: Individual switches for each group
- **Row Highlighting**: Monitored groups show green left border
- **Sticky Header**: Table header remains visible during scroll
- **Responsive**: Horizontal scroll on mobile

**Group Data Structure**:
```javascript
{
    id: "group_001",
    name: "Family Chat",
    monitor: true,
    memberCount: 15,
    lastActivity: "2025-01-16T10:30:00Z"
}
```

### 5. Message Log Panel

**Purpose**: Display and filter WhatsApp messages with structured information

**HTML Structure**:
```html
<div id="panel-messages" class="card">
    <div class="card-header">
        <h2 class="card-title">Message Log</h2>
        <div class="card-filters">
            <select id="msg-filter-group">
                <option value="">All Groups</option>
            </select>
            <select id="msg-filter-kind">
                <option value="">All</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="doc">Document</option>
            </select>
        </div>
    </div>
    <div class="card-body">
        <div id="messages-list" class="messages-list"></div>
    </div>
</div>
```

**Message Structure**:
```javascript
{
    id: "msg_001",
    timestamp: "2025-01-16T10:30:00Z",
    groupName: "Family Chat",
    sender: "+1234567890",
    kind: "text",
    content: "Hello everyone!",
    mediaUrl: null,
    parentId: null
}
```

**Features**:
- **Real-time Updates**: New messages appear at the top
- **Dual Filtering**: By group and message type
- **Structured Display**: Time, group, sender, content
- **Media Links**: Clickable links for media files
- **Thread Support**: Shows parent message context
- **Empty State**: "No messages yet" when no data

### 6. System Activity Panel

**Purpose**: Display real-time system events and audit log

**HTML Structure**:
```html
<div id="panel-activity" class="card">
    <div class="card-header">
        <h2 class="card-title">System Activity</h2>
        <button id="btn-clear-activity" class="btn btn-secondary">
            <i class="fas fa-trash"></i> Clear
        </button>
    </div>
    <div class="card-body">
        <div id="activity-list" class="activity-list">
            <div class="activity-item">
                <div class="activity-icon success">
                    <i class="fas fa-check"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-time">2025-09-16 03:12</div>
                    <div class="activity-message">Discovery triggered</div>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Activity Types**:
- **Success**: Green checkmark (connections, discoveries)
- **Error**: Red X (failed operations)
- **Info**: Blue i (general notifications)

**Features**:
- **Real-time Logging**: New events appear at the top
- **Color-coded Icons**: Visual indication of event type
- **Timestamp Display**: Precise time for each event
- **Scrollable List**: Handles overflow with scroll
- **Clear Function**: Removes all activity entries
- **Limited History**: Shows last 5 events

## ⚙️ JavaScript Architecture

### Class Structure

```javascript
class WAMonitorDashboard {
    constructor() {
        this.groups = [];
        this.messages = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.statusInterval = null;
        this.qrInterval = null;
        this.searchTimeout = null;
        this.init();
    }
}
```

### Key Methods

#### Status Management
- `fetchStatus()`: Simulates API calls, cycles WhatsApp states
- `updateStatusCards()`: Updates UI based on connection states
- `startStatusPolling()`: Polls every 2 seconds for status updates

#### Data Management
- `loadGroups()`: Renders groups table with pagination
- `loadMessages()`: Renders message log with filters
- `loadSystemActivity()`: Shows recent system events

#### User Interactions
- `toggleGroupMonitor()`: Enables/disables group monitoring
- `handleSearch()`: Real-time search with debouncing
- `openMedia()`: Opens media files in new tab

#### Event Handling
- `bindEvents()`: Attaches all event listeners
- `showToast()`: Displays notification messages
- `addActivity()`: Adds entries to system activity log

### Real-time Updates

#### Polling System
```javascript
startStatusPolling() {
    this.statusInterval = setInterval(() => {
        this.fetchStatus();
    }, 2000);
}
```

**Update Cycle (every 2 seconds)**:
1. **Status Check**: Simulates API call to get current states
2. **UI Update**: Updates badges, shows/hides QR/profile sections
3. **State Cycling**: WhatsApp cycles through disconnected → connecting → connected
4. **Activity Logging**: Adds system events to activity panel

#### Event-Driven Updates
- **Group Toggle**: Immediately updates UI, adds activity log entry
- **Search**: Debounced input with 300ms delay
- **Media Click**: Opens in new tab, logs activity

## 🎨 CSS Design System

### Design Tokens

```css
:root {
    /* Colors */
    --primary: #3B82F6;
    --success: #10B981;
    --warning: #F59E0B;
    --danger: #EF4444;
    --gray-50: #F9FAFB;
    --gray-100: #F3F4F6;
    --gray-200: #E5E7EB;
    --gray-500: #6B7280;
    --gray-900: #111827;
    
    /* Spacing */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    
    /* Border Radius */
    --radius: 8px;
    --radius-lg: 12px;
    
    /* Shadows */
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

### Component Styling

#### Cards
- Rounded corners (`border-radius: 8px`)
- Subtle shadows (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)`)
- Consistent padding (`padding: 1.5rem`)
- Hover effects for interactive elements

#### Badges
- Pill-shaped (`border-radius: 9999px`)
- Color-coded states:
  - **Connected**: Green (`#10B981`)
  - **Connecting**: Amber (`#F59E0B`)
  - **Disconnected**: Gray (`#6B7280`)

#### Buttons
- **Primary**: Blue background (`#3B82F6`)
- **Secondary**: Gray background (`#6B7280`)
- Rounded corners (`border-radius: 6px`)
- Hover and focus states

#### Tables
- Hover effects on rows
- Sticky headers when scrolling
- Row highlighting for monitored groups
- Responsive horizontal scroll on mobile

### Responsive Breakpoints

```css
/* Mobile First Approach */
@media (max-width: 767px) {
    .container {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
    
    .header-actions {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .wa-qr-section {
        display: none; /* Hide QR when connected on mobile */
    }
}

@media (min-width: 768px) and (max-width: 1023px) {
    .container {
        grid-template-columns: 1fr;
    }
}

@media (min-width: 1024px) {
    .container {
        grid-template-columns: 2fr 1fr;
    }
}
```

## 📱 Responsive Design

### Desktop (≥1024px)
- Two-column grid layout (66% left, 34% right)
- Full feature set with all panels visible
- Optimal spacing and typography

### Tablet (768px - 1023px)
- Single column layout
- Maintains all functionality
- Adjusted spacing for touch interfaces

### Mobile (<768px)
- Single column stack
- Touch-friendly button sizes
- QR code hidden when WhatsApp connected
- Horizontal scroll for tables
- Optimized typography and spacing

## 🔄 State Management

### Connection States

#### Google Status
- **Connected**: Always shows connected state
- **Disconnected**: Shows "Not signed in" message
- **No Sign-in Button**: Removed per requirements

#### WhatsApp Status
- **Disconnected**: Gray badge + QR code + "Expires in 30s"
- **Connecting**: Amber badge + QR code + "Connecting..."
- **Connected**: Green badge + profile info (name + phone)

### Data States

#### Groups
- **Empty**: Shows "No groups found" message
- **Loaded**: Table with pagination and search
- **Monitoring**: Green row highlight for active monitoring

#### Messages
- **Empty**: Shows "No messages yet" message
- **Loaded**: Structured list with filters
- **Real-time**: New messages appear at top

#### System Activity
- **Empty**: Shows sample activities
- **Active**: Real-time event logging
- **Limited**: Shows last 5 events with scroll

## 🚀 Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- Local web server (for development)

### Installation
1. Clone or download the project files
2. Start a local web server:
   ```bash
   cd itwa-track/designs
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser

### Development
- Edit `assets/css/design3.css` for styling changes
- Edit `assets/js/design3.js` for functionality changes
- Edit `index.html` for structure changes

## 🔧 API Integration

### Current Implementation
The dashboard currently uses **simulated data** for demonstration purposes:

```javascript
// Status simulation
async fetchStatus() {
    const whatsappStates = ['connected', 'connecting', 'disconnected'];
    const currentTime = Date.now();
    const stateIndex = Math.floor(currentTime / 3000) % whatsappStates.length;
    
    const data = {
        google: {
            connected: true,
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
}
```

### Real API Integration
To connect to real APIs, replace the simulation methods with actual HTTP requests:

```javascript
async fetchStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        this.updateStatusCards(data);
    } catch (error) {
        console.error('Failed to fetch status:', error);
    }
}
```

## 🎯 Key Features Summary

✅ **Status Management**: Real-time connection monitoring  
✅ **QR Integration**: Dynamic QR code display in WhatsApp card  
✅ **Group Monitoring**: Toggle switches with visual feedback  
✅ **Message Logging**: Structured message display with filters  
✅ **System Activity**: Real-time audit log with icons  
✅ **Responsive Design**: Works on all screen sizes  
✅ **Search & Pagination**: Efficient data navigation  
✅ **Visual Polish**: Modern design with proper spacing and colors  
✅ **Accessibility**: ARIA labels and keyboard navigation  
✅ **Performance**: Optimized rendering and event handling  

## 📄 License

This project is part of the ITWA Track application suite. All rights reserved.

---

**Version**: 0.1.0  
**Last Updated**: January 2025  
**Author**: WA Monitor Development Team
