import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionLog, Distribution, Payment } from "@shared/schema";
import { formatTime } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { socketProvider } from "@/lib/socket";

interface RecentActivityProps {
  stationType: "distribution" | "checker" | "cash" | "ruby";
  searchTerm?: string;
}

export function RecentActivity({ stationType }: RecentActivityProps) {
  const queryClient = useQueryClient();
  const { logs, isConnected } = useWsLogs();
  
  // Connect to WebSocket on component mount
  useEffect(() => {
    socketProvider.connect();
    
    return () => {
      // No need to disconnect as other components might be using the socket
    };
  }, []);
  
  // Invalidate queries when new events arrive
  useEffect(() => {
    if (logs.length > 0) {
      const latestLog = logs[0];
      
      if (latestLog.type === 'NEW_DISTRIBUTION' && stationType === 'distribution') {
        queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      } else if (latestLog.type === 'VERIFY_DISTRIBUTION' && stationType === 'checker') {
        queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
      } else if (latestLog.type === 'NEW_PAYMENT' && stationType === 'cash') {
        queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      }
    }
  }, [logs, stationType, queryClient]);
  
  // Distribution station shows recent distributions
  const { data: distributions } = useQuery<Distribution[]>({
    queryKey: ['/api/distributions'],
    queryFn: async () => {
      const res = await fetch('/api/distributions?limit=10');
      if (!res.ok) throw new Error('Failed to fetch distributions');
      return res.json();
    },
    enabled: stationType === "distribution",
    staleTime: 10000
  });

  // Checker station shows recent verifications
  const { data: logsForCheckers } = useQuery<ActionLog[]>({
    queryKey: ['/api/logs'],
    queryFn: async () => {
      const res = await fetch('/api/logs?limit=10');
      if (!res.ok) throw new Error('Failed to fetch logs');
      const allLogs = await res.json();
      return allLogs.filter((log: ActionLog) => log.action === "VERIFY_DISTRIBUTION");
    },
    enabled: stationType === "checker",
    staleTime: 10000
  });

  // Cash station shows recent payments
  const { data: payments } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
    queryFn: async () => {
      const res = await fetch('/api/payments?limit=10');
      if (!res.ok) throw new Error('Failed to fetch payments');
      return res.json();
    },
    enabled: stationType === "cash",
    staleTime: 10000
  });

  const getComponentContent = () => {
    switch (stationType) {
      case "distribution":
        return (
          <>
            <h3 className="text-lg font-medium text-neutral-800 mb-4">Recent Activity</h3>
            <div className="overflow-hidden overflow-x-auto rounded-md border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Action</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Operator</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {distributions && distributions.length > 0 ? (
                    distributions.map((dist) => (
                      <tr key={dist.id} className="hover:bg-neutral-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-500">
                          {formatTime(dist.timestamp)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-neutral-800">
                          {dist.studentId}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600 hidden sm:table-cell">
                          Yearbook distributed
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600 hidden sm:table-cell">
                          {dist.operatorName}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-neutral-500">
                        No recent distributions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        );

      case "checker":
        return (
          <>
            <h3 className="text-lg font-medium text-neutral-800 mb-4">Recent Verifications</h3>
            <div className="overflow-hidden overflow-x-auto rounded-md border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Distribution</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Verified By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {logsForCheckers && logsForCheckers.length > 0 ? (
                    logsForCheckers.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-500">
                          {formatTime(log.timestamp)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-neutral-800">
                          {log.studentId}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600 hidden sm:table-cell">
                          {log.details && typeof log.details === 'object' && 'distribution' in log.details ? 
                            (log.details.distribution as any)?.operatorName || "Unknown" : "Unknown"}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600 hidden sm:table-cell">
                          {log.operatorName}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-neutral-500">
                        No recent verifications
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        );

      case "cash":
        return (
          <>
            <h3 className="text-lg font-medium text-neutral-800 mb-4">Recent Payments</h3>
            <div className="space-y-2">
              {payments && payments.length > 0 ? (
                payments.map((payment) => (
                  <div key={payment.id} className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors rounded-md">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                      <div className="mb-2 sm:mb-0">
                        <p className="text-sm font-medium text-neutral-800">{payment.studentId}</p>
                        <p className="text-xs text-neutral-500">{formatTime(payment.timestamp)}</p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end">
                        <span className="text-xs text-neutral-500 mr-2 sm:hidden">Amount:</span>
                        <span className="text-sm font-medium text-green-600">
                          ${Number(payment.amountPaid).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-neutral-500 rounded-md border border-neutral-200">
                  No recent payments
                </div>
              )}
            </div>
          </>
        );

      default:
        return (
          <div className="text-center py-4 text-sm text-neutral-500">
            No recent activity
          </div>
        );
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex justify-between items-center mb-2">
          <div className="hidden">
            {/* Space for potential future labels */}
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-xs text-neutral-500">{isConnected ? 'Live Updates' : 'Connecting...'}</span>
          </div>
        </div>
        {getComponentContent()}
      </CardContent>
    </Card>
  );
}
