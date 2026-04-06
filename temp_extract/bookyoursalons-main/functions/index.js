const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const fetch = require("node-fetch");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Helper: Safe number
const safeNum = (val, def = 0) => {
  const n = Number(val);
  return isNaN(n) ? def : n;
};

// Helper: Generate unique ID
const generateId = () => db.collection("_temp").doc().id;

// Helper: Get today's date string
const getTodayStr = () => new Date().toISOString().split("T")[0];

// ==================== MAIN API ROUTER ====================

exports.api = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const path = req.path.replace(/^\/api/, "").replace(/\/$/, "");
      const method = req.method;
      
      console.log(`[API] ${method} ${path}`);

      // ========== AUTH ROUTES ==========
      if (path === "/auth/track-login" && method === "POST") {
        return handleTrackLogin(req, res);
      }

      // ========== GEOCODE ROUTES ==========
      if (path === "/geocode/reverse" && method === "GET") {
        return handleGeocodeReverse(req, res);
      }
      if (path === "/geocode/search" && method === "GET") {
        return handleGeocodeSearch(req, res);
      }

      // ========== SALON ROUTES ==========
      if (path === "/salon/register" && method === "POST") {
        return handleSalonRegister(req, res);
      }
      if (path === "/salon/update-profile" && method === "PUT") {
        return handleUpdateSalonProfile(req, res);
      }
      if (path === "/salon/discount-eligibility" && method === "GET") {
        return handleCheckDiscountEligibility(req, res);
      }
      if (path === "/salon/subscribe" && method === "POST") {
        return handleSalonSubscribe(req, res);
      }
      if (path.match(/^\/salon\/user\/[\w-]+$/) && method === "GET") {
        const uid = path.split("/")[3];
        return handleGetSalonByUser(req, res, uid);
      }
      if (path.match(/^\/salon\/status\/[\w\+]+$/) && method === "GET") {
        const phone = decodeURIComponent(path.split("/")[3]);
        return handleGetSalonStatus(req, res, phone);
      }
      if (path.match(/^\/salon\/[\w-]+\/dashboard-analytics$/) && method === "GET") {
        const salonId = path.split("/")[2];
        return handleSalonDashboardAnalytics(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/toggle-status$/) && method === "PATCH") {
        const salonId = path.split("/")[2];
        return handleToggleSalonStatus(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/hours$/) && method === "PATCH") {
        const salonId = path.split("/")[2];
        return handleUpdateSalonHours(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/location$/) && method === "PATCH") {
        const salonId = path.split("/")[2];
        return handleUpdateSalonLocation(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/bank-details$/) && method === "POST") {
        const salonId = path.split("/")[2];
        return handleSaveBankDetails(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/upload-photo$/) && method === "POST") {
        const salonId = path.split("/")[2];
        return handleUploadSalonPhoto(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/gallery$/) && method === "POST") {
        const salonId = path.split("/")[2];
        return handleUploadGallery(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/check-auto-close$/) && method === "POST") {
        const salonId = path.split("/")[2];
        return handleCheckAutoClose(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/slots$/) && method === "GET") {
        const salonId = path.split("/")[2];
        return handleGetSalonSlots(req, res, salonId);
      }
      if (path.match(/^\/salon\/[\w-]+\/reviews$/) && method === "GET") {
        const salonId = path.split("/")[2];
        return handleGetSalonReviews(req, res, salonId);
      }

      // ========== SALONS (PLURAL) ROUTES ==========
      if (path === "/salons/nearby" && method === "GET") {
        return handleGetNearbySalons(req, res);
      }
      if (path === "/salons/trending" && method === "GET") {
        return handleGetTrendingSalons(req, res);
      }
      if (path === "/salons/recommended" && method === "GET") {
        return handleGetRecommendedSalons(req, res);
      }

      // ========== SEARCH ROUTES ==========
      if (path === "/search" && method === "GET") {
        return handleSearch(req, res);
      }

      // ========== BOOKING ROUTES ==========
      if (path === "/booking/create" && method === "POST") {
        return handleCreateBooking(req, res);
      }
      if (path === "/booking/check-spam" && method === "POST") {
        return handleCheckSpam(req, res);
      }
      if (path.match(/^\/booking\/[\w-]+\/approve$/) && method === "POST") {
        const bookingId = path.split("/")[2];
        return handleApproveBooking(req, res, bookingId);
      }
      if (path.match(/^\/booking\/[\w-]+\/reject$/) && method === "POST") {
        const bookingId = path.split("/")[2];
        return handleRejectBooking(req, res, bookingId);
      }
      if (path.match(/^\/booking\/[\w-]+\/cancel$/) && method === "PATCH") {
        const bookingId = path.split("/")[2];
        return handleCancelBooking(req, res, bookingId);
      }

      // ========== BOOKINGS (PLURAL) ROUTES ==========
      if (path.match(/^\/bookings\/salon\/[\w-]+\/pending$/) && method === "GET") {
        const salonId = path.split("/")[3];
        return handleGetPendingBookings(req, res, salonId);
      }
      if (path.match(/^\/bookings\/salon\/[\w-]+$/) && method === "GET") {
        const salonId = path.split("/")[3];
        return handleGetSalonBookings(req, res, salonId);
      }
      if (path.match(/^\/bookings\/customer\/[\w\+]+$/) && method === "GET") {
        const phone = decodeURIComponent(path.split("/")[3]);
        return handleGetCustomerBookings(req, res, phone);
      }
      if (path.match(/^\/bookings\/upcoming-reminders\/[\w\+]+$/) && method === "GET") {
        const phone = decodeURIComponent(path.split("/")[3]);
        return handleGetUpcomingReminders(req, res, phone);
      }

      // ========== SLOT ROUTES ==========
      if (path === "/slot/lock" && method === "POST") {
        return handleLockSlot(req, res);
      }

      // ========== REVIEW ROUTES ==========
      if (path === "/review/create" && method === "POST") {
        return handleCreateReview(req, res);
      }

      // ========== CUSTOMER ROUTES ==========
      if (path === "/user/update-profile" && method === "PUT") {
        return handleUpdateUserProfile(req, res);
      }
      if (path.match(/^\/user\/profile\/.+$/) && method === "GET") {
        const phone = decodeURIComponent(path.split("/").slice(3).join("/"));
        return handleGetUserProfile(req, res, phone);
      }
      if (path.match(/^\/customer\/[\w\+]+\/service-reminders$/) && method === "GET") {
        const phone = decodeURIComponent(path.split("/")[2]);
        return handleGetServiceReminders(req, res, phone);
      }
      if (path.match(/^\/customer\/[\w-]+\/favorites$/) && method === "GET") {
        const uid = path.split("/")[2];
        return handleGetFavorites(req, res, uid);
      }
      if (path.match(/^\/customer\/[\w-]+\/favorites\/[\w-]+$/) && method === "POST") {
        const parts = path.split("/");
        const uid = parts[2];
        const salonId = parts[4];
        return handleToggleFavorite(req, res, uid, salonId);
      }

      // ========== COMMISSION ROUTES (backward compat) ==========
      if (path.match(/^\/commission\/salon\/[\w-]+$/) && method === "GET") {
        const salonId = path.split("/")[3];
        return handleGetSalonCommission(req, res, salonId);
      }

      // ========== ADMIN ROUTES ==========
      if (path === "/admin/analytics" && method === "GET") {
        return handleAdminAnalytics(req, res);
      }
      if (path === "/admin/analytics/detailed" && method === "GET") {
        return handleAdminAnalyticsDetailed(req, res);
      }
      if (path === "/admin/salons" && method === "GET") {
        return handleAdminGetSalons(req, res);
      }
      if (path === "/admin/salons/analytics-summary" && method === "GET") {
        return handleAdminSalonsSummary(req, res);
      }
      if (path === "/admin/bookings/all" && method === "GET") {
        return handleAdminGetAllBookings(req, res);
      }
      if (path === "/admin/user-analytics" && method === "GET") {
        return handleAdminUserAnalytics(req, res);
      }
      if (path === "/admin/login-stats" && method === "GET") {
        return handleAdminLoginStats(req, res);
      }
      if (path === "/admin/commission/summary" && method === "GET") {
        return handleAdminCommissionSummary(req, res);
      }
      if (path.match(/^\/admin\/salon\/[\w-]+\/approve$/) && method === "PATCH") {
        const salonId = path.split("/")[3];
        return handleAdminApproveSalon(req, res, salonId);
      }
      if (path.match(/^\/admin\/salon\/[\w-]+\/block$/) && method === "POST") {
        const salonId = path.split("/")[3];
        return handleAdminBlockSalon(req, res, salonId);
      }
      if (path.match(/^\/admin\/salon\/[\w-]+\/unblock$/) && method === "POST") {
        const salonId = path.split("/")[3];
        return handleAdminUnblockSalon(req, res, salonId);
      }
      if (path.match(/^\/admin\/salon\/[\w-]+\/analytics$/) && method === "GET") {
        const salonId = path.split("/")[3];
        return handleAdminSalonAnalytics(req, res, salonId);
      }
      if (path.match(/^\/admin\/booking\/[\w-]+\/status$/) && method === "PATCH") {
        const bookingId = path.split("/")[3];
        return handleAdminUpdateBookingStatus(req, res, bookingId);
      }

      // ========== ROOT ==========
      if (path === "/" || path === "") {
        return res.status(200).json({ 
          message: "BookYourSalons API v2.0",
          status: "operational"
        });
      }

      return res.status(404).json({ error: "Not found", path });
    } catch (error) {
      console.error("[API Error]", error);
      return res.status(500).json({ error: "Internal server error", detail: error.message });
    }
  });
});

