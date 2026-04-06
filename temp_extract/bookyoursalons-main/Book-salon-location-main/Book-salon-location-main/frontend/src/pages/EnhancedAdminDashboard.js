import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { DollarSign, Users, Calendar, Store, TrendingUp, BarChart3, Eye, LogOut, AlertTriangle, IndianRupee, Ban, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Safe number formatter to prevent toFixed crashes
const safeNumber = (value, digits = 2) => Number(value || 0).toFixed(digits);

function EnhancedAdminDashboard() {
  const navigate = useNavigate();
  const [salons, setSalons] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [salonsWithStats, setSalonsWithStats] = useState([]);
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [salonDetailedView, setSalonDetailedView] = useState(null);
  const [showSalonView, setShowSalonView] = useState(false);
  const [commissionSummary, setCommissionSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    total_bookings: 0,
    total_salons: 0,
    total_revenue: 0,
    platform_earnings: 0
  });
  const [detailedAnalytics, setDetailedAnalytics] = useState({
    today_bookings: 0,
    week_bookings: 0,
    month_bookings: 0,
    total_customers: 0
  });
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    const adminAuthTime = localStorage.getItem('adminAuthTime');
    
    // Check if admin session exists and is valid (24 hours)
    if (!isAdmin || !adminAuthTime) {
      navigate('/admin/login');
      return;
    }
    
    const currentTime = new Date().getTime();
    const sessionAge = currentTime - parseInt(adminAuthTime);
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (sessionAge > twentyFourHours) {
      // Session expired
      localStorage.clear();
      navigate('/admin/login');
      return;
    }
    
    fetchAllData();
  }, [navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, salonsRes, detailedRes, statsRes, bookingsRes] = await Promise.all([
        axios.get(`${API}/admin/analytics`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/salons`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/analytics/detailed`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/salons/analytics-summary`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/bookings/all`).catch(() => ({ data: [] }))
      ]);
      
      setAnalytics(analyticsRes.data || {});
      setSalons(Array.isArray(salonsRes.data) ? salonsRes.data : []);
      setDetailedAnalytics(detailedRes.data || {});
      setSalonsWithStats(Array.isArray(statsRes.data) ? statsRes.data : []);
      setAllBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      
      // Fetch commission summary separately
      try {
        const commissionRes = await axios.get(`${API}/admin/commission/summary`);
        setCommissionSummary(commissionRes.data || {});
      } catch (err) {
        console.error('Error fetching commission summary:', err);
        setCommissionSummary({});
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load some data');
      setSalons([]);
      setAllBookings([]);
      setSalonsWithStats([]);
    }
    setLoading(false);
  };

  const fetchSalonDetailedAnalytics = async (salonId) => {
    try {
      const response = await axios.get(`${API}/admin/salon/${salonId}/analytics`);
      setSalonDetailedView(response.data);
      setShowSalonView(true);
    } catch (error) {
      console.error('Error fetching salon analytics:', error);
      toast.error('Failed to load salon details');
    }
  };

  const approveSalon = async (salonId) => {
    try {
      await axios.patch(`${API}/admin/salon/${salonId}/approve`);
      toast.success('Salon approved');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to approve salon');
    }
  };

  const blockSalon = async (salonId, reason = 'manual') => {
    try {
      await axios.post(`${API}/admin/salon/${salonId}/block?reason=${reason}`);
      toast.success('Salon blocked');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to block salon');
    }
  };

  const unblockSalon = async (salonId) => {
    try {
      await axios.post(`${API}/admin/salon/${salonId}/unblock`);
      toast.success('Salon unblocked');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to unblock salon');
    }
  };

  const checkOverdueCommissions = async () => {
    try {
      const res = await axios.post(`${API}/commission/check-overdue`);
      toast.success(`Checked ${res.data.checked} ledgers, updated ${res.data.updated}, blocked ${res.data.blocked_salons.length} salons`);
      fetchAllData();
    } catch (error) {
      toast.error('Failed to check overdue commissions');
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    try {
      await axios.patch(`${API}/admin/booking/${bookingId}/status?status=${status}`);
      toast.success(`Booking marked as ${status}`);
      fetchAllData();
    } catch (error) {
      toast.error('Failed to update booking');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/admin/login');
  };

  // Safe array operations
  const safeSalons = Array.isArray(salons) ? salons : [];
  const safeBookings = Array.isArray(allBookings) ? allBookings : [];
  
  const pendingSalons = safeSalons.filter(s => s?.status === 'pending');
  const approvedSalons = safeSalons.filter(s => s?.status === 'approved');
  const blockedSalons = safeSalons.filter(s => s?.status === 'blocked');

  const filteredBookings = safeBookings.filter(booking => {
    if (!booking) return false;
    if (filterDate && booking.booking_date !== filterDate) return false;
    if (filterStatus !== 'all' && booking.status !== filterStatus) return false;
    if (selectedSalon && booking.salon_id !== selectedSalon) return false;
    return true;
  });

  // Loading guard
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Loading Admin Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enhanced Admin Dashboard</h1>
            <p className="text-sm text-gray-600">BookYourSalons Platform Analytics</p>
          </div>
          <Button data-testid="admin-logout-btn" variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
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
            <CardContent>
              <div className="text-sm space-y-1">
                <p>Today: <strong>{detailedAnalytics.today_bookings}</strong></p>
                <p>This Week: <strong>{detailedAnalytics.week_bookings}</strong></p>
                <p>This Month: <strong>{detailedAnalytics.month_bookings}</strong></p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="total-salons-card">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                Active Salons
              </CardDescription>
              <CardTitle className="text-3xl">{analytics.total_salons}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <p>Approved: <strong>{approvedSalons.length}</strong></p>
                <p>Pending: <strong>{pendingSalons.length}</strong></p>
                <p>Blocked: <strong>{blockedSalons.length}</strong></p>
              </div>
            </CardContent>
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
              <CardTitle className="text-3xl text-green-700">₹{safeNumber(analytics.platform_earnings, 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Total Customers: <strong>{detailedAnalytics.total_customers}</strong></p>
            </CardContent>
          </Card>
        </div>

        {/* Commission Summary Section */}
        {commissionSummary && (
          <Card className="mb-8" data-testid="commission-summary-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5" />
                    Commission Summary (10% Platform Fee)
                  </CardTitle>
                  <CardDescription>Overview of all commission collected and pending</CardDescription>
                </div>
                <Button variant="outline" onClick={checkOverdueCommissions} data-testid="check-overdue-btn">
                  Check Overdue
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Online Collected</p>
                  <p className="text-2xl font-bold text-green-700">₹{safeNumber(commissionSummary.commission_collected?.online)}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Offline Paid</p>
                  <p className="text-2xl font-bold text-blue-700">₹{safeNumber(commissionSummary.commission_collected?.offline_paid)}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600">Offline Pending</p>
                  <p className="text-2xl font-bold text-yellow-700">₹{safeNumber(commissionSummary.commission_pending?.offline_pending)}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-700">₹{safeNumber(commissionSummary.commission_pending?.offline_overdue)}</p>
                </div>
                <div className="p-4 bg-gray-100 rounded-lg">
                  <p className="text-sm text-gray-600">Total Commission</p>
                  <p className="text-2xl font-bold">₹{safeNumber(commissionSummary.total_commission)}</p>
                </div>
              </div>

              {/* Overdue Salons */}
              {commissionSummary.overdue_salons?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Overdue Salons ({commissionSummary.overdue_salons.length})
                  </h4>
                  <div className="space-y-2">
                    {commissionSummary.overdue_salons.map(salon => (
                      <div key={salon.salon_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                        <div>
                          <p className="font-medium text-red-800">{salon.salon_name}</p>
                          <p className="text-sm text-red-600">{salon.phone}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${salon.status === 'blocked' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                            {salon.status?.toUpperCase()}
                          </span>
                          {salon.status !== 'blocked' && (
                            <Button size="sm" variant="destructive" onClick={() => blockSalon(salon.salon_id, 'commission_overdue')}>
                              <Ban className="w-3 h-3 mr-1" /> Block
                            </Button>
                          )}
                          {salon.status === 'blocked' && (
                            <Button size="sm" variant="outline" onClick={() => unblockSalon(salon.salon_id)}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Unblock
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Salon Performance Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Salon Name</th>
                    <th className="text-left py-3 px-4">Area</th>
                    <th className="text-left py-3 px-4">Bookings</th>
                    <th className="text-left py-3 px-4">Revenue</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salonsWithStats.map((salon) => (
                    <tr key={salon.salon_id} className={`border-b hover:bg-gray-50 ${salon.status === 'blocked' ? 'bg-red-50' : ''}`}>
                      <td className="py-3 px-4 font-medium">{salon.salon_name}</td>
                      <td className="py-3 px-4">{salon.area}</td>
                      <td className="py-3 px-4">{salon.total_bookings}</td>
                      <td className="py-3 px-4">₹{salon.total_revenue}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          salon.status === 'approved' ? 'bg-green-100 text-green-700' :
                          salon.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {salon.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            data-testid={`view-salon-${salon.salon_id}`}
                            size="sm"
                            variant="outline"
                            onClick={() => fetchSalonDetailedAnalytics(salon.salon_id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {salon.status === 'approved' && (
                            <Button
                              data-testid={`block-salon-${salon.salon_id}`}
                              size="sm"
                              variant="destructive"
                              onClick={() => blockSalon(salon.salon_id, 'manual')}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Block
                            </Button>
                          )}
                          {salon.status === 'blocked' && (
                            <Button
                              data-testid={`unblock-salon-${salon.salon_id}`}
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => unblockSalon(salon.salon_id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Unblock
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="salons">Salon Management</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <CardTitle>Booking Management</CardTitle>
                <div className="flex gap-3 mt-4">
                  <Select value={selectedSalon || 'all'} onValueChange={(val) => setSelectedSalon(val === 'all' ? null : val)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by salon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Salons</SelectItem>
                      {salons.map(salon => (
                        <SelectItem key={salon.salon_id} value={salon.salon_id}>{salon.salon_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-48"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredBookings.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No bookings found</p>
                  ) : (
                    filteredBookings.map((booking) => (
                      <Card key={booking.booking_id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-medium">{booking.salon_name}</p>
                            <p className="text-sm text-gray-600">{booking.customer_name} - {booking.customer_phone}</p>
                            <p className="text-sm">{booking.service_name} - ₹{booking.service_price}</p>
                            <p className="text-sm text-gray-500">{booking.booking_date} at {booking.slot_time}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {booking.status}
                            </span>
                            {booking.status === 'confirmed' && (
                              <Button size="sm" onClick={() => updateBookingStatus(booking.booking_id, 'completed')}>
                                Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salons">
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
                    {pendingSalons.map((salon) => (
                      <SalonCard key={salon.salon_id} salon={salon} onApprove={approveSalon} onBlock={blockSalon} />
                    ))}
                  </TabsContent>

                  <TabsContent value="approved" className="space-y-3 mt-4">
                    {approvedSalons.map((salon) => (
                      <SalonCard key={salon.salon_id} salon={salon} onBlock={blockSalon} />
                    ))}
                  </TabsContent>

                  <TabsContent value="blocked" className="space-y-3 mt-4">
                    {blockedSalons.map((salon) => (
                      <SalonCard key={salon.salon_id} salon={salon} onApprove={approveSalon} />
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showSalonView} onOpenChange={setShowSalonView}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Salon Dashboard - {salonDetailedView?.salon?.salon_name}</DialogTitle>
          </DialogHeader>
          {salonDetailedView && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600">Total Bookings</p>
                    <p className="text-2xl font-bold">{salonDetailedView.total_bookings}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600">Unique Customers</p>
                    <p className="text-2xl font-bold">{salonDetailedView.unique_customers}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-700">₹{salonDetailedView.total_revenue}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Popular Services</CardTitle>
                </CardHeader>
                <CardContent>
                  {salonDetailedView.popular_services.map((service, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b">
                      <span>{service._id}</span>
                      <span className="font-medium">{service.count} bookings</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peak Time Slots</CardTitle>
                </CardHeader>
                <CardContent>
                  {salonDetailedView.peak_time_slots.map((slot, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b">
                      <span>{slot._id}</span>
                      <span className="font-medium">{slot.count} bookings</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
          </div>
          <div className="flex flex-col gap-2 ml-4">
            {onApprove && (
              <Button size="sm" onClick={() => onApprove(salon.salon_id)}>Approve</Button>
            )}
            {onBlock && (
              <Button size="sm" variant="destructive" onClick={() => onBlock(salon.salon_id)}>Block</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EnhancedAdminDashboard;