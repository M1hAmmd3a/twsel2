
const firebaseConfig = {
    databaseURL: "https://twsel-d2094-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

window.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {

// ========================================
// WhatsApp
// ========================================
const WHATSAPP_NUMBER = '970599123456';
document.getElementById('whatsappBtn').addEventListener('click', () => {
    const message = encodeURIComponent('مرحباً، أود الاستفسار عن خدمة التكسي');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
});

// ========================================
// GPS - تحديث كل 6 ثواني
// ========================================
function startDriverLocationTracking() {
    if (!currentUser.isDriver || !currentUser.driverId) return;
    if (!('geolocation' in navigator)) {
        showNotification('خطأ', 'متصفحك لا يدعم تحديد الموقع GPS');
        return;
    }
    const gpsOptions = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };

    function updateLocation() {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (currentUser.driverId) {
                    database.ref(`drivers/${currentUser.driverId}/location`).set({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: Date.now()
                    });
                }
            },
            (error) => { console.error('GPS Error:', error); },
            gpsOptions
        );
    }

    navigator.geolocation.getCurrentPosition(
        () => {
            showNotification('GPS نشط', 'تم تفعيل تتبع موقعك 📍', 3000);
            updateLocation();
            gpsUpdateInterval = setInterval(() => {
                if (currentUser.isDriver && currentUser.driverId) { updateLocation(); }
                else { clearInterval(gpsUpdateInterval); gpsUpdateInterval = null; }
            }, 6000);
        },
        () => { showNotification('تنبيه GPS', 'الرجاء السماح بالوصول للموقع', 8000); },
        gpsOptions
    );
}

function stopDriverLocationTracking() {
    if (gpsUpdateInterval) { clearInterval(gpsUpdateInterval); gpsUpdateInterval = null; }
    if (driverLocationWatcher !== null) { navigator.geolocation.clearWatch(driverLocationWatcher); driverLocationWatcher = null; }
    if (currentUser.driverId) { database.ref(`drivers/${currentUser.driverId}/location`).remove(); }
}

// ========================================
// تتبع السائق للزبون
// ========================================
function trackDriverForCustomer(requestId, driverId) {
    activeRequestTracking = requestId;

    function updateDriverLocation() {
        database.ref(`drivers/${driverId}/location`).once('value', (snapshot) => {
            const location = snapshot.val();
            if (location && activeRequestTracking === requestId) {
                const { lat, lng } = location;
                if (driverLocationMarker) {
                    driverLocationMarker.setLatLng([lat, lng]);
                } else {
                    const driverIcon = L.divIcon({
                        className: 'driver-location-icon',
                        html: '<div style="font-size:50px;animation:pulse 2s infinite;filter:drop-shadow(2px 2px 4px rgba(0,0,0,0.3))">🚕</div>',
                        iconSize: [60, 60], iconAnchor: [30, 30]
                    });
                    driverLocationMarker = L.marker([lat, lng], { icon: driverIcon })
                        .addTo(map).bindPopup('<b>🚕 السائق في الطريق إليك</b>');
                    driverLocationMarker.openPopup();
                }
                if (userLocation) {
                    map.fitBounds(L.latLngBounds([[userLocation.lat, userLocation.lng],[lat, lng]]), { padding: [100,100] });
                } else { map.setView([lat, lng], 15); }
            }
        });
    }

    updateDriverLocation();
    customerTrackingInterval = setInterval(() => {
        if (activeRequestTracking === requestId) { updateDriverLocation(); }
        else { clearInterval(customerTrackingInterval); customerTrackingInterval = null; }
    }, 6000);
}

function stopTrackingDriver() {
    activeRequestTracking = null;
    if (customerTrackingInterval) { clearInterval(customerTrackingInterval); customerTrackingInterval = null; }
    if (driverLocationMarker) { map.removeLayer(driverLocationMarker); driverLocationMarker = null; }
}

