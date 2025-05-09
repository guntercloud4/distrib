import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Student } from "@shared/schema";
import { formatCurrency, formatDate } from "@/lib/utils";

export function DatabaseTab() {
  const [databaseStatus, setDatabaseStatus] = useState<"checking" | "online" | "error">("checking");
  const [statusMessage, setStatusMessage] = useState("Checking database connection...");
  const [exportLoading, setExportLoading] = useState(false);
  const { toast } = useToast();

  // Fetch database status
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const res = await fetch('/api/database/status');
        if (res.ok) {
          const data = await res.json();
          setDatabaseStatus("online");
          setStatusMessage(`Database connected successfully. ${data.message || ''}`);
        } else {
          setDatabaseStatus("error");
          setStatusMessage("Database connection failed.");
        }
      } catch (error) {
        setDatabaseStatus("error");
        setStatusMessage("Error checking database status.");
      }
    };
    
    checkDatabase();
  }, []);

  // Fetch students for export
  const { data: students, isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    enabled: databaseStatus === "online",
    initialData: [],
  });

  // Fetch logs for export
  const { data: logs, isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ['/api/logs'],
    enabled: databaseStatus === "online",
    initialData: [],
  });

  // Fetch distributions for export
  const { data: distributions, isLoading: distributionsLoading } = useQuery<any[]>({
    queryKey: ['/api/distributions'],
    enabled: databaseStatus === "online",
    initialData: [],
  });

  // Fetch payments for export
  const { data: payments, isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: ['/api/payments'],
    enabled: databaseStatus === "online",
    initialData: [],
  });

  // Export data as CSV
  const exportData = (type: 'students' | 'logs' | 'distributions' | 'payments') => {
    setExportLoading(true);
    
    try {
      let data: any[] = [];
      let headers: string[] = [];
      let filename = '';
      
      switch (type) {
        case 'students':
          if (!students || students.length === 0) {
            toast({
              title: "No Data",
              description: "There are no students to export.",
              variant: "destructive"
            });
            setExportLoading(false);
            return;
          }
          
          data = students;
          headers = ['ID', 'Student ID', 'Name', 'Grade', 'Balance Due', 'Payment Status', 
                    'Yearbook', 'Personalization', 'Signature Package', 'Clear Cover', 'Photo Pockets'];
          filename = 'students';
          break;
          
        case 'logs':
          if (!logs || logs.length === 0) {
            toast({
              title: "No Data",
              description: "There are no logs to export.",
              variant: "destructive"
            });
            setExportLoading(false);
            return;
          }
          
          data = logs;
          headers = ['ID', 'Timestamp', 'Action', 'Student ID', 'Operator', 'Details'];
          filename = 'logs';
          break;
          
        case 'distributions':
          if (!distributions || distributions.length === 0) {
            toast({
              title: "No Data",
              description: "There are no distributions to export.",
              variant: "destructive"
            });
            setExportLoading(false);
            return;
          }
          
          data = distributions;
          headers = ['ID', 'Timestamp', 'Student ID', 'Operator', 'Verified', 'Verified By', 'Verified At'];
          filename = 'distributions';
          break;
          
        case 'payments':
          if (!payments || payments.length === 0) {
            toast({
              title: "No Data",
              description: "There are no payments to export.",
              variant: "destructive"
            });
            setExportLoading(false);
            return;
          }
          
          data = payments;
          headers = ['ID', 'Timestamp', 'Student ID', 'Amount Paid', 'Operator', 'Change Due'];
          filename = 'payments';
          break;
      }
      
      // Generate CSV content
      const csvRows = [];
      csvRows.push(headers.join(','));
      
      for (const row of data) {
        const values = [];
        
        // Format based on type
        switch (type) {
          case 'students':
            values.push(
              row.id,
              `"${row.studentId}"`,
              `"${row.name}"`,
              `"${row.grade || ''}"`,
              row.balanceDue,
              `"${row.paymentStatus}"`,
              row.yearbook ? 'Yes' : 'No',
              row.personalization ? 'Yes' : 'No',
              row.signaturePackage ? 'Yes' : 'No',
              row.clearCover ? 'Yes' : 'No',
              row.photoPockets ? 'Yes' : 'No'
            );
            break;
            
          case 'logs':
            values.push(
              row.id,
              new Date(row.timestamp).toISOString(),
              `"${row.action}"`,
              `"${row.studentId || ''}"`,
              `"${row.operatorName}"`,
              `"${typeof row.details === 'object' ? JSON.stringify(row.details).replace(/"/g, '""') : (row.details || '')}"`,
            );
            break;
            
          case 'distributions':
            values.push(
              row.id,
              new Date(row.timestamp).toISOString(),
              `"${row.studentId}"`,
              `"${row.operatorName}"`,
              row.verified ? 'Yes' : 'No',
              `"${row.verifiedBy || ''}"`,
              row.verifiedAt ? new Date(row.verifiedAt).toISOString() : ''
            );
            break;
            
          case 'payments':
            values.push(
              row.id,
              new Date(row.timestamp).toISOString(),
              `"${row.studentId}"`,
              row.amountPaid,
              `"${row.operatorName}"`,
              row.changeDue
            );
            break;
        }
        
        csvRows.push(values.join(','));
      }
      
      const csvString = csvRows.join('\n');
      
      // Create download link
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "Export Successful",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: `Failed to export ${type} data.`,
        variant: "destructive"
      });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-neutral-800 mb-2">Database Status</h3>
          
          <div className="flex items-center gap-2 mb-4">
            <div 
              className={`w-3 h-3 rounded-full ${
                databaseStatus === "online" ? "bg-green-500" : 
                databaseStatus === "error" ? "bg-red-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-sm">
              {databaseStatus === "online" ? "Online" : 
              databaseStatus === "error" ? "Error" : "Checking..."}
            </span>
          </div>
          
          <p className="text-sm text-neutral-600 mb-4">{statusMessage}</p>
          
          {databaseStatus === "error" && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="mb-4"
            >
              <FontAwesomeIcon icon="sync" className="mr-2" />
              Retry Connection
            </Button>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-neutral-800 mb-4">Database Export</h3>
          
          <p className="text-sm text-neutral-600 mb-4">
            Export data from the database as CSV files for backup or analysis.
          </p>
          
          <Tabs defaultValue="students">
            <TabsList className="mb-4">
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="distributions">Distributions</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>
            
            <TabsContent value="students">
              <div className="bg-neutral-50 p-4 rounded-md mb-4">
                <h4 className="font-medium text-sm mb-1">Students Data</h4>
                <p className="text-xs text-neutral-600 mb-2">
                  Exports all student records including IDs, names, grades, and options.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportData('students')}
                  disabled={exportLoading || studentsLoading || databaseStatus !== "online"}
                >
                  {exportLoading ? (
                    <>
                      <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon="file-export" className="mr-2" />
                      Export Students
                    </>
                  )}
                </Button>
              </div>
              
              {studentsLoading ? (
                <div className="text-center py-4 text-sm text-neutral-500">
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Loading student data...
                </div>
              ) : students && students.length > 0 ? (
                <p className="text-sm text-neutral-600">
                  {students.length} student records available for export.
                </p>
              ) : (
                <p className="text-sm text-neutral-600">
                  No student records found.
                </p>
              )}
            </TabsContent>
            
            <TabsContent value="logs">
              <div className="bg-neutral-50 p-4 rounded-md mb-4">
                <h4 className="font-medium text-sm mb-1">System Logs</h4>
                <p className="text-xs text-neutral-600 mb-2">
                  Exports all system action logs including timestamps and details.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportData('logs')}
                  disabled={exportLoading || logsLoading || databaseStatus !== "online"}
                >
                  {exportLoading ? (
                    <>
                      <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon="file-export" className="mr-2" />
                      Export Logs
                    </>
                  )}
                </Button>
              </div>
              
              {logsLoading ? (
                <div className="text-center py-4 text-sm text-neutral-500">
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Loading log data...
                </div>
              ) : logs && logs.length > 0 ? (
                <p className="text-sm text-neutral-600">
                  {logs.length} log records available for export.
                </p>
              ) : (
                <p className="text-sm text-neutral-600">
                  No log records found.
                </p>
              )}
            </TabsContent>
            
            <TabsContent value="distributions">
              <div className="bg-neutral-50 p-4 rounded-md mb-4">
                <h4 className="font-medium text-sm mb-1">Distributions Data</h4>
                <p className="text-xs text-neutral-600 mb-2">
                  Exports all distribution records including verification status.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportData('distributions')}
                  disabled={exportLoading || distributionsLoading || databaseStatus !== "online"}
                >
                  {exportLoading ? (
                    <>
                      <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon="file-export" className="mr-2" />
                      Export Distributions
                    </>
                  )}
                </Button>
              </div>
              
              {distributionsLoading ? (
                <div className="text-center py-4 text-sm text-neutral-500">
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Loading distribution data...
                </div>
              ) : distributions && distributions.length > 0 ? (
                <p className="text-sm text-neutral-600">
                  {distributions.length} distribution records available for export.
                </p>
              ) : (
                <p className="text-sm text-neutral-600">
                  No distribution records found.
                </p>
              )}
            </TabsContent>
            
            <TabsContent value="payments">
              <div className="bg-neutral-50 p-4 rounded-md mb-4">
                <h4 className="font-medium text-sm mb-1">Payments Data</h4>
                <p className="text-xs text-neutral-600 mb-2">
                  Exports all payment records including amounts and operators.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportData('payments')}
                  disabled={exportLoading || paymentsLoading || databaseStatus !== "online"}
                >
                  {exportLoading ? (
                    <>
                      <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon="file-export" className="mr-2" />
                      Export Payments
                    </>
                  )}
                </Button>
              </div>
              
              {paymentsLoading ? (
                <div className="text-center py-4 text-sm text-neutral-500">
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Loading payment data...
                </div>
              ) : payments && payments.length > 0 ? (
                <p className="text-sm text-neutral-600">
                  {payments.length} payment records available for export.
                </p>
              ) : (
                <p className="text-sm text-neutral-600">
                  No payment records found.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}