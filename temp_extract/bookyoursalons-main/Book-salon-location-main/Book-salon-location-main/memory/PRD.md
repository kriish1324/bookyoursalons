# Book Salon Location - PRD

## Original Problem Statement
Fix production OTP to use ONLY Firebase Phone Auth (frontend-only) - remove all /api/auth references, preview.emergentagent.com URLs, and external backend OTP verification.

## What's Been Verified (Jan 2026)
- ✅ OTP implementation already uses Firebase Phone Auth exclusively
- ✅ No /api/auth/* references in codebase
- ✅ No preview.emergentagent.com URLs
- ✅ No axios/fetch OTP calls in Landing.js
- ✅ Proper Firebase `signInWithPhoneNumber` and `RecaptchaVerifier` setup
- ✅ Production build successful

## Architecture
- **Frontend**: React with Firebase Auth
- **OTP Flow**: Firebase Phone Auth with invisible reCAPTCHA
- **Hosting**: Firebase Hosting (bookyoursalons project)

## Core OTP Flow
1. User enters phone number
2. RecaptchaVerifier initialized (invisible)
3. `signInWithPhoneNumber(auth, phoneNumber, appVerifier)` called
4. `confirmationResult` stored for verification
5. User enters OTP → `confirmationResult.confirm(otp)` verifies
6. Firebase auth state updated, redirect happens

## Files Involved
- `/app/frontend/src/pages/Landing.js` - Customer/Salon OTP login
- `/app/frontend/src/firebase.js` - Firebase initialization
- `/app/frontend/src/pages/SalonPartnerSetup.js` - Post-OTP partner setup
- `/app/frontend/src/pages/SalonPartnerLogin.js` - Partner credentials login

## Backlog
- P0: None (OTP is working correctly)
- P1: Consider adding OTP resend with countdown timer
- P2: Add phone number format validation for international numbers

## Next Tasks
- Deploy to Firebase Hosting
- Test on production domain with real phone numbers