// ========================================
// Initialize Map
// ========================================
let map;
try {
    map = L.map('map').setView([32.3108, 35.0278], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
} catch (error) { console.error('Error initializing map:', error); }

const requestIcon = L.divIcon({
    className: 'custom-request-icon',
    html: '<div style="font-size:36px;animation:bounce 1s infinite;">📍</div>',
    iconSize: [40, 40], iconAnchor: [20, 40]
});
const style = document.createElement('style');
style.textContent = `@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`;
document.head.appendChild(style);

// Global State
let currentUser = { isDriver: false, driverId: null, phone: null, isBooked: false };
let requestMarkers = {};
let userLocation = null;
let expandingCircles = {};
let circleIntervals = {};
let pickupMap = null;
let pickupMarker = null;
let adminPickupMap = null;
let adminPickupMarker = null;
let adminUserLocation = null;
let driverLocationMarker = null;
let driverLocationWatcher = null;
let gpsUpdateInterval = null;
let customerTrackingInterval = null;
let activeRequestTracking = null;

// Restore driver session
function restoreDriverState() {
    const savedDriver = localStorage.getItem('currentDriver');
    if (savedDriver) {
        try {
            currentUser = JSON.parse(savedDriver);
            if (currentUser.isDriver) {
                updateDriverUI();
                listenToRequests();
                database.ref(`drivers/${currentUser.driverId}/online`).once('value', (snap) => {
                    if (!snap.val()) logoutDriver();
                });
            }
        } catch (e) { localStorage.removeItem('currentDriver'); }
    }
}
restoreDriverState();

// Modal Functions
window.openModal = function(id) { document.getElementById(id).classList.add('active'); };
window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'adminModal') {
        document.getElementById('adminForm').style.display = 'block';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('adminForm').reset();
    }
    if (id === 'requestModal') {
        document.getElementById('requestForm').reset();
        document.getElementById('locationDisplay').style.display = 'none';
        userLocation = null;
        if (pickupMarker && pickupMap) { pickupMap.removeLayer(pickupMarker); pickupMarker = null; }
    }
    if (id === 'driverModal') { document.getElementById('driverForm').reset(); }
};
document.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeModal(e.target.id); });

function showNotification(title, message, duration = 5000) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationBody').textContent = message;
    const n = document.getElementById('notification');
    n.classList.add('active');
    setTimeout(() => n.classList.remove('active'), duration);
}
function showLoading() { document.getElementById('loading').classList.add('active'); }
function hideLoading() { document.getElementById('loading').classList.remove('active'); }

// ========================================
// Driver Login - رقم هاتف فقط
// ========================================
document.getElementById('driverBtn').addEventListener('click', () => {
    if (currentUser.isDriver) { logoutDriver(); } else { openModal('driverModal'); }
});

document.getElementById('driverForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneRaw = document.getElementById('driverPhone').value.trim();
    if (!/^[0-9]{9,10}$/.test(phoneRaw)) {
        showNotification('خطأ', 'الرجاء إدخال رقم هاتف صحيح');
        return;
    }
    const phone = phoneRaw.startsWith('0') ? phoneRaw : '0' + phoneRaw;
    showLoading();
    try {
        const driverId = `driver_${phone}`;
        currentUser = { isDriver: true, driverId, phone, isBooked: false };
        localStorage.setItem('currentDriver', JSON.stringify(currentUser));

        await database.ref(`drivers/${driverId}`).set({
            phone, online: true, lastSeen: Date.now(), joinedAt: new Date().toISOString()
        });

        closeModal('driverModal');
        document.getElementById('driverForm').reset();
        updateDriverUI();
        listenToRequests();
        startDriverLocationTracking();
        showNotification('مرحباً', `تم دخولك كسائق ✅`);
    } catch (error) {
        showNotification('خطأ', 'حدث خطأ أثناء تسجيل الدخول');
    } finally { hideLoading(); }
});

function updateDriverUI() {
    const btn = document.getElementById('driverBtn');
    if (currentUser.isDriver) {
        btn.innerHTML = '<span>🚪</span><span>خروج</span>';
        btn.className = 'btn btn-logout';
        document.getElementById('mailBtn').style.display = 'flex';
        document.getElementById('onlineIndicator').style.display = 'inline-block';
    } else {
        btn.innerHTML = '<span>👨‍💼</span><span>دخول</span>';
        btn.className = 'btn btn-secondary';
        document.getElementById('mailBtn').style.display = 'none';
        document.getElementById('onlineIndicator').style.display = 'none';
    }
}

document.getElementById('togglePanelBtn').addEventListener('click', () => {
    document.getElementById('driversPanel').classList.toggle('active');
});
document.getElementById('closePanelBtn').addEventListener('click', () => {
    document.getElementById('driversPanel').classList.remove('active');
});

// ========================================
// Admin Panel
// ========================================
const ADMIN_PASSWORD = 'admin2026';

document.getElementById('adminBtn').addEventListener('click', () => openModal('adminModal'));

document.getElementById('adminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    if (password !== ADMIN_PASSWORD) {
        showNotification('خطأ', 'كلمة سر المدير غير صحيحة!');
        return;
    }
    document.getElementById('adminForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    updateAdminStats();
    loadAdminRequests();
    showNotification('مرحباً', 'تم الدخول إلى لوحة الإدارة');
});