// ==================== AUTH HANDLERS ====================

async function handleTrackLogin(req, res) {
  try {
    const { phone, name, firebase_uid, login_method } = req.body;
    const now = admin.firestore.Timestamp.now();

    if (!phone) {
      return res.status(400).json({ error: "phone is required" });
    }

    const userRef = db.collection("users").doc(phone);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update({
        last_login_at: now,
        login_method: login_method || "otp",
        name: name || userDoc.data().name,
        firebase_uid: firebase_uid || userDoc.data().firebase_uid,
        login_count: admin.firestore.FieldValue.increment(1)
      });
    } else {
      await userRef.set({
        phone,
        name: name || "",
        firebase_uid: firebase_uid || "",
        role: "customer",
        created_at: now,
        last_login_at: now,
        login_method: login_method || "otp",
        login_count: 1
      });
    }

    return res.status(200).json({ message: "Login tracked", phone });
  } catch (error) {
    console.error("Track login error:", error);
    return res.status(500).json({ error: "Failed to track login", detail: error.message });
  }
}

// ==================== GEOCODE HANDLERS ====================

async function handleGeocodeReverse(req, res) {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: "lat and lon parameters are required" });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "bookyoursalons/1.0 (https://bookyoursalons.web.app)"
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Geocode error:", error);
    return res.status(200).json({ 
      display_name: "Location selected",
      address: { city: "Unknown" }
    });
  }
}

async function handleGeocodeSearch(req, res) {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: "q parameter is required" });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "bookyoursalons/1.0 (https://bookyoursalons.web.app)"
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Geocode search error:", error);
    return res.status(200).json([]);
  }
}

// ==================== SALON HANDLERS ====================

async function handleSalonRegister(req, res) {
  try {
    const data = req.body;
    const now = admin.firestore.Timestamp.now();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const salonId = generateId();

    const salonData = {
      salon_id: salonId,
      salon_name: data.salon_name || "",
      owner_name: data.owner_name || "",
      phone: data.phone || "",
      address: data.address || "",
      area: data.area || "",
      latitude: safeNum(data.latitude),
      longitude: safeNum(data.longitude),
      location: {
        type: "Point",
        coordinates: [safeNum(data.longitude), safeNum(data.latitude)]
      },
      staff_count: safeNum(data.staff_count, 1),
      avg_service_time: safeNum(data.avg_service_time, 30),
      services: data.services || [],
      secondary_phone: data.secondary_phone || "",
      business_type: data.business_type || "salon",
      firebase_uid: data.firebase_uid || "",
      opening_time: data.opening_time || "09:00",
      closing_time: data.closing_time || "20:00",
      status: "pending",
      current_status: "open",
      rating: 4.0,
      review_count: 0,
      total_bookings: 0,
      total_revenue: 0,
      createdAt: now,
      trialStartDate: now,
      trialEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
      subscriptionStatus: "trial",
      subscription: {
        plan: "free_trial",
        plan_name: "1 Month Free Trial",
        amount: 0,
        days: 30,
        payment_status: "free",
        trial_start_date: now,
        trial_end_date: admin.firestore.Timestamp.fromDate(trialEndDate),
        expires_at: admin.firestore.Timestamp.fromDate(trialEndDate)
      }
    };

    await db.collection("salons").doc(salonId).set(salonData);

    return res.status(200).json({
      message: "Salon registered successfully. Your 1-month free trial starts after admin approval.",
      salon_id: salonId
    });
  } catch (error) {
    console.error("Salon registration error:", error);
    return res.status(500).json({ error: "Failed to register salon", detail: error.message });
  }
}

async function handleGetSalonByUser(req, res, uid) {
  try {
    const snapshot = await db.collection("salons")
      .where("firebase_uid", "==", uid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Salon not found" });
    }

    const salon = snapshot.docs[0].data();
    
    // Convert timestamps
    const result = { ...salon };
    if (salon.subscription?.expires_at?.toDate) {
      result.subscription.expires_at = salon.subscription.expires_at.toDate().toISOString();
    }
    if (salon.subscription?.trial_end_date?.toDate) {
      result.subscription.trial_end_date = salon.subscription.trial_end_date.toDate().toISOString();
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("Get salon error:", error);
    return res.status(500).json({ error: "Failed to get salon", detail: error.message });
  }
}

async function handleGetSalonStatus(req, res, phone) {
  try {
    const snapshot = await db.collection("salons")
      .where("phone", "==", phone)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ status: "not_found" });
    }

    const salon = snapshot.docs[0].data();
    return res.status(200).json({ 
      status: salon.status,
      salon_id: salon.salon_id,
      salon_name: salon.salon_name
    });
  } catch (error) {
    console.error("Get salon status error:", error);
    return res.status(500).json({ error: "Failed to get salon status" });
  }
}

