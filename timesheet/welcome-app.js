// Welcome App - Timesheet Dashboard
// Displays snapshot of last saved timesheet or demo preview

let currentUser = null;
let timesheetData = null;
let isDemo = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be ready
    if (window.firebaseReady) {
        initAuth();
    } else {
        window.addEventListener('firebaseReady', () => {
            initAuth();
        });
    }
});

// Initialize Firebase Auth
function initAuth() {
    if (!window.firebaseAuth || !window.firebaseOnAuthStateChanged) {
        console.error('Firebase Auth not initialized');
        showDemoPreview();
        return;
    }
    
    window.firebaseOnAuthStateChanged(window.firebaseAuth, async (user) => {
        if (user) {
            currentUser = user;
            updateUserDisplay(user);
            await loadLastTimesheetData();
        } else {
            // Show demo without redirecting
            console.log('No user logged in, showing demo');
            showDemoPreview();
        }
    });
}

// Update user display in navigation and hero
function updateUserDisplay(user) {
    const userNameEl = document.getElementById('userName');
    const statusTextEl = document.querySelector('.status-text');
    const userEmailDisplayEl = document.getElementById('userEmailDisplay');
    const userAvatarLargeEl = document.getElementById('userAvatarLarge');
    
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const email = user.email || 'user@astravyn.com';
    
    if (userNameEl) {
        userNameEl.textContent = displayName;
    }
    
    if (statusTextEl) {
        statusTextEl.textContent = email;
    }
    
    if (userEmailDisplayEl) {
        userEmailDisplayEl.textContent = email;
    }
    
    if (userAvatarLargeEl) {
        const initial = displayName.charAt(0).toUpperCase();
        userAvatarLargeEl.textContent = initial;
    }
}

// Load last saved timesheet data from Firestore
async function loadLastTimesheetData() {
    try {
        // Check if all required Firebase functions are available
        if (!window.firebaseCollection || !window.firebaseQuery || !window.firebaseGetDocs) {
            console.error('Firebase Firestore functions not available');
            showDemoPreview();
            return;
        }
        
        // Query for last saved timesheet
        const timesheetsRef = window.firebaseCollection(window.firebaseDb, 'timesheets');
        const q = window.firebaseQuery(
            timesheetsRef,
            window.firebaseWhere('userId', '==', currentUser.uid),
            window.firebaseOrderBy('lastModified', 'desc'),
            window.firebaseLimit(1)
        );
        
        const querySnapshot = await window.firebaseGetDocs(q);
        
        if (!querySnapshot.empty) {
            // Found saved timesheet
            const doc = querySnapshot.docs[0];
            timesheetData = doc.data();
            isDemo = false;
            
            // Extract year and month from document ID
            const docId = doc.id;
            const parts = docId.split('_');
            const year = parseInt(parts[1]);
            const monthIndex = parseInt(parts[2]);
            
            renderDashboard(year, monthIndex, timesheetData);
        } else {
            // No saved timesheets, show demo
            showDemoPreview();
        }
    } catch (error) {
        console.error('Error loading timesheet:', error);
        // Fallback to current month or demo
        const now = new Date();
        await tryLoadCurrentMonth(now.getFullYear(), now.getMonth());
    }
}

// Try to load current month as fallback
async function tryLoadCurrentMonth(year, monthIndex) {
    try {
        const docId = `${currentUser.uid}_${year}_${monthIndex}`;
        const docRef = window.firebaseDoc(window.firebaseDb, 'timesheets', docId);
        const docSnap = await window.firebaseGetDoc(docRef);
        
        if (docSnap.exists()) {
            timesheetData = docSnap.data();
            isDemo = false;
            renderDashboard(year, monthIndex, timesheetData);
        } else {
            showDemoPreview();
        }
    } catch (error) {
        console.error('Error:', error);
        showDemoPreview();
    }
}

