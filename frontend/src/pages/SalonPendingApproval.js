import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Clock, CheckCircle, Phone, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import Logo from '../components/Logo';


const API = '/api';

function SalonPendingApproval() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const phone = localStorage.getItem('userPhone');
  const salonName = localStorage.getItem('pendingSalonName') || 'Your Salon';

  useEffect(() => {
    checkApprovalStatus();
    // Check status every 30 seconds
    const interval = setInterval(checkApprovalStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkApprovalStatus = async () => {
    if (!phone) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/salon/status/${phone}`);
      const salonStatus = response.data?.status;
      setStatus(salonStatus || 'pending');
      
      if (salonStatus === 'approved') {
        localStorage.setItem('partnerStatus', 'active');
        // Auto redirect after showing success
        setTimeout(() => {
          navigate('/salon/dashboard');
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus('pending');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
      <div className="container mx-auto max-w-lg">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <Logo size="medium" />
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center pb-2">
            {status === 'approved' ? (
              <div className="mx-auto bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            ) : (
              <div className="mx-auto bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-10 h-10 text-yellow-600" />
              </div>
            )}
            <CardTitle className="text-2xl">
              {status === 'approved' ? 'Registration Approved!' : 'Waiting for Admin Approval'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {status === 'approved' ? (
              <div className="text-center">
                <p className="text-green-700 mb-4">
                  Congratulations! Your salon <strong>{salonName}</strong> has been approved.
                </p>
                <p className="text-gray-600 text-sm mb-6">
                  Redirecting to your dashboard...
                </p>
                <Button 
                  onClick={() => navigate('/salon/dashboard')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-gray-700 text-center">
                    Your salon registration for <strong>{salonName}</strong> has been submitted successfully.
                  </p>
                  <p className="text-gray-600 text-sm text-center mt-2">
                    Please wait for admin approval. You will be able to access your salon dashboard after approval.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-gray-800">Registration Details</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>Registered Phone: {phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${status === 'pending' ? 'bg-yellow-500' : status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-gray-600">
                      Status: <strong className="capitalize">{status}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-500">
                  <p>This page will automatically update when your registration is approved.</p>
                </div>

                <Button 
                  variant="outline" 
                  onClick={checkApprovalStatus}
                  className="w-full"
                >
                  Check Status Again
                </Button>
              </>
            )}

            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="w-full text-gray-500"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SalonPendingApproval;