async function handleSalonDashboardAnalytics(req, res, salonId) {
  try {
    const bookingsSnapshot = await db.collection("bookings")
      .where("salon_id", "==", salonId)
      .get();

    const bookings = bookingsSnapshot.docs.map(d => d.data());
    const now = new Date();
    const today = getTodayStr();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const todayBookings = bookings.filter(b => b.booking_date === today);
    const weekBookings = bookings.filter(b => b.booking_date >= weekAgo);
    const monthBookings = bookings.filter(b => b.booking_date >= monthAgo);

    const todayRevenue = todayBookings.filter(b => b.status === "completed").reduce((s, b) => s + safeNum(b.service_price), 0);
    const weekRevenue = weekBookings.filter(b => b.status === "completed").reduce((s, b) => s + safeNum(b.service_price), 0);
    const monthRevenue = monthBookings.filter(b => b.status === "completed").reduce((s, b) => s + safeNum(b.service_price), 0);

    // Unique customers
    const customerPhones = new Set(bookings.map(b => b.customer_phone));
    const repeatCustomers = {};
    bookings.forEach(b => {
      repeatCustomers[b.customer_phone] = (repeatCustomers[b.customer_phone] || 0) + 1;
    });
    const repeatCount = Object.values(repeatCustomers).filter(c => c > 1).length;

    // Popular services
    const serviceCounts = {};
    bookings.forEach(b => {
      if (b.service_name) {
        serviceCounts[b.service_name] = (serviceCounts[b.service_name] || 0) + 1;
      }
    });
    const popularServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Peak hours
    const hourCounts = {};
    bookings.forEach(b => {
      if (b.slot_time) {
        const hour = b.slot_time.split(":")[0] + ":00";
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour, count }));

    return res.status(200).json({
      today: { bookings: todayBookings.length, revenue: todayRevenue },
      week: { bookings: weekBookings.length, revenue: weekRevenue },
      month: { bookings: monthBookings.length, revenue: monthRevenue },
      customers: {
        total: customerPhones.size,
        repeat: repeatCount,
        repeat_rate: customerPhones.size > 0 ? Math.round((repeatCount / customerPhones.size) * 100) : 0
      },
      popular_services: popularServices,
      peak_hours: peakHours
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return res.status(200).json({
      today: { bookings: 0, revenue: 0 },
      week: { bookings: 0, revenue: 0 },
      month: { bookings: 0, revenue: 0 },
      customers: { total: 0, repeat: 0, repeat_rate: 0 },
      popular_services: [],
      peak_hours: []
    });
  }
}

async function handleToggleSalonStatus(req, res, salonId) {
  try {
    const { is_open, auto_close_enabled } = req.body;
    
    await db.collection("salons").doc(salonId).update({
      current_status: is_open ? "open" : "closed",
      auto_close_enabled: auto_close_enabled !== false
    });

    return res.status(200).json({ message: "Status updated" });
  } catch (error) {
    console.error("Toggle status error:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
}

async function handleUpdateSalonHours(req, res, salonId) {
  try {
    const { opening_time, closing_time } = req.body;
    
    await db.collection("salons").doc(salonId).update({
      opening_time: opening_time || "09:00",
      closing_time: closing_time || "20:00"
    });

    return res.status(200).json({ message: "Hours updated" });
  } catch (error) {
    console.error("Update hours error:", error);
    return res.status(500).json({ error: "Failed to update hours" });
  }
}

async function handleUpdateSalonLocation(req, res, salonId) {
  try {
    const { latitude, longitude } = req.body;
    
    await db.collection("salons").doc(salonId).update({
      latitude: safeNum(latitude),
      longitude: safeNum(longitude),
      location: {
        type: "Point",
        coordinates: [safeNum(longitude), safeNum(latitude)]
      }
    });

    return res.status(200).json({ message: "Location updated" });
  } catch (error) {
    console.error("Update location error:", error);
    return res.status(500).json({ error: "Failed to update location" });
  }
}

async function handleSaveBankDetails(req, res, salonId) {
  try {
    const bankDetails = req.body;
    
    await db.collection("salons").doc(salonId).update({
      bank_details: bankDetails
    });

    return res.status(200).json({ message: "Bank details saved" });
  } catch (error) {
    console.error("Save bank details error:", error);
    return res.status(500).json({ error: "Failed to save bank details" });
  }
}

async function handleUploadSalonPhoto(req, res, salonId) {
  try {
    const { photo_url } = req.body;
    
    await db.collection("salons").doc(salonId).update({
      photo_url: photo_url
    });

    return res.status(200).json({ message: "Photo uploaded" });
  } catch (error) {
    console.error("Upload photo error:", error);
    return res.status(500).json({ error: "Failed to upload photo" });
  }
}

async function handleUploadGallery(req, res, salonId) {
  try {
    const { photos } = req.body;
    const now = admin.firestore.Timestamp.now();
    
    const galleryItems = photos.map((url, idx) => ({
      id: generateId(),
      url: url,
      uploaded_at: now
    }));

    await db.collection("salons").doc(salonId).update({
      photo_gallery: admin.firestore.FieldValue.arrayUnion(...galleryItems)
    });

    return res.status(200).json({ message: "Gallery updated" });
  } catch (error) {
    console.error("Upload gallery error:", error);
    return res.status(500).json({ error: "Failed to upload gallery" });
  }
}

async function handleCheckAutoClose(req, res, salonId) {
  try {
    const salonDoc = await db.collection("salons").doc(salonId).get();
    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salon not found" });
    }

    const salon = salonDoc.data();
    const today = getTodayStr();
    
    // Get today's confirmed bookings
    const bookingsSnapshot = await db.collection("bookings")
      .where("salon_id", "==", salonId)
      .where("booking_date", "==", today)
      .where("status", "==", "confirmed")
      .get();

    const todayBookings = bookingsSnapshot.docs.length;
    const maxSlots = safeNum(salon.staff_count, 1) * 12; // Approximate max slots

    if (todayBookings >= maxSlots && salon.auto_close_enabled !== false) {
      await db.collection("salons").doc(salonId).update({
        current_status: "fully_booked"
      });
      return res.status(200).json({ auto_closed: true, reason: "fully_booked" });
    }

    return res.status(200).json({ auto_closed: false });
  } catch (error) {
    console.error("Auto-close check error:", error);
    return res.status(200).json({ auto_closed: false });
  }
}

async function handleGetSalonSlots(req, res, salonId) {
  try {
    const { date } = req.query;
    const targetDate = date || getTodayStr();

    const salonDoc = await db.collection("salons").doc(salonId).get();
    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salon not found", available_slots: [] });
    }

    const salon = salonDoc.data();
    
    // Handle different formats of opening_time and closing_time
    let openTime = salon.opening_time || salon.openingTime || "09:00";
    let closeTime = salon.closing_time || salon.closingTime || "20:00";
    
    // If it's an object with toDate, it might be a Timestamp - convert it
    if (typeof openTime === 'object' && openTime.toDate) {
      const d = openTime.toDate();
      openTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (typeof closeTime === 'object' && closeTime.toDate) {
      const d = closeTime.toDate();
      closeTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Ensure strings
    openTime = String(openTime);
    closeTime = String(closeTime);
    
    const avgTime = safeNum(salon.avg_service_time || salon.avgServiceTime, 30);
    const staffCount = safeNum(salon.staff_count || salon.staffCount, 1);

    // Get booked slots
    const bookingsSnapshot = await db.collection("bookings")
      .where("salon_id", "==", salonId)
      .where("booking_date", "==", targetDate)
      .where("status", "in", ["confirmed", "pending"])
      .get();

    const bookedSlots = {};
    bookingsSnapshot.forEach(doc => {
      const b = doc.data();
      bookedSlots[b.slot_time] = (bookedSlots[b.slot_time] || 0) + 1;
    });

    // Get locked slots
    let lockedSlots = {};
    try {
      const lockedSnapshot = await db.collection("slot_locks")
        .where("salon_id", "==", salonId)
        .where("date", "==", targetDate)
        .where("expires_at", ">", admin.firestore.Timestamp.now())
        .get();

      lockedSnapshot.forEach(doc => {
        const l = doc.data();
        lockedSlots[l.slot_time] = (lockedSlots[l.slot_time] || 0) + 1;
      });
    } catch (lockError) {
      console.log("Slot locks query failed (index may not exist):", lockError.message);
    }

    // Generate slots
    const slots = [];
    const timeParts = openTime.split(":");
    const closeTimeParts = closeTime.split(":");
    const openH = parseInt(timeParts[0]) || 9;
    const openM = parseInt(timeParts[1]) || 0;
    const closeH = parseInt(closeTimeParts[0]) || 20;
    const closeM = parseInt(closeTimeParts[1]) || 0;
    
    let currentMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    while (currentMinutes < closeMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const min = currentMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
      
      const booked = safeNum(bookedSlots[timeStr]);
      const locked = safeNum(lockedSlots[timeStr]);
      const available = Math.max(0, staffCount - booked - locked);

      slots.push({
        time: timeStr,
        available: available,
        total: staffCount,
        booked: booked
      });

      currentMinutes += avgTime;
    }

    return res.status(200).json({
      available_slots: slots,
      date: targetDate,
      salon_id: salonId
    });
  } catch (error) {
    console.error("Get slots error:", error);
    return res.status(200).json({ available_slots: [] });
  }
}

async function handleGetSalonReviews(req, res, salonId) {
  try {
    const snapshot = await db.collection("reviews")
      .where("salon_id", "==", salonId)
      .orderBy("created_at", "desc")
      .limit(50)
      .get();

    const reviews = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        created_at: data.created_at?.toDate?.() ? data.created_at.toDate().toISOString() : null
      };
    });

    return res.status(200).json(reviews);
  } catch (error) {
    console.error("Get reviews error:", error);
    return res.status(200).json([]);
  }
}

// ==================== SALONS (PLURAL) HANDLERS ====================

async function handleGetNearbySalons(req, res) {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng parameters are required" });
    }

    const snapshot = await db.collection("salons")
      .where("status", "==", "approved")
      .get();

    const salons = [];
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    snapshot.forEach(doc => {
      const salon = doc.data();
      const salonLat = safeNum(salon.latitude);
      const salonLng = safeNum(salon.longitude);
      
      // Haversine formula
      const R = 6371;
      const dLat = (salonLat - userLat) * Math.PI / 180;
      const dLon = (salonLng - userLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(salonLat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      if (distance <= radiusKm) {
        salons.push({ 
          ...salon, 
          distance: distance.toFixed(2),
          rating: safeNum(salon.rating, 4.0),
          review_count: safeNum(salon.review_count, 0)
        });
      }
    });

    salons.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

    return res.status(200).json(salons);
  } catch (error) {
    console.error("Get nearby salons error:", error);
    return res.status(200).json([]);
  }
}

async function handleGetTrendingSalons(req, res) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    // Get recent bookings
    const bookingsSnapshot = await db.collection("bookings")
      .where("booking_date", ">=", weekAgo)
      .get();

    const salonBookings = {};
    bookingsSnapshot.forEach(doc => {
      const b = doc.data();
      salonBookings[b.salon_id] = (salonBookings[b.salon_id] || 0) + 1;
    });

    // Get top salons by bookings
    const topSalonIds = Object.entries(salonBookings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    if (topSalonIds.length === 0) {
      // Return any approved salons
      const snapshot = await db.collection("salons")
        .where("status", "==", "approved")
        .limit(10)
        .get();
      
      return res.status(200).json(snapshot.docs.map(d => ({
        ...d.data(),
        trending_score: 0
      })));
    }

    const salons = [];
    for (const id of topSalonIds) {
      const doc = await db.collection("salons").doc(id).get();
      if (doc.exists && doc.data().status === "approved") {
        salons.push({
          ...doc.data(),
          trending_score: salonBookings[id]
        });
      }
    }

    return res.status(200).json(salons);
  } catch (error) {
    console.error("Get trending salons error:", error);
    return res.status(200).json([]);
  }
}

async function handleGetRecommendedSalons(req, res) {
  try {
    const { customer_phone } = req.query;

    // Get customer's booking history
    const bookingsSnapshot = await db.collection("bookings")
      .where("customer_phone", "==", customer_phone)
      .get();

    const visitedSalons = new Set();
    const preferredServices = {};

    bookingsSnapshot.forEach(doc => {
      const b = doc.data();
      visitedSalons.add(b.salon_id);
      if (b.service_name) {
        preferredServices[b.service_name] = (preferredServices[b.service_name] || 0) + 1;
      }
    });

    // Get approved salons
    const snapshot = await db.collection("salons")
      .where("status", "==", "approved")
      .limit(20)
      .get();

    const salons = snapshot.docs.map(d => ({
      ...d.data(),
      visited: visitedSalons.has(d.data().salon_id),
      rating: safeNum(d.data().rating, 4.0)
    }));

    // Sort: visited first, then by rating
    salons.sort((a, b) => {
      if (a.visited && !b.visited) return -1;
      if (!a.visited && b.visited) return 1;
      return b.rating - a.rating;
    });

    return res.status(200).json(salons.slice(0, 10));
  } catch (error) {
    console.error("Get recommended salons error:", error);
    return res.status(200).json([]);
  }
}

// ==================== SEARCH HANDLERS ====================

async function handleSearch(req, res) {
  try {
    const { q, lat, lng } = req.query;
    const searchTerm = (q || "").toLowerCase();

    const snapshot = await db.collection("salons")
      .where("status", "==", "approved")
      .get();

    let salons = snapshot.docs.map(d => d.data());

    // Filter by search term
    if (searchTerm) {
      salons = salons.filter(s => 
        (s.salon_name || "").toLowerCase().includes(searchTerm) ||
        (s.area || "").toLowerCase().includes(searchTerm) ||
        (s.services || []).some(svc => (svc.name || "").toLowerCase().includes(searchTerm))
      );
    }

    // Add distance if lat/lng provided
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      salons = salons.map(salon => {
        const salonLat = safeNum(salon.latitude);
        const salonLng = safeNum(salon.longitude);
        
        const R = 6371;
        const dLat = (salonLat - userLat) * Math.PI / 180;
        const dLon = (salonLng - userLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userLat * Math.PI / 180) * Math.cos(salonLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        return { ...salon, distance: distance.toFixed(2) };
      });

      salons.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    }

    return res.status(200).json(salons.slice(0, 20));
  } catch (error) {
    console.error("Search error:", error);
    return res.status(200).json([]);
  }
}

// ==================== BOOKING HANDLERS ====================

