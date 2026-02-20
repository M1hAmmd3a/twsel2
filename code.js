/* ==========================================
   إضافة هذا الكود في نهاية ملف taxi-tulkarm-advanced.html
   قبل إغلاق وسم </script>
   ========================================== */

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
function showCancelRequestOptionFixed(requestId) {
    // إزالة الزر القديم إن وجد
    const oldBtn = document.getElementById('cancelRequestBtn');
    if (oldBtn) oldBtn.remove();
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelRequestBtn';
    cancelBtn.className = 'btn btn-danger';
    cancelBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 2500;
        padding: 18px 30px;
        font-size: 18px;
        box-shadow: 0 4px 20px rgba(255, 71, 87, 0.5);
        animation: pulse 2s infinite;
    `;
    cancelBtn.innerHTML = '<span style="font-size: 24px;">❌</span><span style="margin-right: 10px;">إلغاء الطلب</span>';
    
    cancelBtn.onclick = () => {
        cancelRequestByCustomerFixed(requestId);
    };
    
    document.body.appendChild(cancelBtn);
    console.log('✅ تم إضافة زر الإلغاء');
}

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