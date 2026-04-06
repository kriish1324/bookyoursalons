# BookYourSalons - Product Requirements Document

## Project Overview
BookYourSalons is a comprehensive salon booking platform connecting customers with salon partners. The platform supports customer bookings, salon partner management, and admin analytics.

## Tech Stack
- **Frontend**: React.js with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: Firebase OTP-based auth
- **Hosting**: Firebase Hosting
- **Payment**: Razorpay integration

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

### 3. Admin
- Approve/block salons
- View platform analytics
- Monitor commission and revenue
- User management

## Core Requirements (Static)

### Customer Features
- OTP-based login
- Location-based salon discovery
- Service and salon search
- Real-time slot booking
- Payment (online/pay-at-salon)
- Booking history
- Reviews and ratings
- Appointment reminders

### Salon Partner Features
- Registration with subscription
- Booking management
- Dashboard analytics
- Operating hours control
- Status toggle (OPEN/CLOSED)
- Photo gallery
- Bank details management

### Admin Features
- Salon approval workflow
- User analytics dashboard
- Commission tracking
- Platform metrics

---

## Implementation Status (March 14, 2026)

### ✅ Completed Features

#### Booking System
- [x] Live slot booking system
- [x] Booking approval flow (salon must approve within 15 min)
- [x] Booking confirmation and cancellation
- [x] Spam protection (3 bookings per 5 minutes limit)
- [x] Payment method selection (online/pay-at-salon)

#### Salon Discovery
- [x] Trending salons algorithm (based on recent bookings)
- [x] Nearby salons (geo-location based)
- [x] Smart search (salon name, service, area)
- [x] Recommended salons engine

#### Reviews & Ratings
- [x] Customer can create/update reviews
- [x] 1-5 star rating system
- [x] Review text optional
- [x] Average rating calculation

#### Salon Dashboard Analytics
- [x] Today/Week/Month booking stats
- [x] Revenue tracking
- [x] Popular services analytics
- [x] Peak hours identification
- [x] Repeat customer tracking
- [x] Customer visit history

#### Reminder Systems
- [x] Appointment reminder (within 1 hour)
- [x] Urgent reminder banner (5 minutes before)
- [x] Service repeat reminder (30+ days since last visit)

#### Salon Status Control
- [x] OPEN/CLOSED toggle
- [x] Operating hours configuration
- [x] Auto-close when fully booked
- [x] FULLY BOOKED status badge
- [x] Status badges in salon cards

#### Photo Gallery
- [x] Salon main photo upload
- [x] Gallery photos (up to 20)
- [x] Photo deletion

#### Admin User Analytics
- [x] Total customers/partners/salons
- [x] Active users tracking
- [x] New registrations stats
- [x] Booking performance metrics
- [x] Revenue overview
- [x] Top performing salons

#### Security
- [x] Spam booking protection
- [x] Fake registration protection
- [x] OTP-based authentication

#### Mobile UI
- [x] Responsive landing page
- [x] Mobile-optimized customer home
- [x] Mobile-optimized salon dashboard
- [x] Touch-friendly navigation

---

## Prioritized Backlog

### P0 (Critical) - Completed
- All core booking features
- Salon discovery
- Dashboard analytics
- Status control

### P1 (High Priority) - Completed
- Reviews system
- Reminder systems
- Admin analytics
- Mobile optimization

### P2 (Medium Priority) - Completed
- Photo gallery
- Spam protection
- Auto-close system

### P3 (Future Enhancements)
- [ ] Push notifications (browser)
- [ ] Multi-language support
- [ ] Salon category filters
- [ ] Loyalty rewards redemption UI
- [ ] Advanced analytics exports
- [ ] Bulk booking management
- [ ] Waitlist feature

---

## API Endpoints Summary

### Customer APIs
- `GET /api/salons/nearby` - Nearby salons
- `GET /api/salons/trending` - Trending salons
- `GET /api/salons/recommended` - Recommended salons
- `GET /api/search` - Smart search
- `POST /api/booking/create` - Create booking
- `POST /api/booking/check-spam` - Spam check
- `POST /api/review/create` - Create review
- `GET /api/bookings/upcoming-reminders/{phone}` - Reminders

### Salon Partner APIs
- `POST /api/salon/register` - Register salon
- `GET /api/salon/{id}/dashboard-analytics` - Dashboard
- `PATCH /api/salon/{id}/toggle-status` - Toggle OPEN/CLOSED
- `PATCH /api/salon/{id}/hours` - Update hours
- `POST /api/salon/{id}/gallery` - Upload photos
- `POST /api/salon/{id}/check-auto-close` - Auto-close check

### Admin APIs
- `GET /api/admin/user-analytics` - User analytics
- `GET /api/admin/analytics` - Platform analytics
- `PATCH /api/admin/salon/{id}/approve` - Approve salon
- `PATCH /api/admin/salon/{id}/block` - Block salon

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
- **Production**: https://bookyoursalons.web.app
- **Firebase Console**: https://console.firebase.google.com/project/bookyoursalons/overview

### Build Command
```bash
cd frontend && yarn build
firebase deploy --only hosting
```

### Deployment Status: ✅ DEPLOYED (March 14, 2026)

### Latest Updates (March 14, 2026):
- ✅ Added 1 Month FREE Trial for new salon registrations
- ✅ Added Trial Card with countdown in Salon Dashboard
- ✅ Added Subscription Upgrade UI with UPI payment flow
- ✅ Removed commission system (0% platform fee)
- ✅ Salon partners now receive 100% revenue

---

## Verification Checklist

### ✅ Customer Flow
- [x] Login page loads correctly
- [x] OTP authentication works
- [x] Google login available
- [x] Search salons by location
- [x] Book appointments
- [x] View booking history

### ✅ Salon Partner Flow
- [x] Registration with FREE TRIAL (no payment required)
- [x] Free Trial Card shows days remaining
- [x] Upgrade Plan card visible
- [x] UPI payment for subscription upgrade
- [x] Dashboard analytics displayed
- [x] Booking alerts visible
- [x] Accept/reject bookings
- [x] Status toggle (OPEN/CLOSED)
- [x] 100% revenue (0% commission)

### ✅ Admin Flow
- [x] Admin login accessible
- [x] Dashboard loads without crash
- [x] User Analytics tab functional
- [x] 0% Commission displayed
- [x] Salon management working

### ✅ Quality Checks
- [x] No console errors
- [x] No blank pages
- [x] No infinite loading
- [x] Mobile UI optimized
- [x] Numeric values show 0 or 0.00 if missing

---

## Next Tasks

1. Deploy updated build to Firebase Hosting
2. Test end-to-end customer booking flow
3. Test salon partner dashboard features
4. Verify admin analytics dashboard
5. Monitor for any production issues

---

*Last Updated: March 14, 2026*
