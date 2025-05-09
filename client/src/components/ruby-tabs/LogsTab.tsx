import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ActionLog } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { socketProvider } from "@/lib/socket";

interface LogsTabProps {
  operatorName: string;
}

// Define log action types with their display names and colors
const LOG_TYPES = {
  'CREATE_STUDENT': { name: 'Create Student', color: 'bg-blue-100 text-blue-800' },
  'UPDATE_STUDENT': { name: 'Update Student', color: 'bg-green-100 text-green-800' },
  'DELETE_STUDENT': { name: 'Delete Student', color: 'bg-red-100 text-red-800' },
  'IMPORT_STUDENTS': { name: 'Import Students', color: 'bg-purple-100 text-purple-800' },
  'CREATE_DISTRIBUTION': { name: 'Book Distribution', color: 'bg-yellow-100 text-yellow-800' },
  'VERIFY_DISTRIBUTION': { name: 'Verify Distribution', color: 'bg-green-100 text-green-800' },
  'PROCESS_PAYMENT': { name: 'Process Payment', color: 'bg-emerald-100 text-emerald-800' },
  'FREE_BOOK': { name: 'Free Book', color: 'bg-indigo-100 text-indigo-800' },
};

export function LogsTab({ operatorName }: LogsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  
  // Fetch logs
  const { 
    data: logs,
    isLoading: logsLoading,
    refetch: refetchLogs
  } = useQuery<ActionLog[]>({
    queryKey: ['/api/logs'],
    refetchInterval: 5000 // Refresh every 5 seconds
  });
  
  // WebSocket handling
  useEffect(() => {
    // Connect to WebSocket
    socketProvider.connect();
    
    const handleLogMessage = () => {
      refetchLogs();
    };
    
    // Subscribe to log events
    socketProvider.subscribe('LOG_ACTION', handleLogMessage);
    socketProvider.subscribe('NEW_DISTRIBUTION', handleLogMessage);
    socketProvider.subscribe('VERIFY_DISTRIBUTION', handleLogMessage);
    socketProvider.subscribe('NEW_PAYMENT', handleLogMessage);
    
    // Cleanup on unmount
    return () => {
      socketProvider.unsubscribe('LOG_ACTION', handleLogMessage);
      socketProvider.unsubscribe('NEW_DISTRIBUTION', handleLogMessage);
      socketProvider.unsubscribe('VERIFY_DISTRIBUTION', handleLogMessage);
      socketProvider.unsubscribe('NEW_PAYMENT', handleLogMessage);
    };
  }, [refetchLogs]);
  
  // Filter logs based on search term and selected type
  const filteredLogs = logs?.filter(log => {
    const matchesSearch = searchTerm === "" || 
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.operatorName.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesType = selectedType === null || log.action === selectedType;
    
    return matchesSearch && matchesType;
  }) || [];
  
  // Handle filter by type
  const handleFilterByType = (type: string) => {
    // If already selected, clear the filter
    if (selectedType === type) {
      setSelectedType(null);
    } else {
      setSelectedType(type);
      
      // Set the search term to the selected type name
      const typeName = LOG_TYPES[type as keyof typeof LOG_TYPES]?.name || type;
      setSearchTerm(typeName);
      
      // Focus the search input
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedType(null);
  };

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">System Logs</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  <FontAwesomeIcon icon="search" />
                </span>
                <Input
                  ref={searchInputRef}
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
                {searchTerm && (
                  <button
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-700"
                    onClick={() => setSearchTerm("")}
                  >
                    <FontAwesomeIcon icon="times-circle" />
                  </button>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!searchTerm && !selectedType}
              >
                <FontAwesomeIcon icon="filter" className="mr-2" />
                Clear Filters
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {Object.entries(LOG_TYPES).map(([type, info]) => (
                <Badge
                  key={type}
                  variant="outline"
                  className={`cursor-pointer hover:opacity-80 ${selectedType === type ? 'ring-2 ring-offset-1 ring-primary' : ''} ${info.color}`}
                  onClick={() => handleFilterByType(type)}
                >
                  {info.name}
                  {selectedType === type && (
                    <FontAwesomeIcon icon="check" className="ml-1 text-xs" />
                  )}
                </Badge>
              ))}
            </div>
            
            {logsLoading ? (
              <div className="flex justify-center items-center py-12">
                <FontAwesomeIcon icon="spinner" className="animate-spin text-2xl text-neutral-400" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <FontAwesomeIcon icon="inbox" className="text-3xl mb-4 text-neutral-300" />
                <p>No logs found {searchTerm && `for "${searchTerm}"`}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Operator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleDateString()} {' '}
                          {new Date(log.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={LOG_TYPES[log.action as keyof typeof LOG_TYPES]?.color || 'bg-neutral-100 text-neutral-800'}
                          >
                            {LOG_TYPES[log.action as keyof typeof LOG_TYPES]?.name || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.studentId ? (
                            <span className="font-mono">{log.studentId}</span>
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md truncate">{log.details}</TableCell>
                        <TableCell>{log.operatorName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            <div className="text-sm text-neutral-500">
              Showing {filteredLogs.length} of {logs?.length || 0} logs
              {searchTerm && ` matching "${searchTerm}"`}
              {selectedType && ` with type "${LOG_TYPES[selectedType as keyof typeof LOG_TYPES]?.name || selectedType}"`}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}