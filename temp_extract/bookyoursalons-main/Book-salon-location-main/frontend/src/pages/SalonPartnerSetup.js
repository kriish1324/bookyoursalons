import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Key, User, Check, X, Eye, EyeOff, Shield } from 'lucide-react';
import Logo from '../components/Logo';

function SalonPartnerSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [firebaseUid, setFirebaseUid] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [customSuffix, setCustomSuffix] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [idAvailable, setIdAvailable] = useState(true); // Default to available since no backend check

  useEffect(() => {
    // Get data from navigation state
    if (location.state?.otpVerified && location.state?.phone) {
      setPhone(location.state.phone);
      setFirebaseUid(location.state.firebaseUid || '');
      setUniqueId(location.state.phone); // Default unique ID is phone number
    } else {
      // Not coming from OTP verification
      toast.error('Please verify your phone number first');
      navigate('/');
    }
  }, [location, navigate]);

  // Update unique ID when suffix changes
  useEffect(() => {
    if (customSuffix) {
      setUniqueId(`${phone}_${customSuffix}`);
    } else {
      setUniqueId(phone);
    }
  }, [customSuffix, phone]);

  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(pwd)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(pwd)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(pwd)) errors.push('One number');
    return errors;
  };

  const passwordErrors = validatePassword(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!uniqueId || !password || !confirmPassword) {
      toast.error('Please fill all required fields');
      return;
    }

    if (passwordErrors.length > 0) {
      toast.error('Password does not meet requirements');
      return;
    }

    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Store partner info locally - Firebase handles the auth
      localStorage.setItem('partnerPhone', phone);
      localStorage.setItem('partnerUniqueId', uniqueId);
      localStorage.setItem('partnerName', name || '');
      localStorage.setItem('partnerStatus', 'active'); // Active by default since Firebase handles auth
      localStorage.setItem('userRole', 'salon');
      localStorage.setItem('firebaseUid', firebaseUid);
      
      toast.success('Account created successfully!');
      navigate('/salon/register');
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Failed to create account. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 py-6 sm:py-12 px-3 sm:px-4">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-6">
          <Logo size="default" className="justify-center" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Shield className="w-5 h-5 text-purple-600" />
              Create Your Partner Account
            </CardTitle>
            <CardDescription>
              Set up your unique ID and password for secure login
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone Display */}
              <div>
                <label className="block text-sm font-medium mb-1">Verified Phone</label>
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="font-medium">+91 {phone}</span>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Your Name</label>
                <Input
                  data-testid="partner-name-input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Unique ID */}
              <div>
                <label className="block text-sm font-medium mb-1">Unique ID *</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="font-mono text-sm">{uniqueId}</span>
                    {idAvailable && (
                      <Check className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Add custom suffix (optional)
                    </label>
                    <Input
                      data-testid="custom-suffix-input"
                      placeholder="e.g., salon, spa, beauty"
                      value={customSuffix}
                      onChange={(e) => setCustomSuffix(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <div className="relative">
                  <Input
                    data-testid="partner-password-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 space-y-1">
                    {['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number'].map((req, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        {passwordErrors.includes(req) ? (
                          <X className="w-3 h-3 text-red-500" />
                        ) : (
                          <Check className="w-3 h-3 text-green-500" />
                        )}
                        <span className={passwordErrors.includes(req) ? 'text-red-600' : 'text-green-600'}>{req}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-1">Confirm Password *</label>
                <Input
                  data-testid="partner-confirm-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword && (
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    {passwordsMatch ? (
                      <><Check className="w-3 h-3 text-green-500" /><span className="text-green-600">Passwords match</span></>
                    ) : (
                      <><X className="w-3 h-3 text-red-500" /><span className="text-red-600">Passwords don't match</span></>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loading || passwordErrors.length > 0 || !passwordsMatch}
                  data-testid="create-partner-account-btn"
                >
                  {loading ? 'Creating Account...' : 'Create Account & Continue'}
                </Button>
              </div>

              <p className="text-xs text-center text-gray-500 mt-3">
                Your account will be activated after admin approval
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SalonPartnerSetup;
