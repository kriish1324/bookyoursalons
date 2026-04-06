const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const fetch = require("node-fetch");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ==================== SALON REGISTRATION ====================

exports.registerSalon = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const data = req.body;
      const now = admin.firestore.Timestamp.now();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      // Generate salon ID
      const salonId = db.collection("salons").doc().id;

      const salonData = {
        salon_id: salonId,
        salon_name: data.salon_name || "",
        owner_name: data.owner_name || "",
        phone: data.phone || "",
        address: data.address || "",
        area: data.area || "",
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        location: {
          type: "Point",
          coordinates: [data.longitude || 0, data.latitude || 0]
        },
        staff_count: data.staff_count || 1,
        avg_service_time: data.avg_service_time || 30,
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
  });
});

// ==================== REVERSE GEOCODE ====================

exports.geocodeReverse = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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
      return res.status(500).json({ error: "Geocoding failed", detail: error.message });
    }
  });
});

// ==================== GEOCODE SEARCH ====================

exports.geocodeSearch = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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
      return res.status(500).json({ error: "Geocoding search failed", detail: error.message });
    }
  });
});

// ==================== GET NEARBY SALONS ====================

exports.getNearbySalons = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { lat, lng, radius = 5 } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng parameters are required" });
      }

      // Get all approved salons (Firestore doesn't support geo queries easily)
      const snapshot = await db.collection("salons")
        .where("status", "==", "approved")
        .get();

      const salons = [];
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      snapshot.forEach(doc => {
        const salon = doc.data();
        // Calculate distance using Haversine formula
        const salonLat = salon.latitude || 0;
        const salonLng = salon.longitude || 0;
        
        const R = 6371; // Earth's radius in km
        const dLat = (salonLat - userLat) * Math.PI / 180;
        const dLon = (salonLng - userLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userLat * Math.PI / 180) * Math.cos(salonLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance <= radiusKm) {
          salons.push({ ...salon, distance: distance.toFixed(2) });
        }
      });

      // Sort by distance
      salons.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

      return res.status(200).json(salons);
    } catch (error) {
      console.error("Get nearby salons error:", error);
      return res.status(500).json({ error: "Failed to fetch salons", detail: error.message });
    }
  });
});

// ==================== TRACK USER LOGIN ====================

exports.trackLogin = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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
  });
});

// ==================== GET LOGIN STATS ====================

exports.getLoginStats = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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
      console.error("Get login stats error:", error);
      return res.status(500).json({ error: "Failed to get stats", detail: error.message });
    }
  });
});

// ==================== API ROUTER ====================

exports.api = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const path = req.path.replace(/^\/api/, "");
    
    // Route to appropriate handler
    if (path === "/salon/register" && req.method === "POST") {
      return exports.registerSalon(req, res);
    }
    if (path === "/geocode/reverse" && req.method === "GET") {
      return exports.geocodeReverse(req, res);
    }
    if (path === "/geocode/search" && req.method === "GET") {
      return exports.geocodeSearch(req, res);
    }
    if (path === "/salons/nearby" && req.method === "GET") {
      return exports.getNearbySalons(req, res);
    }
    if (path === "/auth/track-login" && req.method === "POST") {
      return exports.trackLogin(req, res);
    }
    if (path === "/admin/login-stats" && req.method === "GET") {
      return exports.getLoginStats(req, res);
    }
    if (path === "/" || path === "") {
      return res.status(200).json({ message: "BookYourSalons API" });
    }

    return res.status(404).json({ error: "Not found", path: path });
  });
});