async function handleCreateBooking(req, res) {
  try {
    const data = req.body;
    const now = admin.firestore.Timestamp.now();
    const bookingId = generateId();
    const approvalExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Check for double booking
    const existingSnapshot = await db.collection("bookings")
      .where("salon_id", "==", data.salon_id)
      .where("booking_date", "==", data.booking_date)
      .where("slot_time", "==", data.slot_time)
      .where("status", "in", ["confirmed", "pending"])
      .get();

    // Get salon's staff count
    const salonDoc = await db.collection("salons").doc(data.salon_id).get();
    const staffCount = salonDoc.exists ? safeNum(salonDoc.data().staff_count, 1) : 1;

    if (existingSnapshot.size >= staffCount) {
      return res.status(400).json({ error: "Slot is fully booked" });
    }

    const bookingData = {
      booking_id: bookingId,
      salon_id: data.salon_id,
      salon_name: data.salon_name || "",
      customer_name: data.customer_name || "",
      customer_phone: data.customer_phone || "",
      service_name: data.service_name || "",
      service_price: safeNum(data.service_price),
      booking_date: data.booking_date,
      slot_time: data.slot_time,
      status: "pending",
      payment_method: data.payment_method || "pay_at_salon",
      payment_status: data.payment_method === "online" ? "pending" : "pending_at_salon",
      created_at: now,
      approval_expires_at: admin.firestore.Timestamp.fromDate(approvalExpires)
    };

    await db.collection("bookings").doc(bookingId).set(bookingData);

    // Release any slot lock
    const lockSnapshot = await db.collection("slot_locks")
      .where("salon_id", "==", data.salon_id)
      .where("date", "==", data.booking_date)
      .where("slot_time", "==", data.slot_time)
      .where("customer_phone", "==", data.customer_phone)
      .get();

    const batch = db.batch();
    lockSnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return res.status(200).json({
      message: "Booking created. Waiting for salon approval.",
      booking_id: bookingId
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return res.status(500).json({ error: "Failed to create booking", detail: error.message });
  }
}

async function handleCheckSpam(req, res) {
  try {
    const { customer_phone } = req.body;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const snapshot = await db.collection("bookings")
      .where("customer_phone", "==", customer_phone)
      .where("created_at", ">=", admin.firestore.Timestamp.fromDate(fiveMinutesAgo))
      .get();

    const recentBookings = snapshot.size;
    const isSpam = recentBookings >= 3;

    return res.status(200).json({
      is_spam: isSpam,
      recent_bookings: recentBookings,
      message: isSpam ? "Too many bookings. Please wait 5 minutes." : "OK"
    });
  } catch (error) {
    console.error("Check spam error:", error);
    return res.status(200).json({ is_spam: false, recent_bookings: 0 });
  }
}

async function handleApproveBooking(req, res, bookingId) {
  try {
    const doc = await db.collection("bookings").doc(bookingId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = doc.data();
    
    // Check if already processed
    if (booking.status !== "pending") {
      return res.status(400).json({ error: `Booking already ${booking.status}` });
    }

    // Check if expired
    if (booking.approval_expires_at?.toDate() < new Date()) {
      await db.collection("bookings").doc(bookingId).update({
        status: "expired"
      });
      return res.status(400).json({ error: "Booking approval window expired" });
    }

    await db.collection("bookings").doc(bookingId).update({
      status: "confirmed",
      confirmed_at: admin.firestore.Timestamp.now()
    });

    // Update salon stats
    await db.collection("salons").doc(booking.salon_id).update({
      total_bookings: admin.firestore.FieldValue.increment(1)
    });

    return res.status(200).json({ message: "Booking confirmed" });
  } catch (error) {
    console.error("Approve booking error:", error);
    return res.status(500).json({ error: "Failed to approve booking" });
  }
}

async function handleRejectBooking(req, res, bookingId) {
  try {
    const { reason } = req.query;
    
    await db.collection("bookings").doc(bookingId).update({
      status: "rejected",
      rejection_reason: reason || "Salon unavailable",
      rejected_at: admin.firestore.Timestamp.now()
    });

    return res.status(200).json({ message: "Booking rejected" });
  } catch (error) {
    console.error("Reject booking error:", error);
    return res.status(500).json({ error: "Failed to reject booking" });
  }
}

async function handleCancelBooking(req, res, bookingId) {
  try {
    await db.collection("bookings").doc(bookingId).update({
      status: "cancelled",
      cancelled_at: admin.firestore.Timestamp.now()
    });

    return res.status(200).json({ message: "Booking cancelled" });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return res.status(500).json({ error: "Failed to cancel booking" });
  }
}

async function handleGetPendingBookings(req, res, salonId) {
  try {
    const snapshot = await db.collection("bookings")
      .where("salon_id", "==", salonId)
      .where("status", "==", "pending")
      .orderBy("created_at", "desc")
      .get();

    const bookings = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        approval_expires_at: data.approval_expires_at?.toDate?.() 
          ? data.approval_expires_at.toDate().toISOString() 
          : null
      };
    });

    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Get pending bookings error:", error);
    return res.status(200).json([]);
  }
}

async function handleGetSalonBookings(req, res, salonId) {
  try {
    const snapshot = await db.collection("bookings")
      .where("salon_id", "==", salonId)
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    const bookings = snapshot.docs.map(doc => doc.data());
    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Get salon bookings error:", error);
    return res.status(200).json([]);
  }
}

async function handleGetCustomerBookings(req, res, phone) {
  try {
    const snapshot = await db.collection("bookings")
      .where("customer_phone", "==", phone)
      .orderBy("created_at", "desc")
      .limit(50)
      .get();

    const bookings = snapshot.docs.map(doc => doc.data());
    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Get customer bookings error:", error);
    return res.status(200).json([]);
  }
}

async function handleGetUpcomingReminders(req, res, phone) {
  try {
    const today = getTodayStr();
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const laterTime = `${oneHourLater.getHours().toString().padStart(2, "0")}:${oneHourLater.getMinutes().toString().padStart(2, "0")}`;

    const snapshot = await db.collection("bookings")
      .where("customer_phone", "==", phone)
      .where("booking_date", "==", today)
      .where("status", "==", "confirmed")
      .get();

    const upcomingBookings = snapshot.docs
      .map(doc => doc.data())
      .filter(b => b.slot_time >= currentTime && b.slot_time <= laterTime);

    return res.status(200).json(upcomingBookings);
  } catch (error) {
    console.error("Get upcoming reminders error:", error);
    return res.status(200).json([]);
  }
}

// ==================== SLOT HANDLERS ====================

async function handleLockSlot(req, res) {
  try {
    const { salon_id, date, slot_time, customer_phone, booking_date } = req.body;
    const targetDate = date || booking_date; // Support both field names
    
    if (!salon_id || !targetDate || !slot_time) {
      return res.status(400).json({ 
        locked: false, 
        message: "salon_id, date/booking_date, and slot_time are required" 
      });
    }
    
    // Check if slot is already booked
    const salonDoc = await db.collection("salons").doc(salon_id).get();
    const staffCount = salonDoc.exists ? safeNum(salonDoc.data().staff_count || salonDoc.data().staffCount, 1) : 1;
    
    // Count existing bookings
    let existingBookingsCount = 0;
    try {
      const existingBookings = await db.collection("bookings")
        .where("salon_id", "==", salon_id)
        .where("booking_date", "==", targetDate)
        .where("slot_time", "==", slot_time)
        .where("status", "in", ["confirmed", "pending"])
        .get();
      existingBookingsCount = existingBookings.size;
    } catch (e) {
      console.log("Bookings query error:", e.message);
    }
    
    // Count existing locks (simplified query to avoid index requirement)
    let existingLocksCount = 0;
    try {
      const allLocks = await db.collection("slot_locks")
        .where("salon_id", "==", salon_id)
        .where("date", "==", targetDate)
        .where("slot_time", "==", slot_time)
        .get();
      
      const now = Date.now();
      allLocks.forEach(doc => {
        const lock = doc.data();
        const expiresAt = lock.expires_at?.toDate?.() || new Date(0);
        if (expiresAt.getTime() > now) {
          existingLocksCount++;
        }
      });
    } catch (e) {
      console.log("Locks query error:", e.message);
    }
    
    const totalOccupied = existingBookingsCount + existingLocksCount;
    
    if (totalOccupied >= staffCount) {
      return res.status(200).json({
        locked: false,
        message: "Slot is no longer available"
      });
    }
    
    const lockId = generateId();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes lock

    await db.collection("slot_locks").doc(lockId).set({
      lock_id: lockId,
      salon_id,
      date: targetDate,
      slot_time,
      customer_phone: customer_phone || "",
      created_at: admin.firestore.Timestamp.now(),
      expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
    });

    return res.status(200).json({
      locked: true,
      message: "Slot locked for 5 minutes",
      lock_id: lockId,
      expires_at: expiresAt.toISOString()
    });
  } catch (error) {
    console.error("Lock slot error:", error);
    return res.status(500).json({ locked: false, error: "Failed to lock slot", detail: error.message });
  }
}

// ==================== REVIEW HANDLERS ====================

