import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { socketProvider } from "@/lib/socket";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { formatDistanceToNow } from "date-fns";

interface StationActivity {
  stationId: string;
  stationType: "cash" | "scanner" | "checker" | "free-book";
  operatorName: string;
  lastActivity: Date;
  studentId?: string;
  studentName?: string;
  action?: string;
}

interface OverviewTabProps {
  operatorName: string;
}

export function OverviewTab({ operatorName }: OverviewTabProps) {
  const [activeStations, setActiveStations] = useState<StationActivity[]>([]);
  const { formattedLogs } = useWsLogs();
  
  // Process logs to extract station activity
  useEffect(() => {
    // Group logs by operator and station type
    const stationMap = new Map<string, StationActivity>();
    
    formattedLogs.forEach((log) => {
      const { data, timestamp } = log;
      if (!data.operatorName) return;
      
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
      
      if (!existing || activityDate > existing.lastActivity) {
        stationMap.set(stationKey, {
          stationId: stationKey,
          stationType,
          operatorName: data.operatorName,
          lastActivity: activityDate,
          studentId: data.studentId,
          studentName: data.studentName,
          action: data.action
        });
      }
    });
    
    // Convert map to array and sort by last activity (most recent first)
    const activities = Array.from(stationMap.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    
    setActiveStations(activities);
  }, [formattedLogs]);
  
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
  const getStationIcon = (type: string): string => {
    switch (type) {
      case "cash": return "cash-register";
      case "scanner": return "barcode";
      case "checker": return "clipboard-check";
      case "free-book": return "gift";
      default: return "question-circle";
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
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-neutral-800">
          System Overview
        </h3>
        <Badge variant="outline" className="px-2 py-1 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
          Live Updates
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions */}
        <Card>
          <CardContent className="p-6">
            <h4 className="text-lg font-medium text-neutral-800 mb-4 flex items-center">
              <FontAwesomeIcon icon="users" className="text-neutral-400 mr-2" />
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
                          <FontAwesomeIcon icon={getStationIcon(station.stationType) as any} className={getStationColor(station.stationType).split(' ')[1]} />
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
                    
                    <div className="mt-3 text-sm text-neutral-600">
                      <p>{getActivityDescription(station)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-neutral-500">
                <FontAwesomeIcon icon="info-circle" className="text-neutral-300 text-4xl mb-3" />
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
              <FontAwesomeIcon icon="chart-bar" className="text-neutral-400 mr-2" />
              Station Statistics
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Cash Station Stats */}
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-green-800">Cash Stations</h5>
                  <FontAwesomeIcon icon="cash-register" className="text-green-500" />
                </div>
                <p className="text-2xl font-bold text-green-800">
                  {activeStations.filter(s => s.stationType === "cash").length}
                </p>
                <p className="text-xs text-green-600 mt-1">Active operators</p>
              </div>
              
              {/* Distribution Stats */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-blue-800">Distribution</h5>
                  <FontAwesomeIcon icon="barcode" className="text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-blue-800">
                  {activeStations.filter(s => s.stationType === "scanner").length}
                </p>
                <p className="text-xs text-blue-600 mt-1">Active operators</p>
              </div>
              
              {/* Checker Stats */}
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-purple-800">Checkers</h5>
                  <FontAwesomeIcon icon="clipboard-check" className="text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-purple-800">
                  {activeStations.filter(s => s.stationType === "checker").length}
                </p>
                <p className="text-xs text-purple-600 mt-1">Active operators</p>
              </div>
              
              {/* Free Book Stats */}
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-amber-800">Free Books</h5>
                  <FontAwesomeIcon icon="gift" className="text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-800">
                  {activeStations.filter(s => s.stationType === "free-book").length}
                </p>
                <p className="text-xs text-amber-600 mt-1">Active operators</p>
              </div>
            </div>
            
            <div className="mt-4 bg-neutral-50 border border-neutral-100 rounded-lg p-4">
              <h5 className="text-sm font-medium text-neutral-700 mb-2">Recent User Activity</h5>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {formattedLogs.slice(0, 5).map((log, index) => (
                  <div key={index} className="flex items-center space-x-2 text-xs py-1 border-b border-neutral-100">
                    <span className="text-neutral-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="font-medium text-neutral-700">{log.data.operatorName || 'System'}</span>
                    <span className="text-neutral-600">{log.data.action}</span>
                    {log.data.studentId && (
                      <span className="text-neutral-500">for {log.data.studentName || log.data.studentId}</span>
                    )}
                  </div>
                ))}
                {formattedLogs.length === 0 && (
                  <p className="text-neutral-500 text-center text-xs py-2">No recent activity</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}