async function updateAdminStats() {
    try {
        const d = await database.ref('drivers').orderByChild('online').equalTo(true).once('value');
        document.getElementById('activeDriversCount').textContent = d.numChildren();
        const p = await database.ref('requests').orderByChild('status').equalTo('pending').once('value');
        document.getElementById('pendingRequestsCount').textContent = p.numChildren();
        const c = await database.ref('trips').orderByChild('status').equalTo('completed').once('value');
        document.getElementById('completedTripsCount').textContent = c.numChildren();
        setTimeout(() => {
            if (document.getElementById('adminPanel').style.display !== 'none') {
                initAdminPickupMap();
                setTimeout(() => { if (adminPickupMap) adminPickupMap.invalidateSize(); }, 300);
            }
        }, 1500);
    } catch (e) { console.error(e); }
}

function initAdminPickupMap() {
    if (!adminPickupMap) {
        adminPickupMap = L.map('adminPickupMap').setView([32.3108, 35.0278], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(adminPickupMap);
        adminPickupMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            if (adminPickupMarker) { adminPickupMarker.setLatLng([lat, lng]); }
            else {
                adminPickupMarker = L.marker([lat, lng], { draggable: true }).addTo(adminPickupMap);
                adminPickupMarker.on('dragend', (ev) => {
                    const p = ev.target.getLatLng();
                    adminUserLocation = { lat: p.lat, lng: p.lng };
                    document.getElementById('adminLocationDisplay').style.display = 'flex';
                    document.getElementById('adminLocationText').textContent = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
                });
            }
            adminUserLocation = { lat, lng };
            document.getElementById('adminLocationDisplay').style.display = 'flex';
            document.getElementById('adminLocationText').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        });
    }
}

window.reloadAdminMap = function() {
    if (adminPickupMap) { adminPickupMap.remove(); adminPickupMap = null; adminPickupMarker = null; }
    setTimeout(() => {
        initAdminPickupMap();
        setTimeout(() => { if (adminPickupMap) { adminPickupMap.invalidateSize(); showNotification('تم', 'تم إعادة تحميل الخريطة'); } }, 300);
    }, 100);
};

async function loadAdminRequests() {
    const list = document.getElementById('adminRequestsList');
    database.ref('requests').on('value', (snap) => {
        const requests = snap.val() || {};
        if (!Object.keys(requests).length) { list.innerHTML = '<p style="text-align:center;color:#999">لا توجد طلبات</p>'; return; }
        list.innerHTML = Object.entries(requests).map(([id, req]) => `
            <div class="request-card">
                <div class="request-card-header">
                    <strong>${req.phone}</strong>
                    <span class="status-badge status-${req.status}">${req.status}</span>
                </div>
                <div><strong>الوجهة:</strong> ${req.destination}</div>
                <div><strong>الوقت:</strong> ${new Date(req.createdAt).toLocaleString('ar')}</div>
            </div>`).join('');
    });
}

document.getElementById('adminAddRequestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!adminUserLocation) { showNotification('خطأ', 'الرجاء تحديد الموقع على الخريطة'); return; }
    const phone = document.getElementById('adminReqPhone').value.trim();
    const destination = document.getElementById('adminReqDestination').value.trim();
    const location = document.getElementById('adminReqLocation').value.trim();
    showLoading();
    try {
        const requestId = `request_${Date.now()}`;
        await database.ref(`requests/${requestId}`).set({
            id: requestId, location: adminUserLocation, locationDescription: location,
            destination, phone, details: 'طلب من المكتب', status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            createdAt: new Date().toISOString(), addedByAdmin: true, notifiedNearby: false
        });
        document.getElementById('adminAddRequestForm').reset();
        document.getElementById('adminLocationDisplay').style.display = 'none';
        if (adminPickupMarker) { adminPickupMap.removeLayer(adminPickupMarker); adminPickupMarker = null; }
        adminUserLocation = null;
        showNotification('تم', 'تم إضافة الطلب');
        updateAdminStats();
    } catch (err) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
});