async function handleCreateReview(req, res) {
  try {
    const data = req.body;
    const now = admin.firestore.Timestamp.now();
    const reviewId = generateId();

    // Check if customer already reviewed this salon
    const existingSnapshot = await db.collection("reviews")
      .where("salon_id", "==", data.salon_id)
      .where("customer_phone", "==", data.customer_phone)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Update existing review
      const existingDoc = existingSnapshot.docs[0];
      await existingDoc.ref.update({
        rating: safeNum(data.rating, 5),
        review_text: data.review_text || "",
        updated_at: now
      });
    } else {
      // Create new review
      await db.collection("reviews").doc(reviewId).set({
        review_id: reviewId,
        salon_id: data.salon_id,
        customer_phone: data.customer_phone,
        customer_name: data.customer_name || "",
        rating: safeNum(data.rating, 5),
        review_text: data.review_text || "",
        created_at: now
      });
    }

    // Update salon average rating
    const reviewsSnapshot = await db.collection("reviews")
      .where("salon_id", "==", data.salon_id)
      .get();

    let totalRating = 0;
    let count = 0;
    reviewsSnapshot.forEach(doc => {
      totalRating += safeNum(doc.data().rating);
      count++;
    });

    const avgRating = count > 0 ? (totalRating / count).toFixed(1) : 4.0;

    await db.collection("salons").doc(data.salon_id).update({
      rating: parseFloat(avgRating),
      review_count: count
    });

    return res.status(200).json({ message: "Review saved" });
  } catch (error) {
    console.error("Create review error:", error);
    return res.status(500).json({ error: "Failed to save review" });
  }
}

// ==================== CUSTOMER HANDLERS ====================

async function handleGetServiceReminders(req, res, phone) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const snapshot = await db.collection("bookings")
      .where("customer_phone", "==", phone)
      .where("status", "==", "completed")
      .where("booking_date", "<", thirtyDaysAgo)
      .orderBy("booking_date", "desc")
      .limit(5)
      .get();

    const reminders = snapshot.docs.map(doc => {
      const data = doc.data();
      const daysSince = Math.floor((Date.now() - new Date(data.booking_date).getTime()) / (24 * 60 * 60 * 1000));
      return {
        ...data,
        days_since_visit: daysSince,
        reminder_message: `It's been ${daysSince} days since your last ${data.service_name} at ${data.salon_name}`
      };
    });

    return res.status(200).json(reminders);
  } catch (error) {
    console.error("Get service reminders error:", error);
    return res.status(200).json([]);
  }
}

async function handleGetFavorites(req, res, uid) {
  try {
    const userDoc = await db.collection("users_favorites").doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(200).json([]);
    }

    const favoriteIds = userDoc.data().salon_ids || [];
    
    if (favoriteIds.length === 0) {
      return res.status(200).json([]);
    }

    const salons = [];
    for (const id of favoriteIds.slice(0, 20)) {
      const doc = await db.collection("salons").doc(id).get();
      if (doc.exists) {
        salons.push(doc.data());
      }
    }

    return res.status(200).json(salons);
  } catch (error) {
    console.error("Get favorites error:", error);
    return res.status(200).json([]);
  }
}

async function handleToggleFavorite(req, res, uid, salonId) {
  try {
    const userRef = db.collection("users_favorites").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({ salon_ids: [salonId] });
      return res.status(200).json({ added: true });
    }

    const favorites = userDoc.data().salon_ids || [];
    
    if (favorites.includes(salonId)) {
      await userRef.update({
        salon_ids: admin.firestore.FieldValue.arrayRemove(salonId)
      });
      return res.status(200).json({ added: false });
    } else {
      await userRef.update({
        salon_ids: admin.firestore.FieldValue.arrayUnion(salonId)
      });
      return res.status(200).json({ added: true });
    }
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return res.status(500).json({ error: "Failed to toggle favorite" });
  }
}

// ==================== COMMISSION HANDLERS (backward compat) ====================

async function handleGetSalonCommission(req, res, salonId) {
  // 0% commission - return empty data
  return res.status(200).json({
    commission_rate: 0,
    current_month_ledger: null,
    message: "0% commission - salon receives 100% revenue"
  });
}

// ==================== ADMIN HANDLERS ====================

