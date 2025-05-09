import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDateTime } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LogsTab() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchField, setSearchField] = useState<string>("all");
  
  const { toast } = useToast();
  const { formattedLogs } = useWsLogs();
  
  // Handle logs export
  const exportLogs = () => {
    if (formattedLogs && formattedLogs.length > 0) {
      // Format logs data for CSV export
      const headers = [
        "Timestamp", 
        "Action", 
        "Details", 
        "Student ID", 
        "Operator", 
        "Station"
      ].join(',');
      
      const rows = formattedLogs.map(log => {
        return [
          new Date(log.timestamp).toISOString(),
          log.title,
          log.details,
          log.data.studentId || 'N/A',
          log.data.operatorName || 'System',
          log.data.stationName || 'N/A'
        ].map(value => {
          // Handle strings with commas by wrapping in quotes
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',');
      });
      
      const csv = [headers, ...rows].join('\n');
      
      // Create a download link
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yearbook_logs_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "Logs Exported",
        description: "System logs exported successfully.",
      });
    } else {
      toast({
        title: "No Logs",
        description: "There are no logs to export.",
        variant: "destructive"
      });
    }
  };
  
  // Applying filters to logs
  const filteredLogs = formattedLogs.filter(log => {
    // Filter by action type
    if (actionFilter !== 'all') {
      if (actionFilter === 'distribution' && 
          !(log.data.action === 'DISTRIBUTE' || log.data.action === 'VERIFY_DISTRIBUTION')) {
        return false;
      }
      if (actionFilter === 'checker' && log.data.action !== 'VERIFY_DISTRIBUTION') {
        return false;
      }
      if (actionFilter === 'cash' && log.data.action !== 'PAYMENT') {
        return false;
      }
      if (actionFilter === 'import' && log.data.action !== 'IMPORT_STUDENTS') {
        return false;
      }
      if (actionFilter === 'free' && log.data.action !== 'ISSUE_FREE_BOOK') {
        return false;
      }
    }
    
    // Filter by date
    if (dateFilter !== 'all') {
      const today = new Date();
      const logDate = new Date(log.timestamp);
      
      if (dateFilter === 'today') {
        if (logDate.getDate() !== today.getDate() ||
            logDate.getMonth() !== today.getMonth() ||
            logDate.getFullYear() !== today.getFullYear()) {
          return false;
        }
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (logDate.getDate() !== yesterday.getDate() ||
            logDate.getMonth() !== yesterday.getMonth() ||
            logDate.getFullYear() !== yesterday.getFullYear()) {
          return false;
        }
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        if (logDate < weekAgo) {
          return false;
        }
      }
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      
      if (searchField === 'all') {
        return (
          (log.data.studentId && log.data.studentId.toLowerCase().includes(term)) ||
          (log.data.operatorName && log.data.operatorName.toLowerCase().includes(term)) ||
          (log.title && log.title.toLowerCase().includes(term)) ||
          (log.details && log.details.toLowerCase().includes(term)) ||
          (log.data.stationName && log.data.stationName.toLowerCase().includes(term))
        );
      } else if (searchField === 'student') {
        return log.data.studentId && log.data.studentId.toLowerCase().includes(term);
      } else if (searchField === 'operator') {
        return log.data.operatorName && log.data.operatorName.toLowerCase().includes(term);
      } else if (searchField === 'action') {
        return log.title && log.title.toLowerCase().includes(term);
      } else if (searchField === 'station') {
        return log.data.stationName && log.data.stationName.toLowerCase().includes(term);
      }
    }
    
    return true;
  });
  
  // Update search terms based on filter buttons
  const handleActionFilterClick = (filter: string) => {
    setActionFilter(filter);
    
    // Automatically insert text into search box based on the selected filter
    if (filter === 'distribution') {
      setSearchTerm('distribution');
      setSearchField('action');
    } else if (filter === 'checker') {
      setSearchTerm('verification');
      setSearchField('action');
    } else if (filter === 'cash') {
      setSearchTerm('payment');
      setSearchField('action');
    } else if (filter === 'import') {
      setSearchTerm('import');
      setSearchField('action');
    } else if (filter === 'free') {
      setSearchTerm('free book');
      setSearchField('action');
    } else {
      setSearchTerm('');
    }
  };

  // JSX for the logs display
  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">System Logs</h3>
            <Button 
              onClick={exportLogs} 
              className="bg-primary"
            >
              <FontAwesomeIcon icon="download" className="mr-2" />
              Export Logs
            </Button>
          </div>
          
          {/* Filters and Search */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-neutral-700">Filter by Action Type</label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant={actionFilter === 'all' ? 'default' : 'outline'} 
                  className="text-xs px-3"
                  onClick={() => handleActionFilterClick('all')}
                >
                  <FontAwesomeIcon icon="list-ul" className="mr-1" />
                  All
                </Button>
                <Button 
                  size="sm" 
                  variant={actionFilter === 'distribution' ? 'default' : 'outline'} 
                  className="text-xs px-3"
                  onClick={() => handleActionFilterClick('distribution')}
                >
                  <FontAwesomeIcon icon="book" className="mr-1" />
                  Distribution
                </Button>
                <Button 
                  size="sm" 
                  variant={actionFilter === 'checker' ? 'default' : 'outline'}
                  className="text-xs px-3"
                  onClick={() => handleActionFilterClick('checker')}
                >
                  <FontAwesomeIcon icon="check-circle" className="mr-1" />
                  Verification
                </Button>
                <Button 
                  size="sm" 
                  variant={actionFilter === 'cash' ? 'default' : 'outline'}
                  className="text-xs px-3"
                  onClick={() => handleActionFilterClick('cash')}
                >
                  <FontAwesomeIcon icon="dollar-sign" className="mr-1" />
                  Payment
                </Button>
                <Button 
                  size="sm" 
                  variant={actionFilter === 'import' ? 'default' : 'outline'}
                  className="text-xs px-3"
                  onClick={() => handleActionFilterClick('import')}
                >
                  <FontAwesomeIcon icon="file-import" className="mr-1" />
                  Import
                </Button>
                <Button 
                  size="sm" 
                  variant={actionFilter === 'free' ? 'default' : 'outline'}
                  className="text-xs px-3"
                  onClick={() => handleActionFilterClick('free')}
                >
                  <FontAwesomeIcon icon="gift" className="mr-1" />
                  Free Book
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-neutral-700">Filter by Date</label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant={dateFilter === 'all' ? 'default' : 'outline'} 
                  className="text-xs px-3"
                  onClick={() => setDateFilter('all')}
                >
                  <FontAwesomeIcon icon="calendar" className="mr-1" />
                  All Time
                </Button>
                <Button 
                  size="sm" 
                  variant={dateFilter === 'today' ? 'default' : 'outline'} 
                  className="text-xs px-3"
                  onClick={() => setDateFilter('today')}
                >
                  <FontAwesomeIcon icon="calendar-day" className="mr-1" />
                  Today
                </Button>
                <Button 
                  size="sm" 
                  variant={dateFilter === 'yesterday' ? 'default' : 'outline'}
                  className="text-xs px-3"
                  onClick={() => setDateFilter('yesterday')}
                >
                  <FontAwesomeIcon icon="calendar-day" className="mr-1" />
                  Yesterday
                </Button>
                <Button 
                  size="sm" 
                  variant={dateFilter === 'week' ? 'default' : 'outline'}
                  className="text-xs px-3"
                  onClick={() => setDateFilter('week')}
                >
                  <FontAwesomeIcon icon="calendar-week" className="mr-1" />
                  Past Week
                </Button>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <div className="relative flex-grow">
                <FontAwesomeIcon 
                  icon="search" 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" 
                />
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full pl-10"
                />
              </div>
              <Select value={searchField} onValueChange={setSearchField}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Search in..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  <SelectItem value="student">Student ID</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="station">Station</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Logs Display */}
          <div className="rounded-md border border-neutral-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
              <div className="text-sm font-medium text-neutral-800">
                {filteredLogs.length} log entries
              </div>
              <div className="text-xs text-neutral-500">
                Showing most recent first
              </div>
            </div>
            
            <div className="space-y-0 divide-y divide-neutral-200 max-h-[600px] overflow-y-auto">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => (
                  <div key={index} className="flex items-start p-4 hover:bg-neutral-50 transition-colors">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white mr-3
                      ${log.data.action === 'DISTRIBUTE' ? 'bg-blue-500' : 
                      log.data.action === 'VERIFY_DISTRIBUTION' ? 'bg-green-500' : 
                      log.data.action === 'PAYMENT' ? 'bg-purple-500' : 
                      log.data.action === 'IMPORT_STUDENTS' ? 'bg-amber-500' : 
                      log.data.action === 'ISSUE_FREE_BOOK' ? 'bg-pink-500' : 'bg-neutral-500'}`}
                    >
                      <FontAwesomeIcon 
                        icon={
                          log.data.action === 'DISTRIBUTE' ? 'book' : 
                          log.data.action === 'VERIFY_DISTRIBUTION' ? 'check-circle' :
                          log.data.action === 'PAYMENT' ? 'dollar-sign' :
                          log.data.action === 'IMPORT_STUDENTS' ? 'file-import' :
                          log.data.action === 'ISSUE_FREE_BOOK' ? 'gift' : 'info-circle'
                        } 
                        size="sm" 
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="text-sm font-medium text-neutral-800">{log.title}</div>
                        <div className="text-xs text-neutral-500">
                          {formatDateTime(log.timestamp)}
                        </div>
                      </div>
                      <div className="text-sm text-neutral-600 mt-1">{log.details}</div>
                      <div className="flex flex-wrap gap-x-4 mt-2">
                        <div className="text-xs text-neutral-500 flex items-center">
                          <FontAwesomeIcon icon="id-card" className="mr-1 text-neutral-400" />
                          {log.data.studentId || 'N/A'}
                        </div>
                        <div className="text-xs text-neutral-500 flex items-center">
                          <FontAwesomeIcon icon="user" className="mr-1 text-neutral-400" />
                          {log.data.operatorName || 'System'}
                        </div>
                        <div className="text-xs text-neutral-500 flex items-center">
                          <FontAwesomeIcon icon="desktop" className="mr-1 text-neutral-400" />
                          {log.data.stationName || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-neutral-500 py-10">
                  <FontAwesomeIcon icon="search" className="text-neutral-300 mb-2" size="lg" />
                  <p>No logs match your search criteria</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}