// Show demo preview with sample data
function showDemoPreview() {
    isDemo = true;
    
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    
    // Generate demo data
    const demoData = generateDemoData(year, monthIndex);
    
    renderDashboard(year, monthIndex, { statusMap: demoData });
    
    // Show demo notice
    const heroSubtitle = document.getElementById('heroSubtitle');
    if (heroSubtitle) {
        heroSubtitle.textContent = 'Start tracking your attendance with Astravyn Time';
    }
    
    const demoNotice = document.getElementById('demoNotice');
    if (demoNotice) {
        demoNotice.style.display = 'block';
    }
    
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.style.display = 'none';
    }
}

// Generate demo data for preview
function generateDemoData(year, monthIndex) {
    const demoMap = {};
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const now = new Date();
    const today = now.getDate();
    
    // Only generate data up to today if current month
    const maxDay = (year === now.getFullYear() && monthIndex === now.getMonth()) 
        ? today 
        : daysInMonth;
    
    for (let day = 1; day <= maxDay; day++) {
        const date = new Date(year, monthIndex, day);
        const dayOfWeek = date.getDay();
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Weekend = Holiday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            demoMap[dateKey] = 'H';
        } else {
            // Realistic pattern: mostly present, some leave
            const rand = Math.random();
            if (rand > 0.95) {
                demoMap[dateKey] = 'L'; // 5% leave
            } else if (rand > 0.92) {
                demoMap[dateKey] = 'C'; // 3% comp-off
            } else {
                demoMap[dateKey] = 'P'; // 92% present
            }
        }
    }
    
    return demoMap;
}

// Render dashboard with data
function renderDashboard(year, monthIndex, data) {
    const statusMap = data.statusMap || {};
    
    // Update month display
    updateMonthDisplay(year, monthIndex);
    
    // Calculate statistics
    const stats = calculateStats(statusMap, year, monthIndex);
    
    // Update stat cards
    updateStatCards(stats);
    
    // Update attendance percentage
    updateAttendancePercentage(stats);
    
    // Render mini calendar
    renderMiniCalendar(year, monthIndex, statusMap);
    
    // Update last saved time (only if not demo)
    if (!isDemo && data.lastModified) {
        updateLastSaved(data.lastModified);
    }
}

// Render empty dashboard (no data) - now just shows demo
function renderEmptyDashboard(year, monthIndex) {
    showDemoPreview();
}

// Update month display
function updateMonthDisplay(year, monthIndex) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const heroSubtitle = document.getElementById('heroSubtitle');
    const monthYearDisplayEl = document.getElementById('monthYearDisplay');
    const savedMonthDisplayEl = document.getElementById('savedMonthDisplay');
    
    const monthName = monthNames[monthIndex];
    
    if (heroSubtitle && !isDemo) {
        heroSubtitle.textContent = `Viewing ${monthName} ${year} timesheet`;
    }
    
    if (monthYearDisplayEl) {
        monthYearDisplayEl.textContent = `${monthName} ${year}`;
    }
    
    if (savedMonthDisplayEl) {
        savedMonthDisplayEl.textContent = `${monthName} ${year}`;
    }
}

// Calculate statistics from statusMap
function calculateStats(statusMap, year, monthIndex) {
    let present = 0;
    let leave = 0;
    let compOff = 0;
    let holiday = 0;
    
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    // Count each status type
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = statusMap[dateKey];
        
        switch(status) {
            case 'P':
                present++;
                break;
            case 'L':
                leave++;
                break;
            case 'C':
                compOff++;
                break;
            case 'H':
                holiday++;
                break;
        }
    }
    
    // Calculate attendance percentage
    const totalWorkingDays = present + leave + compOff;
    const attendancePercent = totalWorkingDays > 0 
        ? Math.round((present / totalWorkingDays) * 100) 
        : 0;
    
    return {
        present,
        leave,
        compOff,
        holiday,
        attendancePercent
    };
}

