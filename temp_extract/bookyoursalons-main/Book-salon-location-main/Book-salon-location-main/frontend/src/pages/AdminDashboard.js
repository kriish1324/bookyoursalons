import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { DollarSign, Users, Calendar, Store, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AdminDashboard() {
  const [salons, setSalons] = useState([]);
  const [analytics, setAnalytics] = useState({
    total_bookings: 0,
    total_salons: 0,
    total_revenue: 0,
    platform_earnings: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salonsRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/admin/salons`),
        axios.get(`${API}/admin/analytics`)
      ]);
      setSalons(salonsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.zerror('Error fetching admin data:', error);
    }
  };

  const approveSalon = async (salonId) => {
    try {
      await axios.patch(`${API}/admin/salon/${salonId}/approve`);
      toast.success('Salon approved');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve salon');
    }
  };

  const blockSalon = async (salonId) => {
    try {
      await axios.patch(`${API}/admin/salon/${salonId}/block`);
      toast.success('Salon blocked');
      fetchData();
    } catch (error) {
      toast.error('Failed to block salon');
    }
  };

  const pendingSalons = salons.filter(s => s.status === 'pending');
  const approvedSalons = salons.filter(s => s.status === 'approved');
  const blockedSalons = salons.filter(s => s.status === 'blocked');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="total-bookings-card">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Total Bookings
              </CardDescription>
              <CardTitle className="text-3xl">{analytics.total_bookings}</CardTitle>
            </CardHeader>
          </Card>

          <Card data-testid="total-salons-card">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                Active Salons
              </CardDescription>
              <CardTitle className="text-3xl">{analytics.total_salons}</CardTitle>
            </CardHeader>
          </Card>

          <Card data-testid="total-revenue-card">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Revenue
              </CardDescription>
              <CardTitle className="text-3xl">₹{analytics.total_revenue}</CardTitle>
            </CardHeader>
          </Card>

          <Card data-testid="platform-earnings-card" className="bg-green-50">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Platform Earnings
              </CardDescription>
              <CardTitle className="text-3xl text-green-700">₹{Number(analytics.platform_earnings || 0).toFixed(0)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Salon Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending">Pending ({pendingSalons.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedSalons.length})</TabsTrigger>
                <TabsTrigger value="blocked">Blocked ({blockedSalons.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-3 mt-4">
                {pendingSalons.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending salons</p>
                ) : (
                  pendingSalons.map((salon) => (
                    <SalonCard key={salon.salon_id} salon={salon} onApprove={approveSalon} onBlock={blockSalon} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                {approvedSalons.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No approved salons</p>
                ) : (
                  approvedSalons.map((salon) => (
                    <SalonCard key={salon.salon_id} salon={salon} onBlock={blockSalon} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="blocked" className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                {blockedSalons.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No blocked salons</p>
                ) : (
                  blockedSalons.map((salon) => (
                    <SalonCard key={salon.salon_id} salon={salon} onApprove={approveSalon} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SalonCard({ salon, onApprove, onBlock }) {
  return (
    <Card data-testid={`salon-card-${salon.salon_id}`}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <h3 className="font-bold text-lg">{salon.salon_name}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-600">Owner</p>
                <p className="font-medium">{salon.owner_name}</p>
              </div>
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium">{salon.phone}</p>
              </div>
              <div>
                <p className="text-gray-600">Area</p>
                <p className="font-medium">{salon.area}</p>
              </div>
              <div>
                <p className="text-gray-600">Staff</p>
                <p className="font-medium">{salon.staff_count} members</p>
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Services:</p>
              <div className="flex flex-wrap gap-1">
                {salon.services?.map((service) => (
                  <span key={service.id} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {service.name} - ₹{service.price}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            {onApprove && (
              <Button 
                data-testid={`approve-salon-btn-${salon.salon_id}`}
                size="sm" 
                onClick={() => onApprove(salon.salon_id)}
              >
                Approve
              </Button>
            )}
            {onBlock && (
              <Button 
                data-testid={`block-salon-btn-${salon.salon_id}`}
                size="sm" 
                variant="destructive" 
                onClick={() => onBlock(salon.salon_id)}
              >
                Block
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminDashboard;