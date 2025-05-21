import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { socketProvider } from "@/lib/socket";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { formatDistanceToNow, subDays, format } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area
} from 'recharts';

interface StationActivity {
  stationId: string;
  stationType: "cash" | "scanner" | "checker" | "free-book";
  operatorName: string;
  lastActivity: Date;
  studentId?: string;
  studentName?: string;
  action?: string;
  activityCount?: number;
  totalBooks?: number;
  totalPayments?: number;
}

interface OverviewTabProps {
  operatorName: string;
}

export function OverviewTab({ operatorName }: OverviewTabProps) {
  const [activeStations, setActiveStations] = useState<StationActivity[]>([]);
  const [activityStats, setActivityStats] = useState<any[]>([]);
  const [distributionStats, setDistributionStats] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<any[]>([]);
  const [operatorStats, setOperatorStats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [inactivityThreshold, setInactivityThreshold] = useState(30); // minutes
  const { formattedLogs } = useWsLogs();
  
  // Set up auto-logout timer for inactive sessions
  useEffect(() => {
    const checkInactivity = () => {
      const inactiveThresholdMs = inactivityThreshold * 60 * 1000;
      const now = new Date();
      
      // Check if any operators need to be logged out due to inactivity
      activeStations.forEach(station => {
        const inactiveTime = now.getTime() - station.lastActivity.getTime();
        
        if (inactiveTime > inactiveThresholdMs) {
          // Here you would trigger an API call to log out the user
          console.log(`Auto-logout triggered for ${station.operatorName} due to ${inactivityThreshold} minutes of inactivity`);
          
          // In a real implementation, you'd call the API to log them out:
          // apiRequest('POST', '/api/operators/logout', { operatorName: station.operatorName });
        }
      });
    };
    
    // Check every minute
    const intervalId = setInterval(checkInactivity, 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [activeStations, inactivityThreshold]);
  
  // Process logs to extract station activity and statistics
  useEffect(() => {
    // Only process if there are logs to process
    if (formattedLogs && formattedLogs.length > 0) {
      // Group logs by operator and station type for active stations
      const stationMap = new Map<string, StationActivity>();
      
      // Track statistics by type
      const operatorActivity: Record<string, number> = {};
      const dailyActivity: Record<string, {
        distributions: number;
        payments: number;
        verifications: number;
        freeBooks: number;
        date: string;
      }> = {};
      const booksByOperator: Record<string, number> = {};
      const paymentsByOperator: Record<string, number> = {};
      
      // Create tracking for daily statistics (7 days)
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = subDays(today, i);
        const dateStr = format(date, 'MM-dd');
        dailyActivity[dateStr] = {
          distributions: 0,
          payments: 0,
          verifications: 0,
          freeBooks: 0,
          date: format(date, 'MMM dd')
        } as any;
      }
      
      formattedLogs.forEach((log) => {
        const { data, timestamp } = log;
        if (!data.operatorName) return;
        
        // Track operator activity counts
        if (!operatorActivity[data.operatorName]) {
          operatorActivity[data.operatorName] = 0;
        }
        operatorActivity[data.operatorName]++;
        
        // Track daily activity
        const logDate = new Date(timestamp);
        const dateStr = format(logDate, 'MM-dd');
        
        if (dailyActivity[dateStr]) {
          if (data.action === "NEW_DISTRIBUTION") {
            dailyActivity[dateStr].distributions++;
            
            // Track books distributed by operator
            if (!booksByOperator[data.operatorName]) {
              booksByOperator[data.operatorName] = 0;
            }
            booksByOperator[data.operatorName]++;
          } 
          else if (data.action === "NEW_PAYMENT") {
            dailyActivity[dateStr].payments++;
            
            // Track payments by operator
            if (!paymentsByOperator[data.operatorName]) {
              paymentsByOperator[data.operatorName] = 0;
            }
            paymentsByOperator[data.operatorName]++;
          }
          else if (data.action === "VERIFY_DISTRIBUTION") {
            dailyActivity[dateStr].verifications++;
          }
          else if (data.action === "FREE_BOOK_CLAIM") {
            dailyActivity[dateStr].freeBooks++;
          }
        }
        
        let stationType: "cash" | "scanner" | "checker" | "free-book" = "scanner";
        
        // Determine station type based on action
        if (data.action === "NEW_PAYMENT") {
          stationType = "cash";
        } else if (data.action === "NEW_DISTRIBUTION") {
          stationType = "scanner";
        } else if (data.action === "VERIFY_DISTRIBUTION") {
          stationType = "checker";
        } else if (data.action === "FREE_BOOK_CLAIM") {
          stationType = "free-book";
        }
        
        const stationKey = `${data.operatorName}-${stationType}`;
        
        // Create or update station activity
        const existing = stationMap.get(stationKey);
        const activityDate = new Date(timestamp);
        
        if (!existing) {
          stationMap.set(stationKey, {
            stationId: stationKey,
            stationType,
            operatorName: data.operatorName,
            lastActivity: activityDate,
            studentId: data.studentId,
            studentName: data.studentName,
            action: data.action,
            activityCount: 1,
            totalBooks: stationType === "scanner" ? 1 : 0,
            totalPayments: stationType === "cash" ? 1 : 0
          });
        } else if (activityDate > existing.lastActivity) {
          stationMap.set(stationKey, {
            ...existing,
            lastActivity: activityDate,
            studentId: data.studentId,
            studentName: data.studentName,
            action: data.action,
            activityCount: (existing.activityCount || 0) + 1,
            totalBooks: stationType === "scanner" ? (existing.totalBooks || 0) + 1 : existing.totalBooks,
            totalPayments: stationType === "cash" ? (existing.totalPayments || 0) + 1 : existing.totalPayments
          });
        } else {
          // Just update the activity count
          stationMap.set(stationKey, {
            ...existing,
            activityCount: (existing.activityCount || 0) + 1,
            totalBooks: stationType === "scanner" ? (existing.totalBooks || 0) + 1 : existing.totalBooks,
            totalPayments: stationType === "cash" ? (existing.totalPayments || 0) + 1 : existing.totalPayments
          });
        }
      });
      
      // Filter out inactive sessions (older than specified threshold)
      const inactiveThresholdMs = inactivityThreshold * 60 * 1000;
      const inactiveTime = new Date(Date.now() - inactiveThresholdMs);
      
      // Only include sessions with recent activity
      const currentActiveStations = Array.from(stationMap.values())
        .filter(station => station.lastActivity > inactiveTime)
        .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      
      setActiveStations(currentActiveStations);
      
      // Prepare chart data for daily activity
      const activityData = Object.entries(dailyActivity)
        .map(([_, stats]) => stats)
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateA.getTime() - dateB.getTime();
        });
      
      setActivityStats(activityData);
      
      // Prepare distribution stats by operator
      const distributionData = Object.entries(booksByOperator).map(([name, count]) => ({
        name,
        books: count
      }));
      setDistributionStats(distributionData);
      
      // Prepare payment stats by operator
      const paymentData = Object.entries(paymentsByOperator).map(([name, count]) => ({
        name,
        payments: count
      }));
      setPaymentStats(paymentData);
      
      // Prepare operator activity stats
      const operatorData = Object.entries(operatorActivity).map(([name, count]) => ({
        name,
        activities: count
      }));
      setOperatorStats(operatorData);
    }
  }, [formattedLogs && formattedLogs.length, inactivityThreshold]);
  
  // Get a friendly name for the station type
  const getStationName = (type: string): string => {
    switch (type) {
      case "cash": return "Cash Station";
      case "scanner": return "Distribution Station";
      case "checker": return "Checker Station";
      case "free-book": return "Free Book Station";
      default: return "Unknown Station";
    }
  };
  
  // Get an icon for the station type
  const getStationIcon = (type: string): IconProp => {
    switch (type) {
      case "cash": return "cash-register" as IconProp;
      case "scanner": return "barcode" as IconProp;
      case "checker": return "clipboard-check" as IconProp;
      case "free-book": return "gift" as IconProp;
      default: return "question-circle" as IconProp;
    }
  };
  
  // Get a color for the station badge
  const getStationColor = (type: string): string => {
    switch (type) {
      case "cash": return "bg-green-100 text-green-800";
      case "scanner": return "bg-blue-100 text-blue-800";
      case "checker": return "bg-purple-100 text-purple-800";
      case "free-book": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };
  
  // Get a description of the activity
  const getActivityDescription = (activity: StationActivity): string => {
    switch (activity.stationType) {
      case "cash":
        return `Processing payment for ${activity.studentName || activity.studentId || 'a student'}`;
      case "scanner":
        return `Distributing yearbook to ${activity.studentName || activity.studentId || 'a student'}`;
      case "checker":
        return `Verifying distribution for ${activity.studentName || activity.studentId || 'a student'}`;
      case "free-book":
        return `Processing free book for ${activity.studentName || activity.studentId || 'a student'}`;
      default:
        return `Activity with ${activity.studentName || activity.studentId || 'a student'}`;
    }
  };
  
  // Define chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  // Activity type to icon mapping
  const actionIcons: Record<string, IconProp> = {
    "NEW_DISTRIBUTION": "barcode" as IconProp,
    "VERIFY_DISTRIBUTION": "clipboard-check" as IconProp,
    "NEW_PAYMENT": "cash-register" as IconProp,
    "FREE_BOOK_CLAIM": "gift" as IconProp
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };
  
  // Handle inactivity threshold change
  const handleThresholdChange = (value: number) => {
    setInactivityThreshold(value);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-neutral-800">
          System Overview
        </h3>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-neutral-600">Auto-logout after</span>
            <select 
              value={inactivityThreshold} 
              onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
              className="py-1 px-2 text-sm border border-neutral-200 rounded-md"
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
          <Badge variant="outline" className="px-2 py-1 text-xs">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
            Live Updates
          </Badge>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
        </TabsList>
        
        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Sessions */}
            <Card>
              <CardContent className="p-6">
                <h4 className="text-lg font-medium text-neutral-800 mb-4 flex items-center">
                  <FontAwesomeIcon icon={"users" as IconProp} className="text-neutral-400 mr-2" />
                  Active Sessions
                </h4>
                
                {activeStations.length > 0 ? (
                  <div className="space-y-4">
                    {activeStations.map((station) => (
                      <div 
                        key={station.stationId} 
                        className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getStationColor(station.stationType).split(' ')[0]}`}>
                              <FontAwesomeIcon icon={getStationIcon(station.stationType)} className={getStationColor(station.stationType).split(' ')[1]} />
                            </div>
                            <div>
                              <p className="font-medium text-neutral-800">{station.operatorName}</p>
                              <p className="text-sm text-neutral-500">{getStationName(station.stationType)}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatDistanceToNow(station.lastActivity, { addSuffix: true })}
                          </Badge>
                        </div>
                        
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-neutral-600">{getActivityDescription(station)}</p>
                          
                          {station.stationType === "scanner" && station.totalBooks && (
                            <p className="text-sm font-medium">
                              <span className="text-blue-600">{station.totalBooks}</span> yearbooks distributed
                            </p>
                          )}
                          
                          {station.stationType === "cash" && station.totalPayments && (
                            <p className="text-sm font-medium">
                              <span className="text-green-600">{station.totalPayments}</span> payments processed
                            </p>
                          )}
                          
                          {station.activityCount && (
                            <p className="text-xs text-neutral-500">
                              {station.activityCount} total activities
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-neutral-500">
                    <FontAwesomeIcon icon={"info-circle" as IconProp} className="text-neutral-300 text-4xl mb-3" />
                    <p>No active sessions detected</p>
                    <p className="text-sm text-neutral-400 mt-1">
                      Activity will appear here when operators use the system
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Station Stats */}
            <Card>
              <CardContent className="p-6">
                <h4 className="text-lg font-medium text-neutral-800 mb-4 flex items-center">
                  <FontAwesomeIcon icon={"chart-bar" as IconProp} className="text-neutral-400 mr-2" />
                  Daily Activity Overview
                </h4>
                
                {activityStats.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        width={500}
                        height={300}
                        data={activityStats}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 0,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="distributions" stackId="1" stroke="#0088FE" fill="#0088FE" />
                        <Area type="monotone" dataKey="payments" stackId="1" stroke="#00C49F" fill="#00C49F" />
                        <Area type="monotone" dataKey="verifications" stackId="1" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="freeBooks" stackId="1" stroke="#FFBB28" fill="#FFBB28" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-10 text-neutral-500">
                    <FontAwesomeIcon icon={"info-circle" as IconProp} className="text-neutral-300 text-4xl mb-3" />
                    <p>No activity data available</p>
                    <p className="text-sm text-neutral-400 mt-1">
                      Data will appear once operators start using the system
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {/* Cash Station Stats */}
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-xs font-medium text-green-800">Cash</h5>
                      <FontAwesomeIcon icon={"cash-register" as IconProp} className="text-green-500 text-xs" />
                    </div>
                    <p className="text-xl font-bold text-green-800">
                      {activeStations.filter(s => s.stationType === "cash").length}
                    </p>
                  </div>
                  
                  {/* Distribution Stats */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-xs font-medium text-blue-800">Distribution</h5>
                      <FontAwesomeIcon icon={"barcode" as IconProp} className="text-blue-500 text-xs" />
                    </div>
                    <p className="text-xl font-bold text-blue-800">
                      {activeStations.filter(s => s.stationType === "scanner").length}
                    </p>
                  </div>
                  
                  {/* Checker Stats */}
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-xs font-medium text-purple-800">Checkers</h5>
                      <FontAwesomeIcon icon={"clipboard-check" as IconProp} className="text-purple-500 text-xs" />
                    </div>
                    <p className="text-xl font-bold text-purple-800">
                      {activeStations.filter(s => s.stationType === "checker").length}
                    </p>
                  </div>
                  
                  {/* Free Book Stats */}
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-xs font-medium text-amber-800">Free Books</h5>
                      <FontAwesomeIcon icon={"gift" as IconProp} className="text-amber-500 text-xs" />
                    </div>
                    <p className="text-xl font-bold text-amber-800">
                      {activeStations.filter(s => s.stationType === "free-book").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Activity Log */}
          <Card>
            <CardContent className="p-6">
              <h4 className="text-lg font-medium text-neutral-800 mb-4 flex items-center">
                <FontAwesomeIcon icon={"history" as IconProp} className="text-neutral-400 mr-2" />
                Recent Activity
              </h4>
              
              <div className="rounded-lg border border-neutral-100 overflow-hidden">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Operator</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Action</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {formattedLogs.slice(0, 10).map((log, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                        <td className="px-6 py-2 whitespace-nowrap text-xs text-neutral-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          <div className="text-xs font-medium text-neutral-700">{log.data.operatorName || 'System'}</div>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                            {actionIcons[log.data.action] && (
                              <FontAwesomeIcon icon={actionIcons[log.data.action]} className="mr-1 text-neutral-500" />
                            )}
                            {log.data.action}
                          </span>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-xs text-neutral-500">
                          {log.data.studentName || log.data.studentId || 'N/A'}
                        </td>
                      </tr>
                    ))}
                    
                    {formattedLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-neutral-500">
                          No activity logs available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ACTIVITY TAB */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h4 className="text-lg font-medium text-neutral-800 mb-4">Activity Trends</h4>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    width={500}
                    height={300}
                    data={activityStats}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="distributions" stroke="#0088FE" activeDot={{ r: 8 }} name="Distributions" />
                    <Line type="monotone" dataKey="payments" stroke="#00C49F" name="Payments" />
                    <Line type="monotone" dataKey="verifications" stroke="#8884d8" name="Verifications" />
                    <Line type="monotone" dataKey="freeBooks" stroke="#FFBB28" name="Free Books" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-md font-medium text-neutral-800 mb-4">Distribution vs Payment</h5>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        width={500}
                        height={300}
                        data={activityStats}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="distributions" fill="#0088FE" name="Distributions" />
                        <Bar dataKey="payments" fill="#00C49F" name="Payments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div>
                  <h5 className="text-md font-medium text-neutral-800 mb-4">Activity Distribution</h5>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart width={400} height={400}>
                        <Pie
                          data={[
                            { name: 'Distributions', value: activityStats.reduce((sum, day) => sum + day.distributions, 0) },
                            { name: 'Payments', value: activityStats.reduce((sum, day) => sum + day.payments, 0) },
                            { name: 'Verifications', value: activityStats.reduce((sum, day) => sum + day.verifications, 0) },
                            { name: 'Free Books', value: activityStats.reduce((sum, day) => sum + day.freeBooks, 0) },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {[
                            { name: 'Distributions', value: activityStats.reduce((sum, day) => sum + day.distributions, 0) },
                            { name: 'Payments', value: activityStats.reduce((sum, day) => sum + day.payments, 0) },
                            { name: 'Verifications', value: activityStats.reduce((sum, day) => sum + day.verifications, 0) },
                            { name: 'Free Books', value: activityStats.reduce((sum, day) => sum + day.freeBooks, 0) },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* STATISTICS TAB */}
        <TabsContent value="statistics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h4 className="text-lg font-medium text-neutral-800 mb-4">Yearbooks Distributed by Operator</h4>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      width={500}
                      height={300}
                      data={distributionStats}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="books" fill="#0088FE" name="Yearbooks Distributed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {distributionStats.length > 0 ? (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-neutral-700 mb-2">Distribution Summary</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Total Distributed:</span>
                        <span className="text-sm font-medium text-neutral-800">
                          {distributionStats.reduce((sum, op) => sum + op.books, 0)} yearbooks
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Most Active Operator:</span>
                        <span className="text-sm font-medium text-neutral-800">
                          {distributionStats.length > 0 ? 
                            distributionStats.sort((a, b) => b.books - a.books)[0].name : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Average Per Operator:</span>
                        <span className="text-sm font-medium text-neutral-800">
                          {distributionStats.length > 0 ? 
                            (distributionStats.reduce((sum, op) => sum + op.books, 0) / distributionStats.length).toFixed(1) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-neutral-500">
                    <p>No distribution data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h4 className="text-lg font-medium text-neutral-800 mb-4">Payments Processed by Operator</h4>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      width={500}
                      height={300}
                      data={paymentStats}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="payments" fill="#00C49F" name="Payments Processed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {paymentStats.length > 0 ? (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-neutral-700 mb-2">Payment Summary</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Total Payments:</span>
                        <span className="text-sm font-medium text-neutral-800">
                          {paymentStats.reduce((sum, op) => sum + op.payments, 0)} transactions
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Most Active Cashier:</span>
                        <span className="text-sm font-medium text-neutral-800">
                          {paymentStats.length > 0 ? 
                            paymentStats.sort((a, b) => b.payments - a.payments)[0].name : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Estimated Total:</span>
                        <span className="text-sm font-medium text-green-600">
                          {paymentStats.length > 0 ? 
                            formatCurrency(paymentStats.reduce((sum, op) => sum + op.payments, 0) * 90) : '$0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-neutral-500">
                    <p>No payment data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* OPERATORS TAB */}
        <TabsContent value="operators" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h4 className="text-lg font-medium text-neutral-800 mb-4">Operator Activity</h4>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    width={500}
                    height={300}
                    data={operatorStats}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="activities" fill="#8884d8" name="Total Activities" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-6">
                <h5 className="text-md font-medium text-neutral-800 mb-4">Operator Status</h5>
                
                <div className="overflow-hidden rounded-lg border border-neutral-200">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Operator</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Last Active</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Station</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {activeStations.map((station) => (
                        <tr key={station.stationId}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-neutral-900">{station.operatorName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                            {formatDistanceToNow(station.lastActivity, { addSuffix: true })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                            {getStationName(station.stationType)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="outline" size="sm" className="text-xs">
                              <FontAwesomeIcon icon={"sign-out-alt" as IconProp} className="mr-1" />
                              Force Logout
                            </Button>
                          </td>
                        </tr>
                      ))}
                      
                      {activeStations.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 text-center">
                            No active operators
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}