// Update stat cards with numbers
function updateStatCards(stats) {
    const statPresentEl = document.getElementById('statPresent');
    const statLeaveEl = document.getElementById('statLeave');
    const statCompEl = document.getElementById('statComp');
    const statHolidayEl = document.getElementById('statHoliday');
    
    if (statPresentEl) statPresentEl.textContent = stats.present;
    if (statLeaveEl) statLeaveEl.textContent = stats.leave;
    if (statCompEl) statCompEl.textContent = stats.compOff;
    if (statHolidayEl) statHolidayEl.textContent = stats.holiday;
    
    // Animate numbers
    animateValue(statPresentEl, 0, stats.present, 500);
    animateValue(statLeaveEl, 0, stats.leave, 500);
    animateValue(statCompEl, 0, stats.compOff, 500);
    animateValue(statHolidayEl, 0, stats.holiday, 500);
}

// Update attendance percentage
function updateAttendancePercentage(stats) {
    const attendanceValueEl = document.getElementById('attendancePercentage');
    const attendanceBadgeEl = document.getElementById('attendanceBadge');
    
    if (attendanceValueEl) {
        attendanceValueEl.textContent = `${stats.attendancePercent}%`;
        animateValue(attendanceValueEl, 0, stats.attendancePercent, 800, '%');
    }
    
    // Color code the badge based on attendance
    if (attendanceBadgeEl) {
        attendanceBadgeEl.className = 'attendance-badge';
        if (stats.attendancePercent >= 90) {
            attendanceBadgeEl.classList.add('excellent');
        } else if (stats.attendancePercent >= 75) {
            attendanceBadgeEl.classList.add('good');
        } else if (stats.attendancePercent >= 60) {
            attendanceBadgeEl.classList.add('average');
        } else {
            attendanceBadgeEl.classList.add('low');
        }
    }
}

// Animate number counting up
function animateValue(element, start, end, duration, suffix = '') {
    if (!element) return;
    
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const value = Math.floor(start + (end - start) * progress);
        element.textContent = value + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Render mini calendar
function renderMiniCalendar(year, monthIndex, statusMap) {
    const calendarEl = document.getElementById('miniCalendar');
    if (!calendarEl) return;
    
    calendarEl.innerHTML = '';
    
    // Day headers
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dayNames.forEach(dayName => {
        const headerEl = document.createElement('div');
        headerEl.className = 'calendar-header';
        headerEl.textContent = dayName;
        calendarEl.appendChild(headerEl);
    });
    
    // Get first day of month and total days
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'calendar-day empty';
        calendarEl.appendChild(emptyEl);
    }
    
    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = statusMap[dateKey] || '';
        const dayOfWeek = new Date(year, monthIndex, day).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = isCurrentMonth && day === today.getDate();
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        
        if (isWeekend && !status) dayEl.classList.add('weekend');
        if (isToday) dayEl.classList.add('today');
        if (status) dayEl.classList.add(`status-${status}`);
        
        const dayNumberEl = document.createElement('div');
        dayNumberEl.className = 'day-number';
        dayNumberEl.textContent = day;
        dayEl.appendChild(dayNumberEl);
        
        // Add tooltip with status name
        if (status) {
            const statusNames = {
                'P': 'Present',
                'L': 'Leave',
                'C': 'Comp-off',
                'H': 'Holiday'
            };
            dayEl.title = `${day} - ${statusNames[status] || status}`;
        }
        
        calendarEl.appendChild(dayEl);
    }
}

// Update last saved timestamp
function updateLastSaved(timestamp) {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (!lastUpdatedEl) return;
    
    if (!timestamp) {
        lastUpdatedEl.textContent = 'Last saved: Never';
        return;
    }
    
    // Convert Firestore timestamp to Date
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    let timeAgo;
    if (diffMins < 1) {
        timeAgo = 'just now';
    } else if (diffMins < 60) {
        timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
        timeAgo = date.toLocaleDateString();
    }
    
    lastUpdatedEl.textContent = `Last saved: ${timeAgo}`;
}
