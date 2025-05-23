import { useState, useEffect } from "react";
import { socketProvider } from "@/lib/socket";
import { ActionLog, Distribution, Payment } from "@shared/schema";

// Store logs in a shared state outside the hook
const sharedLogs: any[] = [];
let isInitialized = false;

export function useWsLogs() {
  const [logs, setLogs] = useState<any[]>(sharedLogs);
  const [isConnected, setIsConnected] = useState(socketProvider.isConnected());

  useEffect(() => {
    // Only initialize once from the API
    if (!isInitialized) {
      isInitialized = true;
      
      // Initial fetch of logs from API
      fetch("/api/logs?limit=50")
        .then((res) => res.json())
        .then((data) => {
          const initialLogs = data.map((log: ActionLog) => ({
            type: log.action,
            data: log,
            timestamp: new Date(log.timestamp)
          }));
          
          // Update shared logs and component state
          sharedLogs.length = 0;
          sharedLogs.push(...initialLogs);
          setLogs([...sharedLogs]);
        })
        .catch((err) => console.error("Failed to fetch logs:", err));
    }
    
    // Subscribe to all message types
    const unsubscribe = socketProvider.subscribe("all", (message) => {
      setIsConnected(true);
      
      // Skip PING messages
      if (message.type === "PING") return;
      
      // Add the new log at the beginning of shared logs
      const newLog = {
        type: message.type,
        data: message.data,
        timestamp: new Date()
      };
      
      // Update shared logs
      sharedLogs.unshift(newLog);
      if (sharedLogs.length > 100) {
        sharedLogs.pop(); // Keep only latest 100
      }
      
      // Update component state
      setLogs([...sharedLogs]);
    });
    
    // Ensure component state stays in sync with shared logs
    setLogs([...sharedLogs]);
    
    // Update connection state
    const connectionHandler = () => setIsConnected(socketProvider.isConnected());
    socketProvider.onConnect(connectionHandler);
    socketProvider.onDisconnect(connectionHandler);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      socketProvider.offConnect(connectionHandler);
      socketProvider.offDisconnect(connectionHandler);
    };
  }, []);

  // Function to format logs for display
  const formatLogEntry = (log: any) => {
    const type = log.type;
    let icon = "";
    let color = "";
    let title = "";
    let details = "";

    switch (type) {
      case "LOG_ACTION":
      case "CREATE_STUDENT":
      case "UPDATE_STUDENT":
      case "DELETE_STUDENT":
        icon = "edit";
        color = "bg-blue-100 text-blue-800";
        title = "Database Updated";
        details = `${log.data.operatorName} updated student record`;
        break;
      case "DISTRIBUTE_YEARBOOK":
      case "NEW_DISTRIBUTION":
        icon = "check_circle";
        color = "bg-green-100 text-green-800";
        title = "Yearbook Distributed";
        details = `to student ${log.data.studentId} by ${log.data.operatorName}`;
        break;
      case "VERIFY_DISTRIBUTION":
        icon = "verified";
        color = "bg-purple-100 text-purple-800";
        title = "Verified Delivery";
        details = `for student ${log.data.studentId} by ${log.data.verifiedBy}`;
        break;
      case "PROCESS_PAYMENT":
      case "NEW_PAYMENT":
        icon = "payments";
        color = "bg-yellow-100 text-yellow-800";
        title = "Payment Processed";
        details = `for student ${log.data.studentId} by ${log.data.operatorName}`;
        break;
      case "ISSUE_FREE_BOOK":
        icon = "redeem";
        color = "bg-green-100 text-green-800";
        title = "Free Book Issued";
        details = `to student ${log.data.studentId} by ${log.data.operatorName}`;
        break;
      case "IMPORT_STUDENTS":
        icon = "upload_file";
        color = "bg-blue-100 text-blue-800";
        title = "Students Imported";
        details = `${log.data.details?.count || 0} students imported by ${log.data.operatorName}`;
        break;
      default:
        icon = "info";
        color = "bg-gray-100 text-gray-800";
        title = "System Event";
        details = "Unknown event occurred";
    }

    return {
      icon,
      color,
      title,
      details,
      timestamp: log.timestamp,
      data: log.data
    };
  };

  return {
    logs,
    formattedLogs: logs.map(formatLogEntry),
    isConnected
  };
}
