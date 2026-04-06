import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Lock, Shield } from 'lucide-react';

// Admin phone number - only this number can access admin panel
const ADMIN_PHONE = '+916205777957';

function AdminLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Cleanup reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
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
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      window.recaptchaVerifier = null;
    }

    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'admin-recaptcha-container', {
      size: 'invisible',
      callback: () => {
        console.log('Admin reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('Admin reCAPTCHA expired');
        window.recaptchaVerifier = null;
      }
    });

    return window.recaptchaVerifier;
  }, []);

  const handleSendOTP = async () => {
    const fullPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
    
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    // Frontend validation - only admin phone allowed
    if (fullPhone !== ADMIN_PHONE) {
      toast.error('Unauthorized access. This panel is restricted to admin only.');
      return;
    }

    setLoading(true);
    try {
      const appVerifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setResendTimer(60);
      toast.success('OTP sent to admin number');
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
        window.recaptchaVerifier = null;
      }

      if (error.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Check your connection.');
      } else {
        toast.error('Failed to send OTP. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setConfirmationResult(null);
    setOtp('');
    setOtpSent(false);
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

    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;

      localStorage.setItem('adminPhone', phone);
      localStorage.setItem('adminId', user.uid);
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('adminAuthTime', new Date().getTime().toString());

      toast.success('Admin login successful');
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      
      if (error.code === 'auth/code-expired') {
        toast.error('OTP expired. Please request a new one.');
        setConfirmationResult(null);
        setOtp('');
        setOtpSent(false);
      } else if (error.code === 'auth/invalid-verification-code') {
        toast.error('Invalid OTP. Please try again.');
      } else {
        toast.error('Verification failed.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center px-4">
      <div id="admin-recaptcha-container"></div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl">Admin Panel Login</CardTitle>
          <p className="text-sm text-gray-600 mt-2">OTP Authentication</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Admin Mobile Number</label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-gray-100 border border-r-0 rounded-l-md text-sm text-gray-600">
                +91
              </div>
              <Input
                data-testid="admin-phone-input"
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
            <p className="text-xs text-gray-500 mt-1">Authorized admin access only</p>
          </div>

          {otpSent && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Enter OTP</label>
                <Input
                  data-testid="admin-otp-input"
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
                <span className="text-gray-500">Didn't receive?</span>
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
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Button>
          )}

          {!otpSent && (
            <div className="text-center pt-4">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Lock className="w-3 h-3" />
                <span>Secure OTP-based authentication</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminLogin;