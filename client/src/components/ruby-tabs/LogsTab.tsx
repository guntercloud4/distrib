import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function LogsTab() {
  const [logsFilter, setLogsFilter] = useState<string>("all");
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

  // Get filtered logs
  const filteredLogs = formattedLogs.filter(log => {
    if (logsFilter === 'all') return true;
    if (logsFilter === 'distribution') return log.data.action === 'DISTRIBUTE' || log.data.action === 'VERIFY_DISTRIBUTION';
    if (logsFilter === 'checker') return log.data.action === 'VERIFY_DISTRIBUTION';
    if (logsFilter === 'cash') return log.data.action === 'PAYMENT';
    return true;
  });

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
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant={logsFilter === 'all' ? 'default' : 'outline'} 
                className="text-xs px-4"
                onClick={() => setLogsFilter('all')}
              >
                All
              </Button>
              <Button 
                size="sm" 
                variant={logsFilter === 'distribution' ? 'default' : 'outline'} 
                className="text-xs px-4"
                onClick={() => setLogsFilter('distribution')}
              >
                Distribution
              </Button>
              <Button 
                size="sm" 
                variant={logsFilter === 'checker' ? 'default' : 'outline'}
                className="text-xs px-4"
                onClick={() => setLogsFilter('checker')}
              >
                Verification
              </Button>
              <Button 
                size="sm" 
                variant={logsFilter === 'cash' ? 'default' : 'outline'}
                className="text-xs px-4"
                onClick={() => setLogsFilter('cash')}
              >
                Payment
              </Button>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-md">
                  <div className={`flex-shrink-0 h-8 w-8 rounded-full ${log.color} flex items-center justify-center`}>
                    <i className="material-icons text-sm">{log.icon}</i>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium text-neutral-800">{log.title}</p>
                      <p className="text-xs text-neutral-500">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">{log.details}</p>
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-neutral-500">
                        Student ID: {log.data.studentId || 'N/A'}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Operator: {log.data.operatorName || 'System'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-neutral-500 py-10">
                No system logs found for the selected filter
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}