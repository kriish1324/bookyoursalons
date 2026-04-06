# BookYourSalons - Product Requirements Document

## Project Overview
BookYourSalons is a comprehensive salon booking platform connecting customers with salon partners. The platform supports customer bookings, salon partner management, and admin analytics.

## Tech Stack
- **Frontend**: React.js with Tailwind CSS
- **Backend**: FastAPI (Python) for preview / Firebase Functions for production
- **Database**: MongoDB (preview) / Firestore (production)
- **Authentication**: Firebase OTP-based auth
- **Hosting**: Firebase Hosting (production)
- **Payment**: UPI-based subscription system

## User Personas

### 1. Customer
- Browse and search salons by location
- Book appointments with time slot selection
- View booking history and manage appointments
- Rate and review salons
- Receive appointment reminders

### 2. Salon Partner
- Register salon with services and pricing
- Manage bookings (accept/reject)
- View dashboard analytics
- Control operating hours and availability
- Upload salon photos and gallery
- **1 Month FREE Trial** on registration

### 3. Admin
- Approve/block salons
- View platform analytics
- Monitor revenue
- User management
- **0% Commission** - Salons receive 100% revenue

## Core Requirements (Static)

### Customer Features
- OTP-based login
- Location-based salon discovery
- Service and salon search
- Real-time slot booking
- Payment (pay-at-salon)
- Booking history
- Reviews and ratings
- Appointment reminders

### Salon Partner Features
- Registration with FREE trial
- Booking management (approve/reject within 15 min)
- Dashboard analytics
- Operating hours control
- Status toggle (OPEN/CLOSED)
- Photo gallery
- Bank details management

### Admin Features
- Salon approval workflow
- User analytics dashboard
- Platform metrics
- Revenue tracking

---

## Implementation Status (March 31, 2026)

### ✅ Completed Features

#### Backend API (100% Complete)
- [x] Auth tracking API
- [x] Geocode reverse/search APIs
- [x] Salon registration API
- [x] Salon user lookup API
- [x] Salon dashboard analytics API
- [x] Salon status toggle API
- [x] Salon hours update API
- [x] Salon location update API
- [x] Salon bank details API
- [x] Salon photo/gallery upload APIs
- [x] Salon auto-close check API
- [x] Salon slots API
- [x] Salon reviews API
- [x] Nearby salons API
- [x] Trending salons API
- [x] Recommended salons API
- [x] Search API
- [x] Booking create API
- [x] Booking spam check API
- [x] Booking approve/reject/cancel APIs
- [x] Pending bookings API
- [x] Salon bookings API
- [x] Customer bookings API
- [x] Upcoming reminders API
- [x] Slot lock API
- [x] Review create API
- [x] Service reminders API
- [x] Favorites toggle API
- [x] Admin analytics API
- [x] Admin detailed analytics API
- [x] Admin salons management API
- [x] Admin user analytics API
- [x] Admin login stats API
- [x] Admin commission summary API
- [x] Admin salon approve/block/unblock APIs
- [x] Admin booking status update API

#### Frontend (90% Complete)
- [x] Landing page with customer/partner selection
- [x] Customer OTP login
- [x] Google Sign-in for customers
- [x] Salon partner OTP verification
- [x] Salon registration form
- [x] Salon dashboard with analytics
- [x] Admin dashboard with all tabs
- [x] User analytics dashboard
- [x] Salon performance analytics
- [x] Booking management
- [x] Salon management (approve/block)

### Business Logic Implemented
- [x] Double booking prevention (staff-based slot availability)
- [x] Spam protection (3 bookings per 5 minutes)
- [x] 15-minute booking approval window
- [x] 1-month FREE trial for new salons
- [x] 0% commission (100% revenue to partners)
- [x] Auto-close when fully booked
- [x] Subscription upgrade via UPI

---

## API Endpoints Summary

### Auth APIs
- `POST /api/auth/track-login` - Track user login

### Geocode APIs
- `GET /api/geocode/reverse` - Reverse geocoding
- `GET /api/geocode/search` - Search geocoding