document.getElementById('logoutAllBtn').addEventListener('click', async () => {
    if (!confirm('تسجيل خروج جميع السائقين؟')) return;
    showLoading();
    try {
        const snap = await database.ref('drivers').orderByChild('online').equalTo(true).once('value');
        const drivers = snap.val() || {};
        const updates = {};
        Object.keys(drivers).forEach(id => { updates[`drivers/${id}/online`] = false; updates[`drivers/${id}/lastSeen`] = Date.now(); });
        await database.ref().update(updates);
        showNotification('تم', `تم تسجيل خروج ${Object.keys(drivers).length} سائق`);
        updateAdminStats();
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
});

document.getElementById('refreshSystemBtn').addEventListener('click', () => {
    updateAdminStats(); loadAdminRequests(); showNotification('تم', 'تم تحديث البيانات');
});

async function logoutDriver() {
    if (!currentUser.isDriver) return;
    showLoading();
    try {
        stopDriverLocationTracking();
        await database.ref(`drivers/${currentUser.driverId}`).update({ online: false, lastSeen: Date.now() });
        localStorage.removeItem('currentDriver');
        currentUser = { isDriver: false, driverId: null, phone: null, isBooked: false };
        updateDriverUI();
        showNotification('تم', 'تم تسجيل الخروج');
        setTimeout(() => window.location.reload(), 1000);
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
}

// Listen to drivers list
database.ref('drivers').orderByChild('online').equalTo(true).on('value', (snap) => {
    const drivers = snap.val() || {};
    const list = document.getElementById('driversList');
    const fiveMin = Date.now() - 5 * 60 * 1000;
    const online = Object.entries(drivers).filter(([id, d]) => d.online && d.lastSeen >= fiveMin);
    if (!online.length) {
        list.innerHTML = '<p style="text-align:center;color:#999;padding:20px">لا يوجد سائقون متصلون حالياً</p>';
    } else {
        list.innerHTML = online.map(([id, d]) => {
            const isMe = id === currentUser.driverId;
            return `<div class="driver-card" style="${isMe ? 'background:#e3f2fd;border:2px solid var(--primary)' : ''}">
                <div class="driver-avatar">🚕</div>
                <div class="driver-info">
                    <div class="driver-name">${d.phone} ${isMe ? '<span style="background:var(--primary);color:white;padding:2px 8px;border-radius:10px;font-size:11px">أنت</span>' : ''}</div>
                    <div class="driver-status"><span style="width:8px;height:8px;background:var(--success);border-radius:50%;display:inline-block"></span> متاح الآن</div>
                    ${d.averageRating ? `<div class="driver-rating">⭐ ${d.averageRating}</div>` : ''}
                </div>
            </div>`;
        }).join('');
    }
});

// ========================================
// Request Taxi - الزبون يضع رقمه في النموذج
// ========================================
document.getElementById('requestBtn').addEventListener('click', () => {
    openModal('requestModal');
    initPickupMap();
});

function initPickupMap() {
    setTimeout(() => {
        if (!pickupMap) {
            pickupMap = L.map('pickupMap').setView([32.3108, 35.0278], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(pickupMap);
            pickupMap.on('click', (e) => {
                const { lat, lng } = e.latlng;
                if (pickupMarker) { pickupMarker.setLatLng([lat, lng]); }
                else {
                    pickupMarker = L.marker([lat, lng], { draggable: true }).addTo(pickupMap);
                    pickupMarker.on('dragend', (ev) => {
                        const p = ev.target.getLatLng();
                        userLocation = { lat: p.lat, lng: p.lng };
                        updateLocationDisplay(p.lat, p.lng);
                    });
                }
                userLocation = { lat, lng };
                updateLocationDisplay(lat, lng);
            });
        }
    }, 300);
}

function updateLocationDisplay(lat, lng) {
    document.getElementById('locationDisplay').style.display = 'flex';
    document.getElementById('locationText').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

document.getElementById('requestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!userLocation) { showNotification('خطأ', 'الرجاء تحديد موقعك على الخريطة'); return; }

    const phoneRaw = document.getElementById('customerPhone').value.trim();
    if (!/^[0-9]{9,10}$/.test(phoneRaw)) {
        showNotification('خطأ', 'الرجاء إدخال رقم هاتف صحيح');
        return;
    }
    const phone = phoneRaw.startsWith('0') ? phoneRaw : '0' + phoneRaw;
    const locationDescription = document.getElementById('locationDescription').value.trim();
    const destination = document.getElementById('destination').value.trim();
    const details = document.getElementById('requestDetails').value.trim();
    const savedLocation = { ...userLocation };

    showLoading();
    try {
        const requestId = `request_${Date.now()}`;
        await database.ref(`requests/${requestId}`).set({
            id: requestId, location: savedLocation,
            locationDescription: locationDescription || '',
            destination, phone, details, status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            createdAt: new Date().toISOString(), notifiedNearby: false
        });

        closeModal('requestModal');
        document.getElementById('requestForm').reset();
        document.getElementById('locationDisplay').style.display = 'none';
        if (pickupMarker) { pickupMap.removeLayer(pickupMarker); pickupMarker = null; }
        userLocation = null;

        showNotification('تم ✅', 'تم إرسال طلبك! جاري البحث عن أقرب تكسي...');
        startExpandingCircleSearch(requestId, savedLocation);
        listenToMyRequest(requestId, phone);
    } catch (err) { showNotification('خطأ', 'حدث خطأ أثناء إرسال الطلب'); }
    finally { hideLoading(); }
});

// ========================================
// نظام الدوائر المتوسعة
// ========================================
function startExpandingCircleSearch(requestId, location) {
    let radius = 100;
    const maxRadius = 50000;
    const circle = L.circle([location.lat, location.lng], {
        color: '#FF6B35', fillColor: '#FF6B35', fillOpacity: 0.15, radius, weight: 2
    }).addTo(map);
    expandingCircles[requestId] = circle;

    async function searchForDriver() {
        try {
            const snap = await database.ref('drivers').orderByChild('online').equalTo(true).once('value');
            const drivers = snap.val() || {};
            let nearest = null, minDist = Infinity;
            for (const [driverId, driver] of Object.entries(drivers)) {
                if (driver.isBooked || !driver.location) continue;
                const dist = calculateDistance(location.lat, location.lng, driver.location.lat, driver.location.lng) * 1000;
                if (dist <= radius && dist < minDist) { nearest = { driverId, driver, dist }; minDist = dist; }
            }
            if (nearest) {
                if (circleIntervals[requestId]) { clearInterval(circleIntervals[requestId]); delete circleIntervals[requestId]; }
                await database.ref(`requests/${requestId}`).update({ targetDriver: nearest.driverId, sentToDriverAt: Date.now() });
                setTimeout(() => { if (expandingCircles[requestId]) { map.removeLayer(expandingCircles[requestId]); delete expandingCircles[requestId]; } }, 1000);
                return true;
            }
            return false;
        } catch (e) { return false; }
    }

    circleIntervals[requestId] = setInterval(async () => {
        radius += 500; circle.setRadius(radius);
        const found = await searchForDriver();
        if (found || radius >= maxRadius) {
            clearInterval(circleIntervals[requestId]); delete circleIntervals[requestId];
            if (!found) {
                showNotification('تنبيه', 'لم يتم العثور على سائق قريب. الطلب متاح لجميع السائقين.');
                if (expandingCircles[requestId]) { map.removeLayer(expandingCircles[requestId]); delete expandingCircles[requestId]; }
            }
        }
    }, 1000);
    searchForDriver();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ========================================
// Listen to Requests
// ========================================
function listenToRequests() {
    database.ref('requests').orderByChild('status').equalTo('pending').on('value', async (snap) => {
        const requests = snap.val() || {};
        Object.keys(requestMarkers).forEach(id => {
            if (!requests[id]) { map.removeLayer(requestMarkers[id]); delete requestMarkers[id]; }
        });

        let count = 0;
        for (const [requestId, request] of Object.entries(requests)) {
            if (request.status !== 'pending') continue;
            count++;
            if (!requestMarkers[requestId]) {
                // إظهار الطلب على الخريطة مباشرة للسائقين
                const marker = L.marker([request.location.lat, request.location.lng], { icon: requestIcon }).addTo(map);
                marker.on('click', () => showRequestPopup(request, marker));
                requestMarkers[requestId] = marker;

                if (currentUser.isDriver) {
                    showNotification('🚨 طلب جديد!', `${request.phone} - ${request.destination}`, 8000);
                    try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGmz6eeXSwgNUKXi8LZkHAU5kdXzzHoqBSJ2xe/ekEEKFF+z6eirVhMJRp/g8b5uIQUrfs7y24o2Bw==').play().catch(()=>{}); } catch(e){}
                }
            }
        }

        const badge = document.getElementById('requestCount');
        if (count > 0 && currentUser.isDriver) { badge.textContent = count; badge.style.display = 'inline-block'; }
        else { badge.style.display = 'none'; }
    });
}

function listenToMyRequest(requestId, customerPhone) {
    localStorage.setItem('activeRequestId', requestId);
    localStorage.setItem('activeRequestPhone', customerPhone);

    database.ref(`requests/${requestId}`).on('value', (snap) => {
        const request = snap.val();
        if (!request) { localStorage.removeItem('activeRequestId'); localStorage.removeItem('activeRequestPhone'); return; }

        if (request.status === 'pending') { showCancelRequestOption(requestId); }

        if (request.status === 'accepted' && request.driverPhone) {
            showNotification('🎉 تم قبول طلبك!', `السائق ${request.driverPhone} في الطريق إليك`, 10000);
            trackDriverForCustomer(requestId, request.acceptedBy);
            showCancelRequestOption(requestId);
        } else if (request.status === 'arrived') {
            showNotification('📍 السائق وصل!', 'السائق في موقعك الآن', 8000);
            stopTrackingDriver();
        } else if (request.status === 'completed' && !request.rated) {
            showRatingModal(requestId, request.driverPhone, request.acceptedBy);
            stopTrackingDriver();
            localStorage.removeItem('activeRequestId'); localStorage.removeItem('activeRequestPhone');
            database.ref(`requests/${requestId}`).off();
        } else if (request.status === 'cancelled_by_customer') {
            showNotification('تم الإلغاء', 'تم إلغاء طلبك', 5000);
            stopTrackingDriver();
            localStorage.removeItem('activeRequestId'); localStorage.removeItem('activeRequestPhone');
            database.ref(`requests/${requestId}`).off();
            const btn = document.getElementById('cancelRequestBtn');
            if (btn) btn.remove();
        }

        if (request.messages && request.messages.length > 0) {
            const last = request.messages[request.messages.length - 1];
            if (last.from === 'driver') showNotification('رسالة من السائق', last.text, 7000);
        }
    });
}

function showCancelRequestOption(requestId) {
    if (document.getElementById('cancelRequestBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'cancelRequestBtn';
    btn.className = 'btn btn-danger';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1500;animation:pulse 2s infinite;';
    btn.innerHTML = '<span>❌</span><span>إلغاء الطلب</span>';
    btn.onclick = () => { if (confirm('هل أنت متأكد من إلغاء الطلب؟')) cancelRequestByCustomer(requestId); };
    document.body.appendChild(btn);
}

async function cancelRequestByCustomer(requestId) {
    showLoading();
    try {
        const snap = await database.ref(`requests/${requestId}`).once('value');
        const request = snap.val();
        if (!request) { showNotification('خطأ', 'الطلب غير موجود'); hideLoading(); return; }
        await database.ref(`requests/${requestId}`).update({ status: 'cancelled_by_customer', cancelledAt: Date.now() });
        if (request.acceptedBy) { stopTrackingDriver(); }
        const btn = document.getElementById('cancelRequestBtn');
        if (btn) btn.remove();
        showNotification('تم', 'تم إلغاء الطلب');
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
}

// Rating Modal
function showRatingModal(requestId, driverPhone, driverId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">تقييم الرحلة</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="rating-container">
                <p style="text-align:center;margin-bottom:15px;font-size:16px"><strong>تقييم السائق ${driverPhone || ''}</strong></p>
                <div class="rating-stars" id="driverRatingStars">
                    ${[1,2,3,4,5].map(i=>`<span class="star" data-rating="${i}">⭐</span>`).join('')}
                </div>
                <p style="text-align:center;margin:15px 0;font-size:16px"><strong>تقييم الموقع</strong></p>
                <div class="rating-stars" id="siteRatingStars">
                    ${[1,2,3,4,5].map(i=>`<span class="star" data-rating="${i}">⭐</span>`).join('')}
                </div>
                <textarea class="rating-comment" id="ratingComment" placeholder="تعليق (اختياري)..."></textarea>
                <button class="btn btn-primary" style="width:100%;margin-top:15px" onclick="submitRating('${requestId}','${driverId}')">إرسال التقييم</button>
                <button class="btn btn-secondary" style="width:100%;margin-top:10px" onclick="this.closest('.modal').remove()">تخطي</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    let dr = 0, sr = 0;
    modal.querySelectorAll('#driverRatingStars .star').forEach(s => s.addEventListener('click', function() {
        dr = +this.dataset.rating;
        modal.querySelectorAll('#driverRatingStars .star').forEach((x,i) => x.classList.toggle('active', i < dr));
    }));
    modal.querySelectorAll('#siteRatingStars .star').forEach(s => s.addEventListener('click', function() {
        sr = +this.dataset.rating;
        modal.querySelectorAll('#siteRatingStars .star').forEach((x,i) => x.classList.toggle('active', i < sr));
    }));
    window.currentDriverRating = () => dr;
    window.currentSiteRating = () => sr;
}

window.submitRating = async function(requestId, driverId) {
    const dr = window.currentDriverRating ? window.currentDriverRating() : 0;
    const sr = window.currentSiteRating ? window.currentSiteRating() : 0;
    if (!dr || !sr) { showNotification('تنبيه', 'الرجاء اختيار التقييمات'); return; }
    const comment = document.getElementById('ratingComment')?.value || '';
    showLoading();
    try {
        await database.ref(`ratings/rating_${Date.now()}`).set({ requestId, driverId, driverRating: dr, siteRating: sr, comment, timestamp: firebase.database.ServerValue.TIMESTAMP });
        await database.ref(`requests/${requestId}`).update({ rated: true, driverRating: dr, siteRating: sr });
        const ratSnap = await database.ref('ratings').orderByChild('driverId').equalTo(driverId).once('value');
        const rats = ratSnap.val();
        if (rats) {
            const vals = Object.values(rats).map(r => r.driverRating);
            await database.ref(`drivers/${driverId}`).update({ averageRating: +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1), totalRatings: vals.length });
        }
        document.querySelector('.modal.active').remove();
        showNotification('شكراً', 'تم إرسال تقييمك!');
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
};

// Request Popup
function showRequestPopup(request, marker) {
    L.popup({ minWidth: 280, className: 'request-popup' })
        .setLatLng(marker.getLatLng())
        .setContent(createRequestPopupContent(request))
        .openOn(map);
}

function createRequestPopupContent(request) {
    const canManage = currentUser.isDriver;
    const createdDate = new Date(request.createdAt).toLocaleString('ar-EG');
    const msgs = request.messages && request.messages.length ? `
        <div class="chat-messages">${request.messages.slice(-3).map(m=>`
            <div class="chat-message"><div class="message-text">${m.text}</div><div class="message-time">${new Date(m.timestamp).toLocaleTimeString('ar')}</div></div>`).join('')}</div>` : '';

    return `<div class="request-popup">
        <h3>📍 تفاصيل الطلب</h3>
        ${canManage && request.locationDescription ? `<div class="request-info"><div class="request-label">موقع العميل:</div><div class="request-value">${request.locationDescription}</div></div>` : ''}
        <div class="request-info"><div class="request-label">الوجهة:</div><div class="request-value">${request.destination}</div></div>
        ${canManage ? `<div class="request-info"><div class="request-label">رقم الهاتف:</div><div class="request-value"><a href="tel:${request.phone}" style="color:var(--primary);font-weight:bold">${request.phone}</a></div></div>` : ''}
        ${request.details && canManage ? `<div class="request-info"><div class="request-label">تفاصيل:</div><div class="request-value">${request.details}</div></div>` : ''}
        <div class="request-info"><div class="request-label">الوقت:</div><div class="request-value">${createdDate}</div></div>
        <span class="status-badge status-${request.status}">${{pending:'في الانتظار',accepted:'تم القبول',arrived:'وصل السائق',completed:'مكتملة'}[request.status]||request.status}</span>
        ${msgs}
        ${canManage && request.status==='pending' ? `<div class="request-actions">
            <button class="btn btn-accept" onclick="acceptRequest('${request.id}','${request.phone}')">✓ قبول</button>
            <button class="btn btn-reject" onclick="removeRequest('${request.id}')">× إزالة</button>
        </div>` : ''}
        ${canManage && request.status==='accepted' && request.acceptedBy===currentUser.driverId ? `
        <div class="quick-messages">
            <button class="quick-msg-btn" onclick="sendQuickMessage('${request.id}','أنا في الطريق إليك')">📍 في الطريق</button>
            <button class="quick-msg-btn" onclick="sendQuickMessage('${request.id}','سأصل خلال 5 دقائق')">⏱️ 5 دقائق</button>
            <button class="quick-msg-btn" onclick="sendQuickMessage('${request.id}','أنا بالانتظار')">⏸️ بالانتظار</button>
        </div>
        <div class="request-actions"><button class="btn btn-arrived" onclick="markAsArrived('${request.id}')">📍 وصلت للموقع</button></div>` : ''}
        ${canManage && request.status==='arrived' && request.acceptedBy===currentUser.driverId ? `
        <div class="request-actions"><button class="btn btn-complete" onclick="completeTrip('${request.id}')">✓ إنهاء الرحلة</button></div>` : ''}
    </div>`;
}

window.sendQuickMessage = async function(requestId, message) {
    try {
        const ref = database.ref(`requests/${requestId}/messages`);
        const snap = await ref.once('value');
        const msgs = snap.val() || [];
        msgs.push({ text: message, timestamp: Date.now(), from: 'driver' });
        await ref.set(msgs);
        showNotification('تم', 'تم إرسال الرسالة');
        map.closePopup();
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
};

window.acceptRequest = async function(requestId, customerPhone) {
    if (!currentUser.isDriver) { showNotification('خطأ', 'يجب الدخول كسائق'); return; }
    if (currentUser.isBooked) { showNotification('تنبيه', 'أنت محجوز حالياً'); return; }
    showLoading();
    try {
        const result = await database.ref(`requests/${requestId}`).transaction((cur) => {
            if (!cur || cur.status !== 'pending') return;
            cur.status = 'accepted';
            cur.acceptedBy = currentUser.driverId;
            cur.driverPhone = currentUser.phone;
            cur.acceptedAt = Date.now();
            return cur;
        });
        if (!result.committed) { showNotification('تنبيه', 'تم قبول هذا الطلب من سائق آخر'); hideLoading(); return; }
        const reqData = result.snapshot.val();
        currentUser.isBooked = true;
        await database.ref(`drivers/${currentUser.driverId}`).update({ isBooked: true, bookedAt: Date.now() });
        await database.ref(`trips/trip_${Date.now()}`).set({
            requestId, driverId: currentUser.driverId, driverPhone: currentUser.phone,
            customerPhone, destination: reqData.destination, status: 'on_the_way', createdAt: Date.now()
        });
        map.closePopup();
        showNotification('تم ✅', `تم قبول الطلب - ${customerPhone}`);
        showRemoveBookingButton();
        setTimeout(() => { if (confirm('هل تريد الاتصال بالعميل؟')) window.location.href = `tel:${customerPhone}`; }, 1000);
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
};

window.removeBooking = async function() {
    if (!currentUser.isBooked) return;
    if (!confirm('هل أنت متأكد من إشالة الحجز؟')) return;
    showLoading();
    try {
        currentUser.isBooked = false;
        await database.ref(`drivers/${currentUser.driverId}`).update({ isBooked: false, unbookedAt: Date.now() });
        showNotification('تم', '✅ تم إشالة الحجز');
        const btn = document.getElementById('removeBookingBtn');
        if (btn) btn.remove();
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
};

function showRemoveBookingButton() {
    const old = document.getElementById('removeBookingBtn');
    if (old) old.remove();
    const btn = document.createElement('button');
    btn.id = 'removeBookingBtn';
    btn.className = 'btn btn-danger';
    btn.style.cssText = 'position:fixed;bottom:30px;left:30px;z-index:2500;padding:18px 30px;font-size:18px;box-shadow:0 4px 20px rgba(255,71,87,0.5);animation:pulse 2s infinite';
    btn.innerHTML = '<span style="font-size:24px">🔓</span><span style="margin-right:10px">إشالة الحجز</span>';
    btn.onclick = () => window.removeBooking();
    document.body.appendChild(btn);
}

window.markAsArrived = async function(requestId) {
    showLoading();
    try {
        await database.ref(`requests/${requestId}`).update({ status: 'arrived', arrivedAt: firebase.database.ServerValue.TIMESTAMP });
        map.closePopup(); showNotification('تم', 'تم تأكيد وصولك');
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
};

window.completeTrip = async function(requestId) {
    if (!confirm('هل أنت متأكد من إنهاء الرحلة؟')) return;
    showLoading();
    try {
        await database.ref(`requests/${requestId}`).update({ status: 'completed', completedAt: firebase.database.ServerValue.TIMESTAMP });
        if (requestMarkers[requestId]) { map.removeLayer(requestMarkers[requestId]); delete requestMarkers[requestId]; }
        map.closePopup(); showNotification('تم', 'تم إنهاء الرحلة!');
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
};

window.removeRequest = async function(requestId) {
    if (!currentUser.isDriver || !confirm('هل أنت متأكد؟')) return;
    showLoading();
    try {
        await database.ref(`requests/${requestId}`).remove();
        map.closePopup(); showNotification('تم', 'تم إزالة الطلب');
    } catch (e) { showNotification('خطأ', 'حدث خطأ'); }
    finally { hideLoading(); }
};

document.getElementById('mailBtn').addEventListener('click', () => {
    const markers = Object.values(requestMarkers);
    if (!markers.length) { showNotification('لا توجد طلبات', 'لا توجد طلبات في الانتظار'); return; }
    map.fitBounds(L.latLngBounds(markers.map(m => m.getLatLng())), { padding: [50,50] });
    showNotification('الطلبات', `لديك ${markers.length} طلب`);
});

// استعادة الطلب النشط
(function() {
    const activeId = localStorage.getItem('activeRequestId');
    const activePhone = localStorage.getItem('activeRequestPhone');
    if (activeId && activePhone) {
        setTimeout(() => listenToMyRequest(activeId, activePhone), 2000);
    }
})();

listenToRequests();

window.addEventListener('beforeunload', () => {
    if (currentUser.isDriver) {
        database.ref(`drivers/${currentUser.driverId}`).update({ lastSeen: firebase.database.ServerValue.TIMESTAMP });
    }
});

} // end initializeApp
