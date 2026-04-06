import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber, RecaptchaVerifier, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Scissors, Sparkles, Lock, CheckCircle, Star, Users, Shield, Clock, MapPin, Zap, Gift, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import axios from 'axios';

// Use relative path for Firebase Functions
const API = '/api';

function Landing() {
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [discountInfo, setDiscountInfo] = useState(null);
  const API = process.env.REACT_APP_BACKEND_URL;

  // Fetch discount eligibility for offer banner
  useEffect(() => {
    const fetchDiscountInfo = async () => {
      try {
        const response = await axios.get(`${API}/salon/discount-eligibility`);
        setDiscountInfo(response.data);
      } catch (error) {
        console.log('Discount info not available');
      }
    };
    fetchDiscountInfo();
  }, [API]);

  // Cleanup reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          // Ignore cleanup errors
        }
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Setup reCAPTCHA with better error handling
  const setupRecaptcha = useCallback(() => {
    // Clear existing verifier first
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        // Ignore
      }
      window.recaptchaVerifier = null;
    }

    // Create new verifier
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired, resetting...');
        window.recaptchaVerifier = null;
      }
    });

    return window.recaptchaVerifier;
  }, []);

  // Google Sign-In for customers only
  const handleGoogleSignIn = async () => {
    if (!gender) {
      toast.error('Please select your gender first');
      return;
    }
    
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      localStorage.setItem('userRole', 'customer');
      localStorage.setItem('userName', user.displayName || '');
      localStorage.setItem('userEmail', user.email || '');
      localStorage.setItem('firebaseUid', user.uid);
      localStorage.setItem('userGender', gender);
      
      // Track login
      try {
        await axios.post(`${API}/auth/track-login`, {
          phone: user.phoneNumber || user.email,
          name: user.displayName,
          firebase_uid: user.uid,
          login_method: 'google'
        });
      } catch (e) {
        console.error('Login tracking error:', e);
      }
      
      toast.success('Login successful!');
      navigate('/customer');
    } catch (error) {
      console.error('Google Sign-In error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup blocked. Please allow popups.');
      } else {
        toast.error('Google Sign-In failed');
      }
    }
    setLoading(false);
  };

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const appVerifier = setupRecaptcha();
      const phoneNumber = `+91${phone}`;
      
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setResendTimer(60); // 60 second cooldown
      toast.success('OTP sent to +91 ' + phone);
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      // Reset reCAPTCHA on error
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
        window.recaptchaVerifier = null;
      }

      // User-friendly error messages
      if (error.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again in a few minutes.');
      } else if (error.code === 'auth/invalid-phone-number') {
        toast.error('Invalid phone number. Please check and try again.');
      } else if (error.code === 'auth/captcha-check-failed') {
        toast.error('Verification failed. Please refresh the page.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error('Failed to send OTP. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    // Reset state for resend
    setConfirmationResult(null);
    setOtp('');
    setOtpSent(false);
    
    // Small delay then send
    setTimeout(() => handleSendOTP(), 100);
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }

    if (!confirmationResult) {
      toast.error('Please request OTP first');
      return;
    }

    if (selectedRole === 'customer' && !gender) {
      toast.error('Please select your gender');
      return;
    }

    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;

      localStorage.setItem('userRole', selectedRole);
      localStorage.setItem('userPhone', phone);
      localStorage.setItem('userName', name);
      localStorage.setItem('firebaseUid', user.uid);
      if (gender) {
        localStorage.setItem('userGender', gender);
      }

      // Track login
      try {
        await axios.post(`${API}/auth/track-login`, {
          phone: phone,
          name: name,
          firebase_uid: user.uid,
          login_method: 'otp'
        });
      } catch (e) {
        console.error('Login tracking error:', e);
      }

      toast.success('Login successful!');

      if (selectedRole === 'customer') {
        navigate('/customer');
      } else {
        navigate('/salon/partner-setup', { state: { phone, firebaseUid: user.uid, otpVerified: true } });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      
      if (error.code === 'auth/code-expired') {
        toast.error('OTP expired. Please request a new one.');
        setConfirmationResult(null);
        setOtp('');
        setOtpSent(false);
      } else if (error.code === 'auth/invalid-verification-code') {
        toast.error('Invalid OTP. Please check and try again.');
      } else {
        toast.error('Verification failed. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleBack = () => {
    // Reset all state
    setShowAuth(false);
    setConfirmationResult(null);
    setOtp('');
    setPhone('');
    setName('');
    setGender('');
    setOtpSent(false);
    setResendTimer(0);
    
    // Clear reCAPTCHA
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      window.recaptchaVerifier = null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div id="recaptcha-container"></div>
      
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b z-50">
        <div className="container mx-auto px-3 sm:px-4 py-2 flex items-center justify-between">
          <div className="flex items-center">
            <Logo size="small" />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              data-testid="be-salon-partner-btn"
              variant="outline"
              size="sm"
              onClick={() => navigate('/salon/login')}
              className="text-purple-600 border-purple-300 hover:bg-purple-50 text-xs sm:text-sm"
            >
              <Scissors className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              Be a Salon Partner
            </Button>
            <Button 
              data-testid="admin-access-btn"
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/admin/login')}
              className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm"
            >
              <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              Admin
            </Button>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-12 pt-16 sm:pt-20">
        {/* OFFER BANNER - 50% OFF for First 100 Salons */}
        {discountInfo?.eligible && (
          <div className="mb-6 sm:mb-8 animate-pulse" data-testid="offer-banner">
            <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl p-4 sm:p-6 text-white shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <Gift className="w-8 h-8 text-yellow-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded animate-bounce">LIMITED TIME</span>
                      <span className="text-2xl sm:text-3xl font-black">50% OFF</span>
                    </div>
                    <p className="text-white/90 font-medium">For First 100 Salon Partners</p>
                    <p className="text-yellow-200 text-sm font-semibold">
                      ⏰ Only {discountInfo.slotsRemaining || 0} slots left!
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => {
                    setSelectedRole('salon');
                    setShowAuth(true);
                  }}
                  className="bg-white text-red-600 hover:bg-yellow-100 font-bold px-6 py-3 text-lg shadow-lg"
                >
                  Claim Offer <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* HERO SECTION */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center mb-4">
            <Logo size="large" className="scale-90 sm:scale-100" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 mb-4">
            Book Trusted Salons Near You <span className="inline-block">✂️</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto px-2 mb-6">
            Instant booking • Verified salons • Best prices
          </p>
          
          {!showAuth && (
            <Button 
              size="lg"
              onClick={() => {
                setSelectedRole('customer');
                setShowAuth(true);
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-lg font-bold rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
              data-testid="hero-book-now-btn"
            >
              <Zap className="w-5 h-5 mr-2" />
              Book Now
            </Button>
          )}
        </div>

        {/* TRUST SECTION */}
        {!showAuth && (
          <div className="mb-10 sm:mb-16">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span className="font-semibold text-green-800">Verified Salons</span>
              </div>
              <div className="flex items-center justify-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <Clock className="w-6 h-6 text-blue-600" />
                <span className="font-semibold text-blue-800">Easy Booking</span>
              </div>
              <div className="flex items-center justify-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
                <Shield className="w-6 h-6 text-purple-600" />
                <span className="font-semibold text-purple-800">No Hidden Charges</span>
              </div>
            </div>
          </div>
        )}

        {!showAuth ? (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            <Card 
              data-testid="customer-card" 
              className="cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 hover:border-red-500"
              onClick={() => {
                setSelectedRole('customer');
                setShowAuth(true);
              }}
            >
              <CardHeader className="text-center pb-4 sm:pb-8">
                <div className="mx-auto bg-red-100 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
                </div>
                <CardTitle className="text-xl sm:text-3xl font-bold">I am a Customer</CardTitle>
                <CardDescription className="text-sm sm:text-base mt-2 sm:mt-3">
                  Browse salons, book appointments, and enjoy premium services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 sm:space-y-3 text-gray-600 text-sm sm:text-base">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></span>
                    Find nearby salons
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></span>
                    Instant booking
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></span>
                    Secure payments
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              data-testid="salon-partner-card" 
              className="cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 hover:border-purple-500 relative overflow-hidden"
              onClick={() => {
                setSelectedRole('salon');
                setShowAuth(true);
              }}
            >
              {/* Discount Badge */}
              {discountInfo?.eligible && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-500 to-red-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                  🔥 50% OFF
                </div>
              )}
              <CardHeader className="text-center pb-4 sm:pb-8">
                <div className="mx-auto bg-purple-100 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <Scissors className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
                </div>
                <CardTitle className="text-xl sm:text-3xl font-bold">Become a Salon Partner</CardTitle>
                <CardDescription className="text-sm sm:text-base mt-2 sm:mt-3">
                  Grow your business with our platform
                </CardDescription>
                {discountInfo?.eligible && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                    <Gift className="w-4 h-4" />
                    1 Month FREE + 50% OFF
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 sm:space-y-3 text-gray-600 text-sm sm:text-base">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 rounded-full mr-3"></span>
                    Manage bookings easily
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 rounded-full mr-3"></span>
                    Get instant payments
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 rounded-full mr-3"></span>
                    Track earnings
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    className="w-full text-purple-600 border-purple-300 hover:bg-purple-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/salon/login');
                    }}
                    data-testid="partner-login-link"
                  >
                    Already a Partner? Login
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl text-center">
                  {selectedRole === 'customer' ? 'Customer Login' : 'Salon Partner Registration'}
                </CardTitle>
                <CardDescription className="text-center text-sm">
                  {selectedRole === 'customer' 
                    ? 'Login with OTP - No password needed' 
                    : 'Verify phone to create your account'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedRole === 'customer' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Your Name</label>
                      <Input
                        data-testid="name-input"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Gender *</label>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant={gender === 'male' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setGender('male')}
                        >
                          Male
                        </Button>
                        <Button
                          type="button"
                          variant={gender === 'female' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setGender('female')}
                        >
                          Female
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-gray-100 border border-r-0 rounded-l-md text-sm text-gray-600">
                      +91
                    </div>
                    <Input
                      data-testid="phone-input"
                      type="tel"
                      inputMode="numeric"
                      placeholder="10-digit number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      disabled={otpSent}
                      className="rounded-l-none flex-1"
                    />
                    {!otpSent && (
                      <Button 
                        data-testid="send-otp-btn" 
                        onClick={handleSendOTP} 
                        disabled={loading || phone.length < 10}
                      >
                        {loading ? 'Sending...' : 'Send OTP'}
                      </Button>
                    )}
                  </div>
                </div>

                {otpSent && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Enter OTP</label>
                      <Input
                        data-testid="otp-input"
                        type="tel"
                        inputMode="numeric"
                        placeholder="6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        autoFocus
                        className="text-center text-lg tracking-widest"
                      />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Didn't receive OTP?</span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={handleResendOTP}
                        disabled={resendTimer > 0 || loading}
                        className="p-0 h-auto"
                      >
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </Button>
                    </div>
                  </div>
                )}

                {otpSent && (
                  <Button 
                    data-testid="verify-otp-btn" 
                    className="w-full" 
                    onClick={handleVerifyOTP} 
                    disabled={loading || otp.length < 6}
                  >
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                )}

                {/* Google Sign-In for customers only */}
                {selectedRole === 'customer' && !otpSent && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">Or continue with</span>
                      </div>
                    </div>
                    <Button
                      data-testid="google-signin-btn"
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {loading ? 'Signing in...' : 'Continue with Google'}
                    </Button>
                  </>
                )}

                <Button data-testid="back-btn" variant="outline" className="w-full" onClick={handleBack}>
                  Back
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STATS SECTION */}
        {!showAuth && (
          <div className="mt-12 sm:mt-16 py-8 sm:py-12 bg-gray-50 rounded-2xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-4xl mx-auto text-center">
              <div>
                <div className="text-3xl sm:text-4xl font-black text-red-600 mb-1">500+</div>
                <div className="text-gray-600 text-sm sm:text-base">Happy Customers</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-black text-purple-600 mb-1">50+</div>
                <div className="text-gray-600 text-sm sm:text-base">Partner Salons</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-black text-green-600 mb-1">4.8</div>
                <div className="text-gray-600 text-sm sm:text-base flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> Rating
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-black text-blue-600 mb-1">24/7</div>
                <div className="text-gray-600 text-sm sm:text-base">Support</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Landing;