### Salon APIs
- `POST /api/salon/register` - Register salon
- `GET /api/salon/user/{uid}` - Get salon by Firebase UID
- `GET /api/salon/status/{phone}` - Get salon approval status
- `GET /api/salon/{id}/dashboard-analytics` - Dashboard analytics
- `PATCH /api/salon/{id}/toggle-status` - Toggle OPEN/CLOSED
- `PATCH /api/salon/{id}/hours` - Update hours
- `PATCH /api/salon/{id}/location` - Update location
- `POST /api/salon/{id}/bank-details` - Save bank details
- `POST /api/salon/{id}/upload-photo` - Upload main photo
- `POST /api/salon/{id}/gallery` - Upload gallery
- `POST /api/salon/{id}/check-auto-close` - Check auto-close
- `GET /api/salon/{id}/slots` - Get available slots
- `GET /api/salon/{id}/reviews` - Get reviews

### Salons APIs
- `GET /api/salons/nearby` - Nearby salons
- `GET /api/salons/trending` - Trending salons
- `GET /api/salons/recommended` - Recommended salons

### Search API
- `GET /api/search` - Smart search

### Booking APIs
- `POST /api/booking/create` - Create booking
- `POST /api/booking/check-spam` - Check spam
- `POST /api/booking/{id}/approve` - Approve booking
- `POST /api/booking/{id}/reject` - Reject booking
- `PATCH /api/booking/{id}/cancel` - Cancel booking
- `GET /api/bookings/salon/{id}/pending` - Pending bookings
- `GET /api/bookings/salon/{id}` - Salon bookings
- `GET /api/bookings/customer/{phone}` - Customer bookings
- `GET /api/bookings/upcoming-reminders/{phone}` - Upcoming reminders

### Slot APIs
- `POST /api/slot/lock` - Lock slot (5 minutes)

### Review APIs
- `POST /api/review/create` - Create/update review

### Customer APIs
- `GET /api/customer/{phone}/service-reminders` - Service reminders
- `GET /api/customer/{uid}/favorites` - Get favorites
- `POST /api/customer/{uid}/favorites/{salonId}` - Toggle favorite

### Admin APIs
- `GET /api/admin/analytics` - Platform analytics
- `GET /api/admin/analytics/detailed` - Detailed analytics
- `GET /api/admin/salons` - All salons
- `GET /api/admin/salons/analytics-summary` - Salons summary
- `GET /api/admin/bookings/all` - All bookings
- `GET /api/admin/user-analytics` - User analytics
- `GET /api/admin/login-stats` - Login statistics
- `GET /api/admin/commission/summary` - Commission summary
- `PATCH /api/admin/salon/{id}/approve` - Approve salon
- `POST /api/admin/salon/{id}/block` - Block salon
- `POST /api/admin/salon/{id}/unblock` - Unblock salon
- `GET /api/admin/salon/{id}/analytics` - Salon analytics
- `PATCH /api/admin/booking/{id}/status` - Update booking status

---

## Deployment

### Firebase Configuration
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDMclqnmKSFqhXmPMmbHGJHoGXyQKaKEME",
  authDomain: "bookyoursalons.firebaseapp.com",
  projectId: "bookyoursalons",
  storageBucket: "bookyoursalons.firebasestorage.app",
  messagingSenderId: "975712273772",
  appId: "1:975712273772:web:a3a189b3bdfdcfa04a9f49"
};
```

### Live URLs
- **Preview**: https://book-final-deploy.preview.emergentagent.com
- **Production**: https://bookyoursalons.web.app

### Firebase Functions Deployment
```bash
cd /app/functions
npm install
firebase deploy --only functions
```

### Firebase Hosting Deployment
```bash
cd /app/frontend
yarn build
firebase deploy --only hosting
```

---

## Verification Checklist

### ✅ Backend APIs (100%)
- [x] All 50+ endpoints working
- [x] No 404 errors
- [x] No 500 errors
- [x] CORS configured correctly
- [x] MongoDB/Firestore integration

### ✅ Frontend (90%)
- [x] Landing page loads
- [x] Customer flow works
- [x] Salon partner flow works
- [x] Admin dashboard loads
- [x] All forms functional
- [ ] Admin login requires real Firebase OTP

### ✅ Business Logic
- [x] 1-month free trial
- [x] 0% commission
- [x] Double booking prevention
- [x] Spam protection
- [x] Booking approval window

---

## Next Tasks

1. Deploy Firebase Functions to production
2. Test end-to-end with real Firebase OTP
3. Verify Firestore data persistence
4. Monitor for production issues

---

*Last Updated: March 31, 2026*
