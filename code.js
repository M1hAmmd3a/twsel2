// Firebase Configuration
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
        // Phone Gate - التحقق من رقم الهاتف
        // ========================================
        let userPhone = localStorage.getItem('userPhone');
        
        if (userPhone) {
            document.getElementById('phoneGateModal').classList.remove('active');
        }
        
        document.getElementById('phoneGateForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('gatePhone').value.trim();
            
            if (!/^[0-9]{9,10}$/.test(phone)) {
                showNotification('خطأ', 'الرجاء إدخال رقم هاتف صحيح');
                return;
            }
            
            const fullPhone = phone.startsWith('0') ? phone : '0' + phone;
            userPhone = fullPhone;
            localStorage.setItem('userPhone', fullPhone);
            
            document.getElementById('phoneGateModal').classList.remove('active');
            document.getElementById('phoneNumber').value = fullPhone;
            
            showNotification('مرحباً', 'تم تسجيل دخولك بنجاح! 🎉');
        });
        
        if (userPhone) {
            document.getElementById('phoneNumber').value = userPhone;
        }
        
        // ========================================
        // WhatsApp Integration - التواصل مع المكتب
        // ========================================
        const WHATSAPP_NUMBER = '970599123456'; // ضع رقم المكتب هنا
        
        document.getElementById('whatsappBtn').addEventListener('click', () => {
            const message = encodeURIComponent('مرحباً، أود الاستفسار عن خدمة التكسي');
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
        });
        
        // ========================================
        // GPS محسّن - يعمل على جميع الهواتف - تحديث كل 6 ثواني
        // ========================================
        function startDriverLocationTracking() {
            if (!currentUser.isDriver || !currentUser.driverId) return;
            
            if (!('geolocation' in navigator)) {
                showNotification('خطأ', 'متصفحك لا يدعم تحديد الموقع GPS');
                return;
            }
            
            const gpsOptions = {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
            };
            
            // دالة لتحديث الموقع
            function updateLocation() {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        const accuracy = position.coords.accuracy;
                        
                        console.log(`GPS: تحديث الموقع - ${lat.toFixed(6)}, ${lng.toFixed(6)} (دقة: ${accuracy.toFixed(0)}m)`);
                        
                        if (currentUser.driverId) {
                            database.ref(`drivers/${currentUser.driverId}/location`).set({
                                lat: lat,
                                lng: lng,
                                accuracy: accuracy,
                                timestamp: Date.now()
                            }).then(() => {
                                console.log('GPS: تم حفظ الموقع ✅');
                            }).catch((error) => {
                                console.error('GPS: خطأ في حفظ الموقع:', error);
                            });
                        }
                    },
                    (error) => {
                        console.error('GPS Error:', error);
                        let errorMessage = 'خطأ في GPS';
                        
                        switch(error.code) {
                            case error.PERMISSION_DENIED:
                                errorMessage = 'تم رفض إذن الموقع';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMessage = 'لا يمكن تحديد الموقع';
                                break;
                            case error.TIMEOUT:
                                errorMessage = 'انتهت مهلة تحديد الموقع';
                                break;
                        }
                        console.error('GPS:', errorMessage);
                    },
                    gpsOptions
                );
            }
            
            // محاولة الحصول على الموقع أولاً
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('GPS: تم الحصول على الإذن ✅');
                    showNotification('GPS نشط', 'تم تفعيل تتبع موقعك (تحديث كل 6 ثواني) 📍', 3000);
                    
                    // تحديث الموقع أول مرة
                    updateLocation();
                    
                    // بدء التحديث كل 6 ثواني
                    gpsUpdateInterval = setInterval(() => {
                        if (currentUser.isDriver && currentUser.driverId) {
                            updateLocation();
                        } else {
                            // إيقاف التحديث إذا لم يعد السائق نشطاً
                            if (gpsUpdateInterval) {
                                clearInterval(gpsUpdateInterval);
                                gpsUpdateInterval = null;
                            }
                        }
                    }, 6000); // 6 ثواني
                },
                (error) => {
                    console.error('GPS Initial Error:', error);
                    showNotification('تنبيه GPS', 'الرجاء السماح بالوصول للموقع في إعدادات المتصفح', 8000);
                },
                gpsOptions
            );
        }
        
        function stopDriverLocationTracking() {
            // إيقاف التحديث المجدول
            if (gpsUpdateInterval) {
                clearInterval(gpsUpdateInterval);
                gpsUpdateInterval = null;
                console.log('GPS: تم إيقاف التحديث الدوري');
            }
            
            // إيقاف الـ watcher القديم إذا كان موجوداً
            if (driverLocationWatcher !== null) {
                navigator.geolocation.clearWatch(driverLocationWatcher);
                driverLocationWatcher = null;
            }
            
            // حذف الموقع من Firebase
            if (currentUser.driverId) {
                database.ref(`drivers/${currentUser.driverId}/location`).remove()
                    .then(() => {
                        console.log('GPS: تم حذف الموقع من Firebase ✅');
                    })
                    .catch((error) => {
                        console.error('GPS: خطأ في حذف الموقع:', error);
                    });
            }
            
            showNotification('GPS', 'تم إيقاف تتبع الموقع', 3000);
        }
        
        // ========================================
        // تتبع السائق للزبون - محسّن
        // ========================================
        // ========================================
        // تتبع موقع السائق للزبون - تحديث كل 6 ثواني
        // ========================================
        function trackDriverForCustomer(requestId, driverId) {
            console.log(`تتبع السائق: ${driverId}`);
            activeRequestTracking = requestId;
            
            // دالة لتحديث موقع السائق
            function updateDriverLocation() {
                database.ref(`drivers/${driverId}/location`).once('value', (snapshot) => {
                    const location = snapshot.val();
                    
                    if (location && activeRequestTracking === requestId) {
                        const lat = location.lat;
                        const lng = location.lng;
                        const timestamp = location.timestamp;
                        
                        // التحقق من أن الموقع حديث
                        const now = Date.now();
                        const age = now - timestamp;
                        
                        console.log(`موقع السائق: ${lat.toFixed(6)}, ${lng.toFixed(6)} (عمر: ${Math.round(age/1000)}s)`);
                        
                        if (driverLocationMarker) {
                            driverLocationMarker.setLatLng([lat, lng]);
                        } else {
                            const driverIcon = L.divIcon({
                                className: 'driver-location-icon',
                                html: '<div style="font-size: 50px; animation: pulse 2s infinite; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));">🚕</div>',
                                iconSize: [60, 60],
                                iconAnchor: [30, 30]
                            });
                            
                            driverLocationMarker = L.marker([lat, lng], { icon: driverIcon })
                                .addTo(map)
                                .bindPopup('<b>🚕 السائق في الطريق إليك</b><br>📍 تحديث مباشر كل 6 ثواني');
                            
                            driverLocationMarker.openPopup();
                        }
                        
                        if (userLocation) {
                            const bounds = L.latLngBounds([
                                [userLocation.lat, userLocation.lng],
                                [lat, lng]
                            ]);
                            map.fitBounds(bounds, { padding: [100, 100] });
                        } else {
                            map.setView([lat, lng], 15);
                        }
                    }
                });
            }
            
            // التحديث الأول فوراً
            updateDriverLocation();
            
            // ثم كل 6 ثواني
            customerTrackingInterval = setInterval(() => {
                if (activeRequestTracking === requestId) {
                    updateDriverLocation();
                } else {
                    if (customerTrackingInterval) {
                        clearInterval(customerTrackingInterval);
                        customerTrackingInterval = null;
                    }
                }
            }, 6000); // 6 ثواني
        }
        
        function stopTrackingDriver(driverId) {
            console.log(`إيقاف تتبع السائق: ${driverId}`);
            activeRequestTracking = null;
            
            // إيقاف التحديث الدوري
            if (customerTrackingInterval) {
                clearInterval(customerTrackingInterval);
                customerTrackingInterval = null;
            }
            
            // حذف العلامة من الخريطة
            if (driverLocationMarker) {
                map.removeLayer(driverLocationMarker);
                driverLocationMarker = null;
                console.log('تم حذف علامة السائق من الخريطة');
            }
        }
        
        // ========================================
        // Password Hashing
        // ========================================
        function simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            const salt = 'tulkarm_taxi_2026_secret';
            const saltedStr = str + salt;
            let finalHash = 0;
            for (let i = 0; i < saltedStr.length; i++) {
                const char = saltedStr.charCodeAt(i);
                finalHash = ((finalHash << 5) - finalHash) + char;
                finalHash = finalHash & finalHash;
            }
            return finalHash.toString(16);
        }
        
        const AUTHORIZED_DRIVERS = [
            {
                name: 'محمد عبد الله حسين ابو قصيدو',
                passwordHash: '709064e3'
            }
        ];
        
        const ADMIN_PASSWORD_HASH = '24a4ccff';
        
        function verifyDriverLogin(name, password) {
            const driver = AUTHORIZED_DRIVERS.find(d => d.name === name);
            if (!driver) {
                return { success: false, error: 'الاسم غير موجود في قائمة السائقين المصرح لهم' };
            }
            
            const inputHash = simpleHash(password);
            if (inputHash !== driver.passwordHash) {
                return { success: false, error: 'كلمة السر غير صحيحة' };
            }
            
            return { success: true };
        }
        
        function verifyAdminPassword(password) {
            const inputHash = simpleHash(password);
            return inputHash === ADMIN_PASSWORD_HASH;
        }
        
        window.calculatePasswordHash = function(password) {
            const hash = simpleHash(password);
            console.log(`Password: ${password}\nHash: ${hash}`);
            return hash;
        };
        
        // ========================================
        // Initialize Map
        // ========================================
        let map;
        try {
            map = L.map('map').setView([32.3108, 35.0278], 14);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
        } catch (error) {
            console.error('Error initializing map:', error);
        }
        
        const requestIcon = L.divIcon({
            className: 'custom-request-icon',
            html: '<div style="font-size: 36px; animation: bounce 1s infinite;">📍</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 40]
        });
        
        const style = document.createElement('style');
        style.textContent = `@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`;
        document.head.appendChild(style);
        
        // Global State
        let currentUser = {
            isDriver: false,
            driverId: null,
            name: null,
            phone: null,
            showPhone: true,
            isBooked: false // حالة الحجز
        };
        let requestMarkers = {};
        let userLocation = null;
        let expandingCircles = {}; // دوائر التوسع لكل طلب
        let circleIntervals = {}; // intervals للدوائر
        let pickupMap = null;
        let pickupMarker = null;
        let adminPickupMap = null;
        let adminPickupMarker = null;
        let adminUserLocation = null;
        let driverLocationMarker = null;
        let driverLocationWatcher = null;
        let gpsUpdateInterval = null; // للتحديث كل 6 ثواني
        let customerTrackingInterval = null; // لتتبع السائق كل 6 ثواني
        let activeRequestTracking = null;
        let nearbyRequestTimeout = {};
        
        function restoreDriverState() {
            const savedDriver = localStorage.getItem('currentDriver');
            if (savedDriver) {
                try {
                    currentUser = JSON.parse(savedDriver);
                    if (currentUser.isDriver) {
                        updateDriverUI();
                        listenToRequests();
                        
                        database.ref(`drivers/${currentUser.driverId}/online`).once('value', (snapshot) => {
                            if (!snapshot.val()) {
                                logoutDriver();
                            }
                        });
                    }
                } catch (e) {
                    localStorage.removeItem('currentDriver');
                }
            }
        }
        
        restoreDriverState();
        
        // Modal Functions
        window.openModal = function(modalId) {
            document.getElementById(modalId).classList.add('active');
        };
        
        window.closeModal = function(modalId) {
            document.getElementById(modalId).classList.remove('active');
            
            if (modalId === 'adminModal') {
                document.getElementById('adminForm').style.display = 'block';
                document.getElementById('adminPanel').style.display = 'none';
                document.getElementById('adminForm').reset();
            }
            
            if (modalId === 'requestModal') {
                document.getElementById('requestForm').reset();
                document.getElementById('locationDisplay').style.display = 'none';
                userLocation = null;
                if (pickupMarker && pickupMap) {
                    pickupMap.removeLayer(pickupMarker);
                    pickupMarker = null;
                }
            }
            
            if (modalId === 'driverModal') {
                document.getElementById('driverForm').reset();
            }
        };
        
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) {
                closeModal(e.target.id);
            }
        });
        
        function showNotification(title, message, duration = 5000) {
            const notification = document.getElementById('notification');
            document.getElementById('notificationTitle').textContent = title;
            document.getElementById('notificationBody').textContent = message;
            notification.classList.add('active');
            
            setTimeout(() => {
                notification.classList.remove('active');
            }, duration);
        }
        
        function showLoading() {
            document.getElementById('loading').classList.add('active');
        }
        
        function hideLoading() {
            document.getElementById('loading').classList.remove('active');
        }
        
        // ========================================
        // Driver Login
        // ========================================
        document.getElementById('driverBtn').addEventListener('click', () => {
            if (currentUser.isDriver) {
                logoutDriver();
            } else {
                openModal('driverModal');
            }
        });
        
        document.getElementById('driverForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('driverName').value.trim();
            const phone = document.getElementById('driverPhone').value.trim();
            const password = document.getElementById('driverPassword').value;
            const showPhone = document.getElementById('showPhoneToCustomer').checked;
            
            if (!/^05\d{8}$/.test(phone)) {
                showNotification('خطأ', 'رقم الهاتف غير صحيح');
                return;
            }
            
            const verification = verifyDriverLogin(name, password);
            
            if (!verification.success) {
                showNotification('خطأ', verification.error);
                return;
            }
            
            showLoading();
            
            try {
                const driverId = `driver_${Date.now()}`;
                currentUser = {
                    isDriver: true,
                    driverId: driverId,
                    name: name,
                    phone: phone,
                    showPhone: showPhone
                };
                
                localStorage.setItem('currentDriver', JSON.stringify(currentUser));
                
                await database.ref(`drivers/${driverId}`).set({
                    name: name,
                    phone: phone,
                    showPhone: showPhone,
                    online: true,
                    lastSeen: Date.now(),
                    joinedAt: new Date().toISOString()
                });
                
                closeModal('driverModal');
                document.getElementById('driverForm').reset();
                
                updateDriverUI();
                listenToRequests();
                startDriverLocationTracking();
                
                showNotification('مرحباً', `تم تسجيل دخولك كسائق: ${name}`);
                
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ أثناء تسجيل الدخول');
            } finally {
                hideLoading();
            }
        });
        
        function updateDriverUI() {
            const driverBtn = document.getElementById('driverBtn');
            
            if (currentUser.isDriver) {
                driverBtn.innerHTML = '<span>🚪</span><span>تسجيل خروج</span>';
                driverBtn.className = 'btn btn-logout';
                document.getElementById('mailBtn').style.display = 'flex';
                document.getElementById('onlineIndicator').style.display = 'inline-block';
            } else {
                driverBtn.innerHTML = '<span>👨‍💼</span><span>صاحب العمل</span>';
                driverBtn.className = 'btn btn-secondary';
                document.getElementById('mailBtn').style.display = 'none';
                document.getElementById('onlineIndicator').style.display = 'none';
            }
        }
        
        // Toggle Panels
        document.getElementById('togglePanelBtn').addEventListener('click', () => {
            document.getElementById('driversPanel').classList.toggle('active');
        });
        
        document.getElementById('closePanelBtn').addEventListener('click', () => {
            document.getElementById('driversPanel').classList.remove('active');
        });
        
        // ========================================
        // Admin Panel
        // ========================================
        document.getElementById('adminBtn').addEventListener('click', () => {
            openModal('adminModal');
        });
        
        document.getElementById('adminForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('adminPassword').value;
            
            if (!verifyAdminPassword(password)) {
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
                const activeDriversSnapshot = await database.ref('drivers')
                    .orderByChild('online')
                    .equalTo(true)
                    .once('value');
                document.getElementById('activeDriversCount').textContent = activeDriversSnapshot.numChildren();
                
                const pendingRequestsSnapshot = await database.ref('requests')
                    .orderByChild('status')
                    .equalTo('pending')
                    .once('value');
                document.getElementById('pendingRequestsCount').textContent = pendingRequestsSnapshot.numChildren();
                
                const completedTripsSnapshot = await database.ref('trips')
                    .orderByChild('status')
                    .equalTo('completed')
                    .once('value');
                document.getElementById('completedTripsCount').textContent = completedTripsSnapshot.numChildren();
                
                // تهيئة خريطة الإدارة - بعد التأكد من ظهور اللوحة
                setTimeout(() => {
                    const mapElement = document.getElementById('adminPickupMap');
                    if (mapElement) {
                        console.log('✅ عنصر الخريطة موجود');
                        
                        // التأكد من أن اللوحة ظاهرة
                        const adminPanel = document.getElementById('adminPanel');
                        if (adminPanel && adminPanel.style.display !== 'none') {
                            console.log('✅ لوحة الإدارة ظاهرة');
                            initAdminPickupMap();
                            
                            // إعادة حساب حجم الخريطة بعد التهيئة
                            setTimeout(() => {
                                if (adminPickupMap) {
                                    adminPickupMap.invalidateSize();
                                    console.log('✅ تم تحديث حجم الخريطة');
                                }
                            }, 300);
                        } else {
                            console.error('❌ لوحة الإدارة غير ظاهرة!');
                        }
                    } else {
                        console.error('❌ عنصر الخريطة غير موجود!');
                    }
                }, 1500);
            } catch (error) {
                console.error('Error updating admin stats:', error);
            }
        }
        
        // تهيئة خريطة إضافة الطلب من الإدارة
        function initAdminPickupMap() {
            if (!adminPickupMap) {
                adminPickupMap = L.map('adminPickupMap').setView([32.3108, 35.0278], 13);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(adminPickupMap);
                
                adminPickupMap.on('click', (e) => {
                    const lat = e.latlng.lat;
                    const lng = e.latlng.lng;
                    
                    if (adminPickupMarker) {
                        adminPickupMarker.setLatLng([lat, lng]);
                    } else {
                        adminPickupMarker = L.marker([lat, lng], { draggable: true }).addTo(adminPickupMap);
                        
                        adminPickupMarker.on('dragend', (e) => {
                            const pos = e.target.getLatLng();
                            adminUserLocation = { lat: pos.lat, lng: pos.lng };
                            document.getElementById('adminLocationDisplay').style.display = 'flex';
                            document.getElementById('adminLocationText').textContent = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
                        });
                    }
                    
                    adminUserLocation = { lat, lng };
                    document.getElementById('adminLocationDisplay').style.display = 'flex';
                    document.getElementById('adminLocationText').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                });
            }
        }
        
        // دالة لإعادة تحميل خريطة الإدارة
        window.reloadAdminMap = function() {
            console.log('🔄 إعادة تحميل خريطة الإدارة...');
            
            // حذف الخريطة القديمة إن وجدت
            if (adminPickupMap) {
                adminPickupMap.remove();
                adminPickupMap = null;
                adminPickupMarker = null;
                console.log('✅ تم حذف الخريطة القديمة');
            }
            
            // إنشاء خريطة جديدة
            setTimeout(() => {
                initAdminPickupMap();
                
                // إعادة حساب الحجم
                setTimeout(() => {
                    if (adminPickupMap) {
                        adminPickupMap.invalidateSize();
                        console.log('✅ تم إنشاء خريطة جديدة');
                        showNotification('تم', 'تم إعادة تحميل الخريطة بنجاح');
                    }
                }, 300);
            }, 100);
        };
        
        async function loadAdminRequests() {
            const requestsList = document.getElementById('adminRequestsList');
            
            database.ref('requests').on('value', (snapshot) => {
                const requests = snapshot.val() || {};
                
                if (Object.keys(requests).length === 0) {
                    requestsList.innerHTML = '<p style="text-align: center; color: #999;">لا توجد طلبات</p>';
                    return;
                }
                
                requestsList.innerHTML = Object.entries(requests).map(([id, req]) => `
                    <div class="request-card">
                        <div class="request-card-header">
                            <strong>${req.phone}</strong>
                            <span class="status-badge status-${req.status}">${req.status}</span>
                        </div>
                        <div><strong>الوجهة:</strong> ${req.destination}</div>
                        <div><strong>السعر:</strong> ${req.price || 'غير محدد'} شيكل</div>
                        <div><strong>الوقت:</strong> ${new Date(req.createdAt).toLocaleString('ar')}</div>
                    </div>
                `).join('');
            });
        }
        
        // Admin Add Request
        document.getElementById('adminAddRequestForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!adminUserLocation) {
                showNotification('خطأ', 'الرجاء تحديد الموقع على الخريطة');
                return;
            }
            
            const phone = document.getElementById('adminReqPhone').value.trim();
            const destination = document.getElementById('adminReqDestination').value.trim();
            const location = document.getElementById('adminReqLocation').value.trim();
            
            showLoading();
            
            try {
                const requestId = `request_${Date.now()}`;
                
                await database.ref(`requests/${requestId}`).set({
                    id: requestId,
                    location: adminUserLocation,
                    locationDescription: location,
                    destination: destination,
                    phone: phone,
                    details: 'طلب من المكتب',
                    status: 'pending',
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    createdAt: new Date().toISOString(),
                    addedByAdmin: true,
                    notifiedNearby: false
                });
                
                document.getElementById('adminAddRequestForm').reset();
                document.getElementById('adminLocationDisplay').style.display = 'none';
                if (adminPickupMarker) {
                    adminPickupMap.removeLayer(adminPickupMarker);
                    adminPickupMarker = null;
                }
                adminUserLocation = null;
                
                showNotification('تم', 'تم إضافة الطلب بنجاح');
                updateAdminStats();
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ أثناء إضافة الطلب');
            } finally {
                hideLoading();
            }
        });
        
        document.getElementById('logoutAllBtn').addEventListener('click', async () => {
            if (!confirm('هل أنت متأكد من تسجيل خروج جميع السائقين؟')) return;
            
            showLoading();
            
            try {
                const driversSnapshot = await database.ref('drivers')
                    .orderByChild('online')
                    .equalTo(true)
                    .once('value');
                const drivers = driversSnapshot.val() || {};
                
                const updates = {};
                Object.keys(drivers).forEach(driverId => {
                    updates[`drivers/${driverId}/online`] = false;
                    updates[`drivers/${driverId}/lastSeen`] = Date.now();
                });
                
                await database.ref().update(updates);
                
                showNotification('تم', `تم تسجيل خروج ${Object.keys(drivers).length} سائق`);
                updateAdminStats();
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ');
            } finally {
                hideLoading();
            }
        });
        
        document.getElementById('refreshSystemBtn').addEventListener('click', () => {
            updateAdminStats();
            loadAdminRequests();
            showNotification('تم', 'تم تحديث البيانات');
        });
        
        async function logoutDriver() {
            if (!currentUser.isDriver) return;
            
            showLoading();
            
            try {
                stopDriverLocationTracking();
                
                await database.ref(`drivers/${currentUser.driverId}`).update({
                    online: false,
                    lastSeen: Date.now()
                });
                
                localStorage.removeItem('currentDriver');
                
                currentUser = {
                    isDriver: false,
                    driverId: null,
                    name: null,
                    phone: null,
                    showPhone: true
                };
                
                updateDriverUI();
                showNotification('تم', 'تم تسجيل الخروج بنجاح');
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ');
            } finally {
                hideLoading();
            }
        }
        
        // Listen to drivers
        database.ref('drivers')
            .orderByChild('online')
            .equalTo(true)
            .on('value', (snapshot) => {
            const drivers = snapshot.val() || {};
            const driversList = document.getElementById('driversList');
            
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            const onlineDrivers = Object.entries(drivers).filter(([id, driver]) => 
                driver.online && driver.lastSeen >= fiveMinutesAgo
            );
            
            if (onlineDrivers.length === 0) {
                driversList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">لا يوجد سائقون متصلون حالياً</p>';
            } else {
                driversList.innerHTML = onlineDrivers.map(([id, driver]) => {
                    const isCurrentDriver = id === currentUser.driverId;
                    const currentBadge = isCurrentDriver ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">أنت</span>' : '';
                    
                    return `
                        <div class="driver-card" style="${isCurrentDriver ? 'background: #e3f2fd; border: 2px solid var(--primary);' : ''}">
                            <div class="driver-avatar">🚕</div>
                            <div class="driver-info">
                                <div class="driver-name">${driver.name} ${currentBadge}</div>
                                <div class="driver-status">
                                    <span style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; display: inline-block;"></span>
                                    متاح الآن
                                </div>
                                ${driver.averageRating ? `<div class="driver-rating">⭐ ${driver.averageRating}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        });
        
        // ========================================
        // Request Taxi
        // ========================================
        document.getElementById('requestBtn').addEventListener('click', () => {
            if (!userPhone) {
                showNotification('تنبيه', 'يجب تسجيل الدخول برقم هاتف أولاً');
                return;
            }
            openModal('requestModal');
            initPickupMap();
        });
        
        function initPickupMap() {
            setTimeout(() => {
                if (!pickupMap) {
                    pickupMap = L.map('pickupMap').setView([32.3108, 35.0278], 13);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap'
                    }).addTo(pickupMap);
                    
                    pickupMap.on('click', (e) => {
                        const lat = e.latlng.lat;
                        const lng = e.latlng.lng;
                        
                        if (pickupMarker) {
                            pickupMarker.setLatLng([lat, lng]);
                        } else {
                            pickupMarker = L.marker([lat, lng], { draggable: true }).addTo(pickupMap);
                            
                            pickupMarker.on('dragend', (e) => {
                                const pos = e.target.getLatLng();
                                userLocation = { lat: pos.lat, lng: pos.lng };
                                updateLocationDisplay(pos.lat, pos.lng);
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
        
        // Submit Request
        document.getElementById('requestForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!userLocation) {
                showNotification('خطأ', 'الرجاء تحديد موقعك على الخريطة');
                return;
            }
            
            const locationDescription = document.getElementById('locationDescription').value.trim();
            const destination = document.getElementById('destination').value.trim();
            const phone = userPhone;
            const details = document.getElementById('requestDetails').value.trim();
            
            showLoading();
            
            try {
                const requestId = `request_${Date.now()}`;
                
                const requestData = {
                    id: requestId,
                    location: userLocation,
                    locationDescription: locationDescription || '',
                    destination: destination,
                    phone: phone,
                    details: details,
                    status: 'pending',
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    createdAt: new Date().toISOString(),
                    notifiedNearby: false
                };
                
                await database.ref(`requests/${requestId}`).set(requestData);
                
                closeModal('requestModal');
                document.getElementById('requestForm').reset();
                document.getElementById('locationDisplay').style.display = 'none';
                
                if (pickupMarker) {
                    pickupMap.removeLayer(pickupMarker);
                    pickupMarker = null;
                }
                userLocation = null;
                
                showNotification('تم', 'تم إرسال طلبك بنجاح! جاري البحث عن أقرب تكسي...');
                
                // بدء نظام الدوائر المتوسعة
                startExpandingCircleSearch(requestId, userLocation);
                
                listenToMyRequest(requestId, phone);
                
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ أثناء إرسال الطلب');
            } finally {
                hideLoading();
            }
        });
        
        // ========================================
        // نظام الدوائر المتوسعة للبحث عن أقرب تكسي
        // ========================================
        function startExpandingCircleSearch(requestId, location) {
            console.log(`🎯 بدء البحث بالدوائر المتوسعة للطلب: ${requestId}`);
            
            let radius = 100; // البداية من 100 متر
            const maxRadius = 50000; // الحد الأقصى 50 كم
            const radiusIncrement = 500; // زيادة 500 متر كل مرة
            
            // رسم الدائرة على الخريطة
            const circle = L.circle([location.lat, location.lng], {
                color: '#FF6B35',
                fillColor: '#FF6B35',
                fillOpacity: 0.15,
                radius: radius,
                weight: 2
            }).addTo(map);
            
            expandingCircles[requestId] = circle;
            
            // دالة للبحث عن سائق داخل الدائرة
            async function searchForDriver() {
                try {
                    const driversSnapshot = await database.ref('drivers')
                        .orderByChild('online')
                        .equalTo(true)
                        .once('value');
                    
                    const drivers = driversSnapshot.val() || {};
                    let nearestDriver = null;
                    let minDistance = Infinity;
                    
                    for (const [driverId, driver] of Object.entries(drivers)) {
                        // تخطي السائقين المحجوزين
                        if (driver.isBooked) {
                            console.log(`⏭️ تخطي السائق ${driver.name} (محجوز)`);
                            continue;
                        }
                        
                        if (driver.location) {
                            const distance = calculateDistance(
                                location.lat,
                                location.lng,
                                driver.location.lat,
                                driver.location.lng
                            ) * 1000; // تحويل لمتر
                            
                            if (distance <= radius && distance < minDistance) {
                                nearestDriver = { driverId, driver, distance };
                                minDistance = distance;
                            }
                        }
                    }
                    
                    if (nearestDriver) {
                        // وجدنا سائق!
                        console.log(`✅ وجدنا سائق! ${nearestDriver.driver.name} على بعد ${Math.round(nearestDriver.distance)}م`);
                        
                        // إيقاف التوسع
                        if (circleIntervals[requestId]) {
                            clearInterval(circleIntervals[requestId]);
                            delete circleIntervals[requestId];
                        }
                        
                        // إرسال الطلب للسائق
                        await sendRequestToDriver(requestId, nearestDriver.driverId, nearestDriver.driver);
                        
                        // حذف الدائرة بعد ثانية
                        setTimeout(() => {
                            if (expandingCircles[requestId]) {
                                map.removeLayer(expandingCircles[requestId]);
                                delete expandingCircles[requestId];
                            }
                        }, 1000);
                        
                        return true;
                    }
                    
                    return false;
                    
                } catch (error) {
                    console.error('خطأ في البحث عن سائق:', error);
                    return false;
                }
            }
            
            // التوسع التدريجي
            circleIntervals[requestId] = setInterval(async () => {
                radius += radiusIncrement;
                circle.setRadius(radius);
                
                console.log(`🔄 توسيع الدائرة: ${Math.round(radius)}م`);
                
                const found = await searchForDriver();
                
                if (found || radius >= maxRadius) {
                    clearInterval(circleIntervals[requestId]);
                    delete circleIntervals[requestId];
                    
                    if (!found) {
                        console.log('❌ لم يتم العثور على سائق متاح');
                        showNotification('تنبيه', 'لم يتم العثور على سائق قريب. الطلب متاح لجميع السائقين.');
                        
                        // حذف الدائرة
                        if (expandingCircles[requestId]) {
                            map.removeLayer(expandingCircles[requestId]);
                            delete expandingCircles[requestId];
                        }
                    }
                }
            }, 1000); // كل ثانية
            
            // البحث الأول فوراً
            searchForDriver();
        }
        
        // إرسال الطلب لسائق معين
        async function sendRequestToDriver(requestId, driverId, driver) {
            try {
                await database.ref(`requests/${requestId}`).update({
                    targetDriver: driverId,
                    targetDriverName: driver.name,
                    sentToDriverAt: Date.now()
                });
                
                // إرسال إشعار للسائق
                await database.ref(`notifications/${driverId}_${Date.now()}`).set({
                    type: 'new_request',
                    requestId: requestId,
                    message: `طلب جديد قريب منك!`,
                    timestamp: Date.now()
                });
                
                console.log(`📤 تم إرسال الطلب للسائق: ${driver.name}`);
                
            } catch (error) {
                console.error('خطأ في إرسال الطلب للسائق:', error);
            }
        }
        
        // ========================================
        // Listen to Requests - نظام ذكي للإشعارات
        // ========================================
        function calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }
        
        function listenToRequests() {
            database.ref('requests')
                .orderByChild('status')
                .equalTo('pending')
                .on('value', (snapshot) => {
                const requests = snapshot.val() || {};
                
                Object.keys(requestMarkers).forEach(requestId => {
                    if (!requests[requestId]) {
                        map.removeLayer(requestMarkers[requestId]);
                        delete requestMarkers[requestId];
                    }
                });
                
                let pendingCount = 0;
                
                Object.keys(requests).forEach(async (requestId) => {
                    const request = requests[requestId];
                    
                    if (request.status === 'pending') {
                        pendingCount++;
                        
                        // نظام الإشعارات الذكي
                        if (currentUser.isDriver && !request.notifiedNearby) {
                            const driverLocationRef = await database.ref(`drivers/${currentUser.driverId}/location`).once('value');
                            const driverLocation = driverLocationRef.val();
                            
                            if (driverLocation) {
                                const distance = calculateDistance(
                                    driverLocation.lat,
                                    driverLocation.lng,
                                    request.location.lat,
                                    request.location.lng
                                );
                                
                                // إذا كان السائق على بعد أقل من 3 كم
                                if (distance < 3) {
                                    showNotification(
                                        '🚨 طلب قريب منك!',
                                        `طلب جديد على بعد ${distance.toFixed(1)} كم - ${request.destination}`,
                                        10000
                                    );
                                    
                                    // صوت تنبيه
                                    try {
                                        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGmz6eeXSwgNUKXi8LZkHAU5kdXzzHoqBSJ2xe/ekEEKFF+z6eirVhMJRp/g8b5uIQUrfs7y24o2Bw==');
                                        audio.play().catch(() => {});
                                    } catch (e) {}
                                    
                                    await database.ref(`requests/${requestId}`).update({
                                        notifiedNearby: true
                                    });
                                }
                            }
                        }
                        
                        // بعد دقيقتين، إظهار الطلب لجميع السائقين
                        if (!nearbyRequestTimeout[requestId]) {
                            nearbyRequestTimeout[requestId] = setTimeout(async () => {
                                if (!requestMarkers[requestId]) {
                                    const marker = L.marker([request.location.lat, request.location.lng], { icon: requestIcon })
                                        .addTo(map);
                                    
                                    marker.on('click', () => {
                                        showRequestPopup(request, marker);
                                    });
                                    
                                    requestMarkers[requestId] = marker;
                                    
                                    if (currentUser.isDriver) {
                                        showNotification('طلب جديد', `طلب من ${request.phone} - ${request.destination}`);
                                    }
                                }
                            }, 120000); // دقيقتين
                        }
                    }
                });
                
                const countBadge = document.getElementById('requestCount');
                if (pendingCount > 0 && currentUser.isDriver) {
                    countBadge.textContent = pendingCount;
                    countBadge.style.display = 'inline-block';
                } else {
                    countBadge.style.display = 'none';
                }
            });
        }
        
        function listenToMyRequest(requestId, customerPhone) {
            database.ref(`requests/${requestId}`).on('value', (snapshot) => {
                const request = snapshot.val();
                
                if (!request) return;
                
                if (request.status === 'pending') {
                    // عرض زر إلغاء الطلب
                    showCancelRequestOption(requestId);
                }
                
                if (request.status === 'accepted' && request.driverName) {
                    const phoneDisplay = request.showDriverPhone ? ` - ${request.driverPhone}` : '';
                    showNotification(
                        '🎉 تم قبول طلبك!',
                        `السائق ${request.driverName} في الطريق إليك${phoneDisplay}`,
                        10000
                    );
                    
                    // بدء تتبع موقع السائق مع تحديث كل 6 ثواني
                    trackDriverForCustomer(requestId, request.acceptedBy);
                    
                    // عرض زر إلغاء الطلب بعد القبول أيضاً
                    showCancelRequestOption(requestId);
                    
                    try {
                        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGmz6eeXSwgNUKXi8LZkHAU5kdXzzHoqBSJ2xe/ekEEKFF+z6eirVhMJRp/g8b5uIQUrfs7y24o2Bw==');
                        audio.play().catch(() => {});
                    } catch (e) {}
                } else if (request.status === 'arrived') {
                    showNotification(
                        '📍 السائق وصل!',
                        `السائق ${request.driverName} في موقعك الآن`,
                        8000
                    );
                    
                    if (request.acceptedBy) {
                        stopTrackingDriver(request.acceptedBy);
                    }
                } else if (request.status === 'completed' && !request.rated) {
                    showRatingModal(requestId, request.driverName, request.acceptedBy);
                    
                    if (request.acceptedBy) {
                        stopTrackingDriver(request.acceptedBy);
                    }
                    
                    database.ref(`requests/${requestId}`).off();
                } else if (request.status === 'cancelled_by_customer') {
                    showNotification('تم الإلغاء', 'تم إلغاء طلبك بنجاح', 5000);
                    database.ref(`requests/${requestId}`).off();
                    
                    if (request.acceptedBy) {
                        stopTrackingDriver(request.acceptedBy);
                    }
                }
                
                // عرض رسائل السائق
                if (request.messages && request.messages.length > 0) {
                    const lastMessage = request.messages[request.messages.length - 1];
                    if (lastMessage.from === 'driver') {
                        showNotification('رسالة من السائق', lastMessage.text, 7000);
                    }
                }
            });
        }
        
        // عرض زر إلغاء الطلب للمستخدم
        function showCancelRequestOption(requestId) {
            // التحقق من وجود الزر بالفعل
            if (document.getElementById('cancelRequestBtn')) {
                return;
            }
            
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancelRequestBtn';
            cancelBtn.className = 'btn btn-danger';
            cancelBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1500; animation: pulse 2s infinite;';
            cancelBtn.innerHTML = '<span>❌</span><span>إلغاء الطلب</span>';
            
            cancelBtn.onclick = () => {
                if (confirm('هل أنت متأكد من إلغاء الطلب؟')) {
                    cancelRequestByCustomer(requestId);
                }
            };
            
            document.body.appendChild(cancelBtn);
        }
        
        // إلغاء الطلب من قبل المستخدم
        async function cancelRequestByCustomer(requestId) {
            showLoading();
            
            try {
                const requestSnapshot = await database.ref(`requests/${requestId}`).once('value');
                const request = requestSnapshot.val();
                
                if (!request) {
                    showNotification('خطأ', 'الطلب غير موجود');
                    hideLoading();
                    return;
                }
                
                // تحديث حالة الطلب
                await database.ref(`requests/${requestId}`).update({
                    status: 'cancelled_by_customer',
                    cancelledAt: Date.now()
                });
                
                // إذا كان هناك سائق قبل الطلب، إرسال إشعار له
                if (request.acceptedBy) {
                    await database.ref(`notifications/${request.acceptedBy}_${Date.now()}`).set({
                        type: 'request_cancelled',
                        requestId: requestId,
                        message: `تم إلغاء الطلب من قبل العميل ${request.phone}`,
                        timestamp: Date.now()
                    });
                    
                    stopTrackingDriver(request.acceptedBy);
                }
                
                // إزالة زر الإلغاء
                const cancelBtn = document.getElementById('cancelRequestBtn');
                if (cancelBtn) {
                    cancelBtn.remove();
                }
                
                showNotification('تم', 'تم إلغاء الطلب بنجاح');
                
            } catch (error) {
                console.error('Error cancelling request:', error);
                showNotification('خطأ', 'حدث خطأ أثناء إلغاء الطلب');
            } finally {
                hideLoading();
            }
        }
        
        // Rating Modal
        function showRatingModal(requestId, driverName, driverId) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">تقييم الرحلة</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="rating-container">
                        <p style="text-align: center; margin-bottom: 15px; font-size: 16px;">
                            <strong>تقييم السائق ${driverName}</strong>
                        </p>
                        <div class="rating-stars" id="driverRatingStars">
                            <span class="star" data-rating="1">⭐</span>
                            <span class="star" data-rating="2">⭐</span>
                            <span class="star" data-rating="3">⭐</span>
                            <span class="star" data-rating="4">⭐</span>
                            <span class="star" data-rating="5">⭐</span>
                        </div>
                        <p style="text-align: center; margin: 15px 0; font-size: 16px;">
                            <strong>تقييم الموقع</strong>
                        </p>
                        <div class="rating-stars" id="siteRatingStars">
                            <span class="star" data-rating="1">⭐</span>
                            <span class="star" data-rating="2">⭐</span>
                            <span class="star" data-rating="3">⭐</span>
                            <span class="star" data-rating="4">⭐</span>
                            <span class="star" data-rating="5">⭐</span>
                        </div>
                        <textarea class="rating-comment" id="ratingComment" placeholder="تعليق أو شكوى حول الرحلة (اختياري)..."></textarea>
                        <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" onclick="submitRating('${requestId}', '${driverId}')">
                            إرسال التقييم
                        </button>
                        <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" onclick="this.closest('.modal').remove()">
                            تخطي
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            let driverRating = 0;
            let siteRating = 0;
            
            const driverStars = modal.querySelectorAll('#driverRatingStars .star');
            driverStars.forEach(star => {
                star.addEventListener('click', function() {
                    driverRating = parseInt(this.dataset.rating);
                    driverStars.forEach((s, index) => {
                        if (index < driverRating) {
                            s.classList.add('active');
                        } else {
                            s.classList.remove('active');
                        }
                    });
                });
            });
            
            const siteStars = modal.querySelectorAll('#siteRatingStars .star');
            siteStars.forEach(star => {
                star.addEventListener('click', function() {
                    siteRating = parseInt(this.dataset.rating);
                    siteStars.forEach((s, index) => {
                        if (index < siteRating) {
                            s.classList.add('active');
                        } else {
                            s.classList.remove('active');
                        }
                    });
                });
            });
            
            window.currentDriverRating = () => driverRating;
            window.currentSiteRating = () => siteRating;
        }
        
        window.submitRating = async function(requestId, driverId) {
            const driverRating = window.currentDriverRating ? window.currentDriverRating() : 0;
            const siteRating = window.currentSiteRating ? window.currentSiteRating() : 0;
            const comment = document.getElementById('ratingComment')?.value || '';
            
            if (driverRating === 0 || siteRating === 0) {
                showNotification('تنبيه', 'الرجاء اختيار التقييمات');
                return;
            }
            
            showLoading();
            
            try {
                const ratingId = `rating_${Date.now()}`;
                await database.ref(`ratings/${ratingId}`).set({
                    requestId: requestId,
                    driverId: driverId,
                    driverRating: driverRating,
                    siteRating: siteRating,
                    comment: comment,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                
                await database.ref(`requests/${requestId}`).update({
                    rated: true,
                    driverRating: driverRating,
                    siteRating: siteRating
                });
                
                const ratingsSnapshot = await database.ref('ratings').orderByChild('driverId').equalTo(driverId).once('value');
                const ratings = ratingsSnapshot.val();
                
                if (ratings) {
                    const ratingValues = Object.values(ratings).map(r => r.driverRating);
                    const averageRating = (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1);
                    
                    await database.ref(`drivers/${driverId}`).update({
                        averageRating: parseFloat(averageRating),
                        totalRatings: ratingValues.length
                    });
                }
                
                document.querySelector('.modal.active').remove();
                
                showNotification('شكراً', 'تم إرسال تقييمك بنجاح!');
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ');
            } finally {
                hideLoading();
            }
        };
        
        // Show Request Popup
        function showRequestPopup(request, marker) {
            L.popup({
                minWidth: 280,
                className: 'request-popup'
            }).setLatLng(marker.getLatLng())
              .setContent(createRequestPopupContent(request))
              .openOn(map);
        }
        
        function createRequestPopupContent(request) {
            const canManage = currentUser.isDriver;
            const createdDate = new Date(request.createdAt).toLocaleString('ar-EG');
            
            // رسائل السائق للزبون
            const messagesHtml = request.messages && request.messages.length > 0 ? `
                <div class="chat-messages">
                    ${request.messages.slice(-3).map(msg => `
                        <div class="chat-message">
                            <div class="message-text">${msg.text}</div>
                            <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('ar')}</div>
                        </div>
                    `).join('')}
                </div>
            ` : '';
            
            return `
                <div class="request-popup">
                    <h3>📍 تفاصيل الطلب</h3>
                    ${canManage && request.locationDescription ? `
                        <div class="request-info">
                            <div class="request-label">موقع العميل:</div>
                            <div class="request-value">${request.locationDescription}</div>
                        </div>
                    ` : ''}
                    <div class="request-info">
                        <div class="request-label">الوجهة:</div>
                        <div class="request-value">${request.destination}</div>
                    </div>
                    ${request.price ? `
                        <div class="request-info">
                            <div class="request-label">السعر المتوقع:</div>
                            <div class="request-value">${request.price} شيكل</div>
                        </div>
                    ` : ''}
                    ${canManage ? `
                        <div class="request-info">
                            <div class="request-label">رقم الهاتف:</div>
                            <div class="request-value"><a href="tel:${request.phone}" style="color: var(--primary); font-weight: bold;">${request.phone}</a></div>
                        </div>
                    ` : ''}
                    ${request.details && canManage ? `
                        <div class="request-info">
                            <div class="request-label">التفاصيل:</div>
                            <div class="request-value">${request.details}</div>
                        </div>
                    ` : ''}
                    <div class="request-info">
                        <div class="request-label">الوقت:</div>
                        <div class="request-value">${createdDate}</div>
                    </div>
                    <span class="status-badge status-${request.status}">
                        ${request.status === 'pending' ? 'في الانتظار' : 
                          request.status === 'accepted' ? 'تم القبول' :
                          request.status === 'arrived' ? 'وصل السائق' :
                          request.status === 'completed' ? 'مكتملة' : request.status}
                    </span>
                    ${messagesHtml}
                    ${canManage && request.status === 'pending' ? `
                        <div class="request-actions">
                            <button class="btn btn-accept" onclick="acceptRequest('${request.id}', '${request.phone}')">
                                ✓ قبول
                            </button>
                            <button class="btn btn-reject" onclick="removeRequest('${request.id}')">
                                × إزالة
                            </button>
                        </div>
                    ` : ''}
                    ${canManage && request.status === 'accepted' && request.acceptedBy === currentUser.driverId ? `
                        <div class="quick-messages">
                            <button class="quick-msg-btn" onclick="sendQuickMessage('${request.id}', 'أنا في الطريق إليك')">📍 في الطريق</button>
                            <button class="quick-msg-btn" onclick="sendQuickMessage('${request.id}', 'سأصل خلال 5 دقائق')">⏱️ 5 دقائق</button>
                            <button class="quick-msg-btn" onclick="sendQuickMessage('${request.id}', 'أنا بالانتظار')">⏸️ بالانتظار</button>
                        </div>
                        <div class="request-actions">
                            <button class="btn btn-arrived" onclick="markAsArrived('${request.id}')">
                                📍 وصلت للموقع
                            </button>
                        </div>
                    ` : ''}
                    ${canManage && request.status === 'arrived' && request.acceptedBy === currentUser.driverId ? `
                        <div class="request-actions">
                            <button class="btn btn-complete" onclick="completeTrip('${request.id}')">
                                ✓ إنهاء الرحلة
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Send Quick Message
        window.sendQuickMessage = async function(requestId, message) {
            try {
                const messagesRef = database.ref(`requests/${requestId}/messages`);
                const messagesSnapshot = await messagesRef.once('value');
                const messages = messagesSnapshot.val() || [];
                
                messages.push({
                    text: message,
                    timestamp: Date.now(),
                    from: 'driver'
                });
                
                await messagesRef.set(messages);
                
                showNotification('تم', 'تم إرسال الرسالة');
                map.closePopup();
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ في إرسال الرسالة');
            }
        };
        
        // Accept Request
        window.acceptRequest = async function(requestId, customerPhone) {
            if (!currentUser.isDriver || !currentUser.driverId) {
                showNotification('خطأ', 'يجب تسجيل الدخول كسائق');
                return;
            }
            
            // التحقق من أن السائق غير محجوز
            if (currentUser.isBooked) {
                showNotification('تنبيه', 'أنت محجوز حالياً! أشل الحجز أولاً');
                return;
            }
            
            showLoading();
            
            try {
                const result = await database.ref(`requests/${requestId}`).transaction((current) => {
                    if (!current || current.status !== 'pending') {
                        return;
                    }
                    
                    current.status = 'accepted';
                    current.acceptedBy = currentUser.driverId;
                    current.driverName = currentUser.name;
                    current.driverPhone = currentUser.phone;
                    current.showDriverPhone = currentUser.showPhone;
                    current.acceptedAt = Date.now();
                    
                    return current;
                });
                
                if (!result.committed) {
                    showNotification('تنبيه', 'تم قبول هذا الطلب من سائق آخر');
                    hideLoading();
                    return;
                }
                
                const requestData = result.snapshot.val();
                
                // تفعيل الحجز
                currentUser.isBooked = true;
                await database.ref(`drivers/${currentUser.driverId}`).update({
                    isBooked: true,
                    bookedAt: Date.now()
                });
                
                console.log('🔒 تم تفعيل الحجز للسائق');
                
                const tripId = `trip_${Date.now()}`;
                await database.ref(`trips/${tripId}`).set({
                    requestId: requestId,
                    driverId: currentUser.driverId,
                    driverName: currentUser.name,
                    customerPhone: customerPhone,
                    destination: requestData.destination,
                    status: 'on_the_way',
                    createdAt: Date.now()
                });
                
                map.closePopup();
                showNotification('تم', `تم قبول الطلب - ${customerPhone}\n🔒 أنت الآن محجوز`);
                
                // عرض زر إشالة الحجز
                showRemoveBookingButton();
                
                setTimeout(() => {
                    if (confirm(`هل تريد الاتصال بالعميل؟`)) {
                        window.location.href = `tel:${customerPhone}`;
                    }
                }, 1000);
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ');
            } finally {
                hideLoading();
            }
        };
        
        // دالة إشالة الحجز
        window.removeBooking = async function() {
            if (!currentUser.isDriver || !currentUser.driverId) {
                showNotification('خطأ', 'يجب تسجيل الدخول كسائق');
                return;
            }
            
            if (!currentUser.isBooked) {
                showNotification('تنبيه', 'أنت غير محجوز حالياً');
                return;
            }
            
            if (!confirm('هل أنت متأكد من إشالة الحجز؟\nستتمكن من استقبال طلبات جديدة')) {
                return;
            }
            
            showLoading();
            
            try {
                currentUser.isBooked = false;
                await database.ref(`drivers/${currentUser.driverId}`).update({
                    isBooked: false,
                    unbookedAt: Date.now()
                });
                
                console.log('🔓 تم إشالة الحجز - السائق متاح الآن');
                showNotification('تم', '✅ تم إشالة الحجز\nأنت الآن متاح لاستقبال طلبات جديدة');
                
                // حذف زر الحجز
                const bookingBtn = document.getElementById('removeBookingBtn');
                if (bookingBtn) {
                    bookingBtn.remove();
                }
                
            } catch (error) {
                console.error('خطأ في إشالة الحجز:', error);
                showNotification('خطأ', 'حدث خطأ أثناء إشالة الحجز');
            } finally {
                hideLoading();
            }
        };
        
        // عرض زر إشالة الحجز
        function showRemoveBookingButton() {
            // حذف الزر القديم إن وجد
            const oldBtn = document.getElementById('removeBookingBtn');
            if (oldBtn) oldBtn.remove();
            
            const bookingBtn = document.createElement('button');
            bookingBtn.id = 'removeBookingBtn';
            bookingBtn.className = 'btn btn-danger';
            bookingBtn.style.cssText = 'position: fixed; bottom: 30px; left: 30px; z-index: 2500; padding: 18px 30px; font-size: 18px; box-shadow: 0 4px 20px rgba(255, 71, 87, 0.5); animation: pulse 2s infinite;';
            bookingBtn.innerHTML = '<span style="font-size: 24px;">🔓</span><span style="margin-right: 10px;">إشالة الحجز</span>';
            
            bookingBtn.onclick = () => {
                window.removeBooking();
            };
            
            document.body.appendChild(bookingBtn);
            console.log('✅ تم إضافة زر إشالة الحجز');
        }
        
        window.markAsArrived = async function(requestId) {
            showLoading();
            
            try {
                await database.ref(`requests/${requestId}`).update({
                    status: 'arrived',
                    arrivedAt: firebase.database.ServerValue.TIMESTAMP
                });
                
                map.closePopup();
                showNotification('تم', 'تم تأكيد وصولك');
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ');
            } finally {
                hideLoading();
            }
        };
        
        window.completeTrip = async function(requestId) {
            if (!confirm('هل أنت متأكد من إنهاء الرحلة؟')) return;
            
            showLoading();
            
            try {
                await database.ref(`requests/${requestId}`).update({
                    status: 'completed',
                    completedAt: firebase.database.ServerValue.TIMESTAMP
                });
                
                if (requestMarkers[requestId]) {
                    map.removeLayer(requestMarkers[requestId]);
                    delete requestMarkers[requestId];
                }
                
                map.closePopup();
                showNotification('تم', 'تم إنهاء الرحلة بنجاح!');
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ');
            } finally {
                hideLoading();
            }
        };
        
        window.removeRequest = async function(requestId) {
            if (!currentUser.isDriver) return;
            if (!confirm('هل أنت متأكد؟')) return;
            
            showLoading();
            
            try {
                await database.ref(`requests/${requestId}`).remove();
                map.closePopup();
                showNotification('تم', 'تم إزالة الطلب');
            } catch (error) {
                showNotification('خطأ', 'حدث خطأ');
            } finally {
                hideLoading();
            }
        };
        
        document.getElementById('mailBtn').addEventListener('click', () => {
            const pendingRequests = Object.values(requestMarkers);
            
            if (pendingRequests.length === 0) {
                showNotification('لا توجد طلبات', 'لا توجد طلبات في الانتظار');
                return;
            }
            
            const bounds = L.latLngBounds(
                pendingRequests.map(marker => marker.getLatLng())
            );
            map.fitBounds(bounds, { padding: [50, 50] });
            
            showNotification('الطلبات', `لديك ${pendingRequests.length} طلب`);
        });
        
        listenToRequests();
        
        window.addEventListener('beforeunload', () => {
            if (currentUser.isDriver) {
                database.ref(`drivers/${currentUser.driverId}`).update({
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        });
        
        

// ==========================================
// إصلاح 1: حفظ واستعادة رقم الهاتف تلقائياً
// ==========================================
(function() {
    // استعادة الرقم عند تحميل الصفحة
    const savedPhone = localStorage.getItem('userPhone');
    if (savedPhone) {
        userPhone = savedPhone;
        const phoneField = document.getElementById('phoneNumber');
        if (phoneField) {
            phoneField.value = savedPhone;
            phoneField.removeAttribute('readonly'); // جعله قابل للتعديل
        }
        
        // إخفاء شاشة إدخال الرقم
        const phoneGate = document.getElementById('phoneGateModal');
        if (phoneGate) {
            phoneGate.classList.remove('active');
        }
    }
    
    // حفظ الرقم عند التغيير
    const phoneNumberField = document.getElementById('phoneNumber');
    if (phoneNumberField) {
        phoneNumberField.removeAttribute('readonly');
        phoneNumberField.addEventListener('change', function() {
            const phone = this.value.trim();
            if (phone) {
                localStorage.setItem('userPhone', phone);
                userPhone = phone;
                console.log('✅ تم حفظ رقم الهاتف:', phone);
            }
        });
    }
})();

// ==========================================
// إصلاح 2: إظهار جميع الطلبات للسائقين مباشرة
// ==========================================
function listenToRequestsFixed() {
    console.log('🔄 بدء الاستماع للطلبات...');
    
    // الاستماع لجميع الطلبات المعلقة بدون تأخير
    database.ref('requests')
        .orderByChild('status')
        .equalTo('pending')
        .on('value', (snapshot) => {
            const requests = snapshot.val() || {};
            console.log('📋 الطلبات المعلقة:', Object.keys(requests).length);
            
            // إزالة العلامات القديمة
            Object.keys(requestMarkers).forEach(requestId => {
                if (!requests[requestId]) {
                    if (requestMarkers[requestId]) {
                        map.removeLayer(requestMarkers[requestId]);
                    }
                    delete requestMarkers[requestId];
                }
            });
            
            let pendingCount = 0;
            
            // إضافة جميع الطلبات المعلقة فوراً
            Object.keys(requests).forEach(requestId => {
                const request = requests[requestId];
                
                if (request.status === 'pending') {
                    pendingCount++;
                    
                    // إضافة علامة على الخريطة مباشرة
                    if (!requestMarkers[requestId]) {
                        const marker = L.marker(
                            [request.location.lat, request.location.lng], 
                            { icon: requestIcon }
                        ).addTo(map);
                        
                        marker.on('click', () => {
                            showRequestPopup(request, marker);
                        });
                        
                        requestMarkers[requestId] = marker;
                        
                        // إظهار إشعار للسائقين
                        if (currentUser.isDriver) {
                            console.log('🚨 طلب جديد:', request.destination);
                            showNotification(
                                '🚨 طلب جديد!',
                                `${request.phone} - ${request.destination}`,
                                8000
                            );
                            
                            // صوت تنبيه
                            try {
                                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGmz6eeXSwgNUKXi8LZkHAU5kdXzzHoqBSJ2xe/ekEEKFF+z6eirVhMJRp/g8b5uIQUrfs7y24o2Bw==');
                                audio.play().catch(() => {});
                            } catch (e) {}
                        }
                    }
                }
            });
            
            // تحديث عداد الطلبات
            const countBadge = document.getElementById('requestCount');
            if (countBadge && currentUser.isDriver) {
                if (pendingCount > 0) {
                    countBadge.textContent = pendingCount;
                    countBadge.style.display = 'inline-block';
                } else {
                    countBadge.style.display = 'none';
                }
            }
        }, (error) => {
            console.error('❌ خطأ في الاستماع للطلبات:', error);
        });
}

// استبدال الدالة القديمة
if (typeof listenToRequests !== 'undefined') {
    listenToRequests = listenToRequestsFixed;
    console.log('✅ تم تحديث دالة الاستماع للطلبات');
}

// ==========================================
// إصلاح 2.5: دالة عرض زر الإلغاء (يجب تعريفها قبل استخدامها)
// ==========================================
function showCancelRequestOptionFixed(requestId) {
    const oldBtn = document.getElementById('cancelRequestBtn');
    if (oldBtn) oldBtn.remove();
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelRequestBtn';
    cancelBtn.className = 'btn btn-danger';
    cancelBtn.style.cssText = 'position: fixed; bottom: 30px; right: 30px; z-index: 2500; padding: 18px 30px; font-size: 18px; box-shadow: 0 4px 20px rgba(255, 71, 87, 0.5); animation: pulse 2s infinite;';
    cancelBtn.innerHTML = '<span style="font-size: 24px;">❌</span><span style="margin-right: 10px;">إلغاء الطلب</span>';
    
    cancelBtn.onclick = function() {
        if (typeof window.cancelRequestByCustomerFixed === 'function') {
            window.cancelRequestByCustomerFixed(requestId);
        }
    };
    
    document.body.appendChild(cancelBtn);
    console.log('✅ تم إضافة زر الإلغاء');
}

// ==========================================
// إصلاح 3: إصلاح زر إلغاء الطلب
// ==========================================
window.cancelRequestByCustomerFixed = async function(requestId) {
    console.log('🚫 محاولة إلغاء الطلب:', requestId);
    
    if (!confirm('هل أنت متأكد من إلغاء الطلب؟')) {
        return;
    }
    
    showLoading();
    
    try {
        // قراءة الطلب أولاً
        const requestSnapshot = await database.ref(`requests/${requestId}`).once('value');
        const request = requestSnapshot.val();
        
        if (!request) {
            console.error('❌ الطلب غير موجود');
            showNotification('خطأ', 'الطلب غير موجود');
            hideLoading();
            return;
        }
        
        console.log('📄 بيانات الطلب:', request);
        
        // تحديث حالة الطلب
        await database.ref(`requests/${requestId}`).update({
            status: 'cancelled_by_customer',
            cancelledAt: Date.now()
        });
        
        console.log('✅ تم تحديث حالة الطلب إلى cancelled');
        
        // إرسال إشعار للسائق إذا كان قد قبل الطلب
        if (request.acceptedBy) {
            await database.ref(`notifications/${request.acceptedBy}_${Date.now()}`).set({
                type: 'request_cancelled',
                requestId: requestId,
                customerPhone: request.phone,
                message: `تم إلغاء الطلب من قبل العميل ${request.phone}`,
                timestamp: Date.now()
            });
            
            console.log('📧 تم إرسال إشعار للسائق');
        }
        
        // إزالة العلامة من الخريطة
        if (requestMarkers[requestId]) {
            map.removeLayer(requestMarkers[requestId]);
            delete requestMarkers[requestId];
        }
        
        // إزالة زر الإلغاء
        const cancelBtn = document.getElementById('cancelRequestBtn');
        if (cancelBtn) {
            cancelBtn.remove();
        }
        
        // إيقاف التتبع
        if (activeRequestTracking === requestId) {
            stopTrackingDriver(request.acceptedBy);
        }
        
        showNotification('تم ✅', 'تم إلغاء الطلب بنجاح');
        
        // إيقاف الاستماع لهذا الطلب
        database.ref(`requests/${requestId}`).off();
        
    } catch (error) {
        console.error('❌ خطأ في إلغاء الطلب:', error);
        showNotification('خطأ', 'حدث خطأ: ' + error.message);
    } finally {
        hideLoading();
    }
};

// ==========================================
// إصلاح 4: إصلاح قبول الطلب من السائق
// ==========================================
window.acceptRequestFixed = async function(requestId, customerPhone) {
    console.log('✅ محاولة قبول الطلب:', requestId);
    
    if (!currentUser.isDriver || !currentUser.driverId) {
        showNotification('خطأ', 'يجب تسجيل الدخول كسائق أولاً');
        return;
    }
    
    showLoading();
    
    try {
        // قراءة الطلب أولاً للتحقق
        const requestSnapshot = await database.ref(`requests/${requestId}`).once('value');
        const currentRequest = requestSnapshot.val();
        
        if (!currentRequest) {
            console.error('❌ الطلب غير موجود');
            showNotification('خطأ', 'الطلب غير موجود أو تم حذفه');
            hideLoading();
            return;
        }
        
        if (currentRequest.status !== 'pending') {
            console.error('❌ الطلب ليس في حالة انتظار');
            showNotification('تنبيه', 'تم قبول هذا الطلب من سائق آخر');
            hideLoading();
            return;
        }
        
        console.log('📄 حالة الطلب: pending - يمكن القبول');
        
        // تحديث الطلب مباشرة (بدون transaction لتجنب التعليق)
        await database.ref(`requests/${requestId}`).update({
            status: 'accepted',
            acceptedBy: currentUser.driverId,
            driverName: currentUser.name,
            driverPhone: currentUser.phone,
            showDriverPhone: currentUser.showPhone || true,
            acceptedAt: Date.now()
        });
        
        console.log('✅ تم تحديث الطلب بنجاح');
        
        // إنشاء سجل الرحلة
        const tripId = `trip_${Date.now()}`;
        await database.ref(`trips/${tripId}`).set({
            requestId: requestId,
            driverId: currentUser.driverId,
            driverName: currentUser.name,
            customerPhone: customerPhone,
            destination: currentRequest.destination,
            status: 'on_the_way',
            createdAt: Date.now()
        });
        
        console.log('✅ تم إنشاء سجل الرحلة');
        
        // إغلاق النافذة المنبثقة
        map.closePopup();
        
        showNotification('تم ✅', `تم قبول الطلب - ${customerPhone}`);
        
        // سؤال عن الاتصال
        setTimeout(() => {
            if (confirm(`هل تريد الاتصال بالعميل ${customerPhone}؟`)) {
                window.location.href = `tel:${customerPhone}`;
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ خطأ في قبول الطلب:', error);
        showNotification('خطأ', 'حدث خطأ: ' + error.message);
    } finally {
        hideLoading();
    }
};

// ==========================================
// إصلاح 5: الاستماع لطلب المستخدم (مع معالجة الخروج والدخول)
// ==========================================
window.listenToMyRequestFixed = function(requestId, customerPhone) {
    console.log('👂 بدء الاستماع لطلب:', requestId);
    
    // حفظ معلومات الطلب في localStorage
    localStorage.setItem('activeRequestId', requestId);
    localStorage.setItem('activeRequestPhone', customerPhone);
    
    database.ref(`requests/${requestId}`).on('value', (snapshot) => {
        const request = snapshot.val();
        
        if (!request) {
            console.log('⚠️ الطلب غير موجود أو تم حذفه');
            localStorage.removeItem('activeRequestId');
            localStorage.removeItem('activeRequestPhone');
            return;
        }
        
        console.log('📊 حالة الطلب:', request.status);
        
        if (request.status === 'pending') {
            showCancelRequestOptionFixed(requestId);
        }
        
        if (request.status === 'accepted' && request.driverName) {
            const phoneDisplay = request.showDriverPhone ? ` - ${request.driverPhone}` : '';
            showNotification(
                '🎉 تم قبول طلبك!',
                `السائق ${request.driverName} في الطريق إليك${phoneDisplay}`,
                10000
            );
            
            trackDriverForCustomer(requestId, request.acceptedBy);
            showCancelRequestOptionFixed(requestId);
            
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGmz6eeXSwgNUKXi8LZkHAU5kdXzzHoqBSJ2xe/ekEEKFF+z6eirVhMJRp/g8b5uIQUrfs7y24o2Bw==');
                audio.play().catch(() => {});
            } catch (e) {}
        } 
        else if (request.status === 'arrived') {
            showNotification(
                '📍 السائق وصل!',
                `السائق ${request.driverName} في موقعك الآن`,
                8000
            );
            
            if (request.acceptedBy) {
                stopTrackingDriver(request.acceptedBy);
            }
        } 
        else if (request.status === 'completed' && !request.rated) {
            showRatingModal(requestId, request.driverName, request.acceptedBy);
            
            if (request.acceptedBy) {
                stopTrackingDriver(request.acceptedBy);
            }
            
            localStorage.removeItem('activeRequestId');
            localStorage.removeItem('activeRequestPhone');
            database.ref(`requests/${requestId}`).off();
        } 
        else if (request.status === 'cancelled_by_customer') {
            showNotification('تم الإلغاء', 'تم إلغاء طلبك', 5000);
            
            localStorage.removeItem('activeRequestId');
            localStorage.removeItem('activeRequestPhone');
            database.ref(`requests/${requestId}`).off();
            
            if (request.acceptedBy) {
                stopTrackingDriver(request.acceptedBy);
            }
            
            const cancelBtn = document.getElementById('cancelRequestBtn');
            if (cancelBtn) cancelBtn.remove();
        }
        
        // عرض رسائل السائق
        if (request.messages && request.messages.length > 0) {
            const lastMessage = request.messages[request.messages.length - 1];
            if (lastMessage.from === 'driver') {
                showNotification('رسالة من السائق', lastMessage.text, 7000);
            }
        }
    }, (error) => {
        console.error('❌ خطأ في الاستماع للطلب:', error);
    });
};

// ==========================================
// إصلاح 6: زر إلغاء الطلب المحسّن
// ==========================================
// ==========================================
// إصلاح 7: استعادة الطلب النشط عند العودة
// ==========================================
(function() {
    const activeRequestId = localStorage.getItem('activeRequestId');
    const activeRequestPhone = localStorage.getItem('activeRequestPhone');
    
    if (activeRequestId && activeRequestPhone) {
        console.log('🔄 استعادة الطلب النشط:', activeRequestId);
        
        // الانتظار قليلاً حتى يتم تحميل كل شيء
        setTimeout(() => {
            listenToMyRequestFixed(activeRequestId, activeRequestPhone);
        }, 2000);
    }
})();

        // ==========================================
        // تطبيق الإصلاحات على الدوال الموجودة
        // ==========================================
        console.log('🔧 تطبيق الإصلاحات...');
        
        // استبدال الدوال
        if (typeof cancelRequestByCustomer !== 'undefined') {
            window.cancelRequestByCustomer = cancelRequestByCustomerFixed;
        }
        
        if (typeof acceptRequest !== 'undefined') {
            window.acceptRequest = acceptRequestFixed;
        }
        
        if (typeof listenToMyRequest !== 'undefined') {
            window.listenToMyRequest = listenToMyRequestFixed;
        }
        
        // إعادة تشغيل الاستماع للطلبات للسائقين
        if (currentUser && currentUser.isDriver) {
            console.log('🚕 إعادة تشغيل الاستماع للطلبات للسائق');
            listenToRequestsFixed();
        }
        
        console.log('✅ تم تطبيق جميع الإصلاحات بنجاح!');
        console.log('📱 التطبيق جاهز للاستخدام');

        } // end of initializeApp