async function handleAdminAnalytics(req, res) {
  try {
    const [salonsSnapshot, bookingsSnapshot] = await Promise.all([
      db.collection("salons").where("status", "==", "approved").get(),
      db.collection("bookings").get()
    ]);

    const totalSalons = salonsSnapshot.size;
    const totalBookings = bookingsSnapshot.size;
    
    let totalRevenue = 0;
    bookingsSnapshot.forEach(doc => {
      const b = doc.data();
      if (b.status === "completed") {
        totalRevenue += safeNum(b.service_price);
      }
    });

    return res.status(200).json({
      total_salons: totalSalons,
      total_bookings: totalBookings,
      total_revenue: totalRevenue,
      platform_earnings: 0 // 0% commission
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return res.status(200).json({
      total_salons: 0,
      total_bookings: 0,
      total_revenue: 0,
      platform_earnings: 0
    });
  }
}

async function handleAdminAnalyticsDetailed(req, res) {
  try {
    const now = new Date();
    const today = getTodayStr();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [bookingsSnapshot, usersSnapshot] = await Promise.all([
      db.collection("bookings").get(),
      db.collection("users").get()
    ]);

    const bookings = bookingsSnapshot.docs.map(d => d.data());
    
    const todayBookings = bookings.filter(b => b.booking_date === today).length;
    const weekBookings = bookings.filter(b => b.booking_date >= weekAgo).length;
    const monthBookings = bookings.filter(b => b.booking_date >= monthAgo).length;

    return res.status(200).json({
      today_bookings: todayBookings,
      week_bookings: weekBookings,
      month_bookings: monthBookings,
      total_customers: usersSnapshot.size
    });
  } catch (error) {
    console.error("Admin detailed analytics error:", error);
    return res.status(200).json({
      today_bookings: 0,
      week_bookings: 0,
      month_bookings: 0,
      total_customers: 0
    });
  }
}

async function handleAdminGetSalons(req, res) {
  try {
    const snapshot = await db.collection("salons").get();
    const salons = snapshot.docs.map(doc => doc.data());
    return res.status(200).json(salons);
  } catch (error) {
    console.error("Admin get salons error:", error);
    return res.status(200).json([]);
  }
}

async function handleAdminSalonsSummary(req, res) {
  try {
    const [salonsSnapshot, bookingsSnapshot] = await Promise.all([
      db.collection("salons").get(),
      db.collection("bookings").get()
    ]);

    const salonStats = {};
    salonsSnapshot.forEach(doc => {
      const salon = doc.data();
      salonStats[salon.salon_id] = {
        ...salon,
        total_bookings: 0,
        total_revenue: 0
      };
    });

    bookingsSnapshot.forEach(doc => {
      const b = doc.data();
      if (salonStats[b.salon_id]) {
        salonStats[b.salon_id].total_bookings++;
        if (b.status === "completed") {
          salonStats[b.salon_id].total_revenue += safeNum(b.service_price);
        }
      }
    });

    return res.status(200).json(Object.values(salonStats));
  } catch (error) {
    console.error("Admin salons summary error:", error);
    return res.status(200).json([]);
  }
}

async function handleAdminGetAllBookings(req, res) {
  try {
    const snapshot = await db.collection("bookings")
      .orderBy("created_at", "desc")
      .limit(200)
      .get();

    const bookings = snapshot.docs.map(doc => doc.data());
    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Admin get all bookings error:", error);
    return res.status(200).json([]);
  }
}

async function handleAdminUserAnalytics(req, res) {
  try {
    const now = new Date();
    const today = getTodayStr();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [usersSnapshot, salonsSnapshot, bookingsSnapshot] = await Promise.all([
      db.collection("users").get(),
      db.collection("salons").get(),
      db.collection("bookings").get()
    ]);

    const users = usersSnapshot.docs.map(d => d.data());
    const salons = salonsSnapshot.docs.map(d => d.data());
    const bookings = bookingsSnapshot.docs.map(d => d.data());

    // User stats
    const totalCustomers = users.filter(u => u.role === "customer" || !u.role).length;
    const totalPartners = salons.length;
    const totalSalons = salons.filter(s => s.status === "approved").length;

    const activeCustomers = users.filter(u => {
      const lastLogin = u.last_login_at?.toDate ? u.last_login_at.toDate() : new Date(0);
      return lastLogin >= weekAgo;
    }).length;

    const newThisWeek = users.filter(u => {
      const created = u.created_at?.toDate ? u.created_at.toDate() : new Date(0);
      return created >= weekAgo;
    }).length;

    const newToday = users.filter(u => {
      const created = u.created_at?.toDate ? u.created_at.toDate() : null;
      return created && created.toISOString().split("T")[0] === today;
    }).length;

    const newSalonsWeek = salons.filter(s => {
      const created = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(0);
      return created >= weekAgo;
    }).length;

    // Booking stats
    const completedBookings = bookings.filter(b => b.status === "completed").length;
    const cancelledBookings = bookings.filter(b => b.status === "cancelled").length;
    const completionRate = bookings.length > 0 
      ? Math.round((completedBookings / bookings.length) * 100) 
      : 0;

    // Revenue
    let totalRevenue = 0;
    bookings.forEach(b => {
      if (b.status === "completed") {
        totalRevenue += safeNum(b.service_price);
      }
    });

    // Top salons
    const salonBookingCounts = {};
    const salonRevenue = {};
    bookings.forEach(b => {
      salonBookingCounts[b.salon_id] = (salonBookingCounts[b.salon_id] || 0) + 1;
      if (b.status === "completed") {
        salonRevenue[b.salon_id] = (salonRevenue[b.salon_id] || 0) + safeNum(b.service_price);
      }
    });

    const topSalons = salons
      .map(s => ({
        salon_id: s.salon_id,
        salon_name: s.salon_name,
        bookings: salonBookingCounts[s.salon_id] || 0,
        revenue: salonRevenue[s.salon_id] || 0
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10);

    return res.status(200).json({
      users: {
        total_customers: totalCustomers,
        total_partners: totalPartners,
        total_salons: totalSalons,
        active_customers: activeCustomers,
        new_this_week: newThisWeek,
        new_today: newToday,
        new_salons_week: newSalonsWeek
      },
      bookings: {
        total: bookings.length,
        completed: completedBookings,
        cancelled: cancelledBookings,
        completion_rate: completionRate
      },
      revenue: {
        total: totalRevenue,
        platform_earnings: 0 // 0% commission
      },
      top_salons: topSalons
    });
  } catch (error) {
    console.error("Admin user analytics error:", error);
    return res.status(200).json({
      users: { total_customers: 0, total_partners: 0, total_salons: 0, active_customers: 0, new_this_week: 0, new_today: 0, new_salons_week: 0 },
      bookings: { total: 0, completed: 0, cancelled: 0, completion_rate: 0 },
      revenue: { total: 0, platform_earnings: 0 },
      top_salons: []
    });
  }
}

async function handleAdminLoginStats(req, res) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const usersSnapshot = await db.collection("users").get();
    
    let total_users = 0;
    let today_logins = 0;
    let weekly_logins = 0;
    let monthly_logins = 0;

    usersSnapshot.forEach(doc => {
      total_users++;
      const user = doc.data();
      const lastLogin = user.last_login_at?.toDate ? user.last_login_at.toDate() : new Date(0);
      
      if (lastLogin >= todayStart) today_logins++;
      if (lastLogin >= weekAgo) weekly_logins++;
      if (lastLogin >= monthAgo) monthly_logins++;
    });

    return res.status(200).json({
      total_users,
      today_logins,
      weekly_logins,
      monthly_logins
    });
  } catch (error) {
    console.error("Admin login stats error:", error);
    return res.status(200).json({
      total_users: 0,
      today_logins: 0,
      weekly_logins: 0,
      monthly_logins: 0
    });
  }
}

async function handleAdminCommissionSummary(req, res) {
  // 0% commission
  return res.status(200).json({
    commission_rate: 0,
    total_collected: 0,
    pending_collection: 0,
    message: "0% platform commission - salons receive 100% revenue"
  });
}

async function handleAdminApproveSalon(req, res, salonId) {
  try {
    const now = admin.firestore.Timestamp.now();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    await db.collection("salons").doc(salonId).update({
      status: "approved",
      approved_at: now,
      trialStartDate: now,
      trialEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
      subscriptionStatus: "trial",
      "subscription.trial_start_date": now,
      "subscription.trial_end_date": admin.firestore.Timestamp.fromDate(trialEndDate),
      "subscription.expires_at": admin.firestore.Timestamp.fromDate(trialEndDate)
    });

    return res.status(200).json({ message: "Salon approved. 1-month free trial started." });
  } catch (error) {
    console.error("Admin approve salon error:", error);
    return res.status(500).json({ error: "Failed to approve salon" });
  }
}

async function handleAdminBlockSalon(req, res, salonId) {
  try {
    const { reason } = req.query;
    
    await db.collection("salons").doc(salonId).update({
      status: "blocked",
      blocked_at: admin.firestore.Timestamp.now(),
      block_reason: reason || "manual"
    });

    return res.status(200).json({ message: "Salon blocked" });
  } catch (error) {
    console.error("Admin block salon error:", error);
    return res.status(500).json({ error: "Failed to block salon" });
  }
}

async function handleAdminUnblockSalon(req, res, salonId) {
  try {
    await db.collection("salons").doc(salonId).update({
      status: "approved",
      blocked_at: admin.firestore.FieldValue.delete(),
      block_reason: admin.firestore.FieldValue.delete()
    });

    return res.status(200).json({ message: "Salon unblocked" });
  } catch (error) {
    console.error("Admin unblock salon error:", error);
    return res.status(500).json({ error: "Failed to unblock salon" });
  }
}

async function handleAdminSalonAnalytics(req, res, salonId) {
  try {
    const [salonDoc, bookingsSnapshot] = await Promise.all([
      db.collection("salons").doc(salonId).get(),
      db.collection("bookings").where("salon_id", "==", salonId).get()
    ]);

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salon not found" });
    }

    const salon = salonDoc.data();
    const bookings = bookingsSnapshot.docs.map(d => d.data());

    // Unique customers
    const customerPhones = new Set(bookings.map(b => b.customer_phone));

    // Total revenue
    let totalRevenue = 0;
    bookings.forEach(b => {
      if (b.status === "completed") {
        totalRevenue += safeNum(b.service_price);
      }
    });

    // Popular services
    const serviceCounts = {};
    bookings.forEach(b => {
      if (b.service_name) {
        serviceCounts[b.service_name] = (serviceCounts[b.service_name] || 0) + 1;
      }
    });
    const popularServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([_id, count]) => ({ _id, count }));

    // Peak time slots
    const timeCounts = {};
    bookings.forEach(b => {
      if (b.slot_time) {
        timeCounts[b.slot_time] = (timeCounts[b.slot_time] || 0) + 1;
      }
    });
    const peakTimeSlots = Object.entries(timeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([_id, count]) => ({ _id, count }));

    return res.status(200).json({
      salon,
      total_bookings: bookings.length,
      unique_customers: customerPhones.size,
      total_revenue: totalRevenue,
      popular_services: popularServices,
      peak_time_slots: peakTimeSlots
    });
  } catch (error) {
    console.error("Admin salon analytics error:", error);
    return res.status(500).json({ error: "Failed to get salon analytics" });
  }
}

