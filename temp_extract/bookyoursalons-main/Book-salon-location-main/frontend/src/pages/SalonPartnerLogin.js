import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Key, User, Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';

function SalonPartnerLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!identifier || !password) {
      toast.error('Please enter your ID/Phone and password');
      return;
    }

    setLoading(true);
    try {
      // Check stored credentials locally
      const storedUniqueId = localStorage.getItem('partnerUniqueId');
      const storedPhone = localStorage.getItem('partnerPhone');
      
      // Simple local validation - in production this would verify with Firebase
      if (identifier === storedUniqueId || identifier === storedPhone) {
        localStorage.setItem('userRole', 'salon');
        localStorage.setItem('partnerStatus', 'active');
        toast.success('Login successful!');
        navigate('/salon/dashboard');
      } else {
        // If no local credentials, redirect to registration
        toast.error('Account not found. Please register first.');
        navigate('/');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 py-6 sm:py-12 px-3 sm:px-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Logo size="default" className="justify-center" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <LogIn className="w-5 h-5 text-purple-600" />
              Salon Partner Login
            </CardTitle>
            <CardDescription>
              Login with your Unique ID or Phone Number
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Identifier */}
              <div>
                <label className="block text-sm font-medium mb-1">Unique ID or Phone Number</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="login-identifier-input"
                    className="pl-10"
                    placeholder="Enter your ID or phone"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    className="pl-10 pr-10"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
                data-testid="partner-login-btn"
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="text-center pt-2">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/" className="text-purple-600 hover:underline font-medium">
                    Register as Salon Partner
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SalonPartnerLogin;
