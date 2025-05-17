import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActionLog } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useWsLogs } from "@/hooks/use-ws-logs";

interface LogsTabProps {
  operatorName: string;
}

export function LogsTab({ operatorName }: LogsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<ActionLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const queryClient = useQueryClient();
  
  // Get logs from WebSocket
  const { 
    logs, 
    formattedLogs, 
    isConnected 
  } = useWsLogs();
  
  const logsLoading = logs.length === 0 && !isConnected;
  const logsError = !isConnected && logs.length === 0;
  
  // Function to refresh logs
  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
  };
  
  // Convert WebSocket logs format to ActionLog format for consistency
  const convertedLogs = logs.map(log => {
    return log.data as ActionLog;
  });
  
  // Filter logs based on search term
  const filteredLogs = convertedLogs.filter(log => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      log.studentId?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.operatorName.toLowerCase().includes(searchLower) ||
      log.details?.toLowerCase().includes(searchLower)
    );
  });
  
  // Sort logs by timestamp (newest first)
  const sortedLogs = filteredLogs?.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  // Get badge color based on action type
  const getBadgeVariant = (action: string) => {
    switch (action) {
      case 'DISTRIBUTE_BOOK':
      case 'NEW_DISTRIBUTION':
        return 'default';
      case 'VERIFY_DISTRIBUTION':
        return 'secondary';
      case 'PROCESS_PAYMENT':
      case 'NEW_PAYMENT':
        return 'success';
      case 'ADD_STUDENT':
      case 'UPDATE_STUDENT':
        return 'info';
      case 'FREE_BOOK':
        return 'warning';
      default:
        return 'outline';
    }
  };
  
  // View log details
  const handleViewDetails = (log: ActionLog) => {
    setSelectedLog(log);
    setShowDetailDialog(true);
  };
  
  // Format JSON for display
  const formatJsonDisplay = (json: string | object): string => {
    try {
      if (typeof json === 'string') {
        json = JSON.parse(json);
      }
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return typeof json === 'string' ? json : JSON.stringify(json);
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium text-neutral-800 mb-1">System Logs</h3>
              <p className="text-neutral-600 text-sm">View all system actions and events</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                <FontAwesomeIcon icon="sync" className="mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          
          <div className="mb-4">
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          {logsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FontAwesomeIcon icon="spinner" className="animate-spin text-3xl text-neutral-400 mb-2" />
                <p className="text-neutral-600">Loading logs...</p>
              </div>
            </div>
          ) : logsError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Failed to load logs. Please try refreshing.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-auto max-h-[600px] rounded-md border">
              <Table>
                <TableCaption>
                  {sortedLogs?.length 
                    ? `${sortedLogs.length} log${sortedLogs.length > 1 ? 's' : ''} found`
                    : 'No logs found'}
                </TableCaption>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[120px]">Student ID</TableHead>
                    <TableHead className="w-[150px]">Action</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLogs?.length ? (
                    sortedLogs.map((log) => (
                      <TableRow 
                        key={log.id} 
                        className="cursor-pointer hover:bg-neutral-50" 
                        onClick={() => handleViewDetails(log)}
                      >
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell>{log.studentId || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(log.action) as any}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.operatorName}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <FontAwesomeIcon icon="info-circle" className="mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-neutral-500">
                        No logs found. System activity will be recorded here.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Log Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Timestamp</h4>
                  <p className="text-sm">
                    {format(new Date(selectedLog.timestamp), 'MMMM d, yyyy h:mm:ss a')}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Action Type</h4>
                  <Badge variant={getBadgeVariant(selectedLog.action) as any}>
                    {selectedLog.action}
                  </Badge>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Student ID</h4>
                  <p className="text-sm">{selectedLog.studentId || '-'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Operator</h4>
                  <p className="text-sm">{selectedLog.operatorName}</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-neutral-500 mb-2">Details</h4>
                <pre className="bg-neutral-50 p-3 rounded-md overflow-auto text-xs max-h-[300px]">
                  {formatJsonDisplay(selectedLog.details || {})}
                </pre>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}