async function handleAdminUpdateBookingStatus(req, res, bookingId) {
  try {
    const { status } = req.query;
    
    const updateData = {
      status: status
    };

    if (status === "completed") {
      updateData.completed_at = admin.firestore.Timestamp.now();
      
      // Update salon revenue
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      if (bookingDoc.exists) {
        const booking = bookingDoc.data();
        await db.collection("salons").doc(booking.salon_id).update({
          total_revenue: admin.firestore.FieldValue.increment(safeNum(booking.service_price))
        });
      }
    }

    await db.collection("bookings").doc(bookingId).update(updateData);

    return res.status(200).json({ message: `Booking marked as ${status}` });
  } catch (error) {
    console.error("Admin update booking status error:", error);
    return res.status(500).json({ error: "Failed to update booking status" });
  }
}

// ==================== FEATURE: 50% DISCOUNT FOR FIRST 100 SALONS ====================

async function handleCheckDiscountEligibility(req, res) {
  try {
    // Count total salons in Firestore
    const salonsSnapshot = await db.collection("salons").get();
    const totalSalons = salonsSnapshot.size;
    
    const isEligible = totalSalons < 100;
    const discountPercent = isEligible ? 50 : 0;
    const slotsRemaining = Math.max(0, 100 - totalSalons);
    
    return res.status(200).json({
      eligible: isEligible,
      discountPercent: discountPercent,
      totalSalons: totalSalons,
      slotsRemaining: slotsRemaining,
      message: isEligible 
        ? `You're eligible for 50% OFF! Only ${slotsRemaining} slots left for this offer.`
        : "The first 100 salons offer has ended."
    });
  } catch (error) {
    console.error("Check discount eligibility error:", error);
    return res.status(500).json({ error: "Failed to check eligibility" });
  }
}

async function handleSalonSubscribe(req, res) {
  try {
    const { salon_id, plan, original_price, payment_id } = req.body;
    
    if (!salon_id || !plan || !original_price) {
      return res.status(400).json({ error: "salon_id, plan, and original_price are required" });
    }
    
    // Check discount eligibility
    const salonsSnapshot = await db.collection("salons").get();
    const totalSalons = salonsSnapshot.size;
    const isEligible = totalSalons < 100;
    const discountPercent = isEligible ? 50 : 0;
    
    // Calculate final price
    const finalPrice = isEligible 
      ? Math.round(original_price * 0.5) 
      : original_price;
    
    const now = admin.firestore.Timestamp.now();
    const planDays = plan === '3_months' ? 90 : 30;
    const expiresAt = new Date(Date.now() + planDays * 24 * 60 * 60 * 1000);
    
    // Update salon subscription
    await db.collection("salons").doc(salon_id).update({
      subscriptionStatus: "active",
      subscription: {
        plan: plan,
        plan_name: plan === '3_months' ? '3 Months Plan' : '1 Month Plan',
        original_price: original_price,
        final_price: finalPrice,
        discountApplied: isEligible,
        discountPercent: discountPercent,
        payment_status: "paid",
        payment_id: payment_id || null,
        purchased_at: now,
        expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
      }
    });
    
    return res.status(200).json({
      message: "Subscription activated successfully",
      subscription: {
        plan: plan,
        original_price: original_price,
        final_price: finalPrice,
        discountApplied: isEligible,
        discountPercent: discountPercent,
        expires_at: expiresAt.toISOString()
      }
    });
  } catch (error) {
    console.error("Salon subscribe error:", error);
    return res.status(500).json({ error: "Failed to process subscription" });
  }
}

// ==================== FEATURE: SALON PROFILE EDIT ====================

async function handleUpdateSalonProfile(req, res) {
  try {
    const data = req.body;
    const { salonId, firebase_uid } = data;
    
    if (!salonId) {
      return res.status(400).json({ error: "salonId is required" });
    }
    
    // Verify salon exists and belongs to user
    const salonDoc = await db.collection("salons").doc(salonId).get();
    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salon not found" });
    }
    
    const existingSalon = salonDoc.data();
    
    // Optional: Verify ownership if firebase_uid is provided
    if (firebase_uid && existingSalon.firebase_uid !== firebase_uid) {
      return res.status(403).json({ error: "Unauthorized: You don't own this salon" });
    }
    
    // Build partial update object - only update provided fields
    const updateData = {};
    
    if (data.name !== undefined && data.name !== null) {
      updateData.salon_name = data.name;
    }
    if (data.address !== undefined && data.address !== null) {
      updateData.address = data.address;
    }
    if (data.area !== undefined && data.area !== null) {
      updateData.area = data.area;
    }
    if (data.phone !== undefined && data.phone !== null) {
      updateData.phone = data.phone;
    }
    if (data.secondary_phone !== undefined && data.secondary_phone !== null) {
      updateData.secondary_phone = data.secondary_phone;
    }
    if (data.services !== undefined && data.services !== null) {
      updateData.services = data.services;
    }
    if (data.image !== undefined && data.image !== null) {
      updateData.photo_url = data.image;
    }
    if (data.staff_count !== undefined && data.staff_count !== null) {
      updateData.staff_count = safeNum(data.staff_count, 1);
    }
    if (data.avg_service_time !== undefined && data.avg_service_time !== null) {
      updateData.avg_service_time = safeNum(data.avg_service_time, 30);
    }
    if (data.business_type !== undefined && data.business_type !== null) {
      updateData.business_type = data.business_type;
    }
    
    // Add updated timestamp
    updateData.updated_at = admin.firestore.Timestamp.now();
    
    // Perform partial update
    await db.collection("salons").doc(salonId).update(updateData);
    
    // Fetch and return updated salon
    const updatedDoc = await db.collection("salons").doc(salonId).get();
    const updatedSalon = updatedDoc.data();
    
    return res.status(200).json({
      message: "Profile updated successfully",
      salon: updatedSalon
    });
  } catch (error) {
    console.error("Update salon profile error:", error);
    return res.status(500).json({ error: "Failed to update profile", detail: error.message });
  }
}


// ==================== FEATURE: CUSTOMER PROFILE EDIT ====================

async function handleUpdateUserProfile(req, res) {
  try {
    const data = req.body;
    const { phone, firebase_uid } = data;
    
    if (!phone && !firebase_uid) {
      return res.status(400).json({ error: "phone or firebase_uid is required" });
    }
    
    const now = admin.firestore.Timestamp.now();
    
    // Find or create user by phone
    let userRef;
    let docId = phone || firebase_uid;
    
    if (phone) {
      userRef = db.collection("users").doc(phone);
    } else {
      const snapshot = await db.collection("users").where("firebase_uid", "==", firebase_uid).limit(1).get();
      if (!snapshot.empty) {
        userRef = snapshot.docs[0].ref;
        docId = snapshot.docs[0].id;
      } else {
        userRef = db.collection("users").doc(firebase_uid);
      }
    }
    
    // Build update data
    const updateData = {
      updated_at: now
    };
    if (phone) updateData.phone = phone;
    if (firebase_uid) updateData.firebase_uid = firebase_uid;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.gender !== undefined) updateData.gender = data.gender;
    
    // Use set with merge to create or update
    await userRef.set(updateData, { merge: true });
    
    const updatedDoc = await userRef.get();
    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedDoc.data()
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    return res.status(500).json({ error: "Failed to update profile", detail: error.message });
  }
}

async function handleGetUserProfile(req, res, phone) {
  try {
    const userDoc = await db.collection("users").doc(phone).get();
    if (!userDoc.exists) {
      return res.status(200).json({ phone, name: "", address: "", email: "" });
    }
    return res.status(200).json(userDoc.data());
  } catch (error) {
    console.error("Get user profile error:", error);
    return res.status(200).json({ phone, name: "", address: "", email: "" });
  }
}

