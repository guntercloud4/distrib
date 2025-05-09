import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InsertStudent, CsvMapping, csvMappingSchema } from "@shared/schema";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface DataTabProps {
  operatorName: string;
}

export function DataTab({ operatorName }: DataTabProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [mapping, setMapping] = useState<CsvMapping>({
    studentIdField: "",
    firstNameField: "",
    lastNameField: "",
    orderTypeField: "",
    orderNumberField: "",
    balanceDueField: "",
    paymentStatusField: "",
    yearbookField: "",
    personalizationField: "",
    signaturePackageField: "",
    clearCoverField: "",
    photoPocketsField: ""
  });
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [importResults, setImportResults] = useState({
    total: 0,
    success: 0,
    errors: 0,
    errorMessages: [] as string[]
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (students: InsertStudent[]) => {
      const res = await apiRequest('POST', '/api/students/import', students);
      return res.json();
    },
    onSuccess: (data) => {
      setIsProcessing(false);
      setShowResults(true);
      setImportResults({
        total: data.total,
        success: data.success,
        errors: data.errors,
        errorMessages: data.errorMessages || []
      });
      
      // Show success message
      toast({
        title: "Import complete",
        description: `Successfully imported ${data.success} of ${data.total} students.`,
        variant: data.errors > 0 ? "destructive" : "default"
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFileSelected(false);
      return;
    }
    
    setFileSelected(true);
    
    // Parse CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          toast({
            title: "Empty file",
            description: "The selected file doesn't contain any data.",
            variant: "destructive"
          });
          return;
        }
        
        // Extract headers
        const headers = Object.keys(results.data[0]);
        setHeaders(headers);
        setParsedData(results.data);
        
        // Auto-detect fields
        autoDetectFields(headers);
        
        // Show mapping dialog
        setShowMappingDialog(true);
      },
      error: (error) => {
        toast({
          title: "File parsing error",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };
  
  // Auto-detect CSV fields based on common column names
  const autoDetectFields = (headers: string[]) => {
    // Define patterns for each field
    const patterns: Record<keyof CsvMapping, RegExp[]> = {
      studentId: [/student.?id/i, /id.?number/i, /school.?id/i],
      firstName: [/first.?name/i, /name.?first/i, /given.?name/i],
      lastName: [/last.?name/i, /name.?last/i, /family.?name/i, /surname/i],
      grade: [/grade/i, /year/i, /class/i],
      orderNumber: [/order.?number/i, /order.?id/i, /order.?#/i],
      orderEnteredDate: [/order.?date/i, /date.?entered/i, /order.?entry.?date/i],
      yearbook: [/yearbook/i, /has.?yearbook/i, /book.?ordered/i],
      personalization: [/personal/i, /name.?stamp/i, /custom/i],
      signaturePackage: [/signature/i, /autograph/i, /sign/i],
      clearCover: [/clear.?cover/i, /protective.?cover/i, /cover/i],
      photoPockets: [/photo.?pocket/i, /picture.?pocket/i, /photo.?sleeve/i],
      paymentAmount: [/payment/i, /amount.?paid/i, /paid/i],
      paymentStatus: [/status/i, /payment.?status/i, /paid.?status/i],
      balanceDue: [/balance/i, /amount.?due/i, /remaining/i, /due/i],
    };
    
    // Initialize a new mapping object
    const newMapping = { ...mapping };
    
    // For each field in our mapping
    for (const field of Object.keys(mapping) as Array<keyof CsvMapping>) {
      // Check each header against patterns for this field
      for (const header of headers) {
        if (patterns[field].some(pattern => pattern.test(header))) {
          newMapping[field] = header;
          break;
        }
      }
    }
    
    setMapping(newMapping);
  };
  
  // Handle mapping changes
  const handleMappingChange = (field: keyof CsvMapping, value: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Transform CSV data to student objects
  const transformData = useCallback(() => {
    const transformedData: InsertStudent[] = [];
    
    for (const row of parsedData) {
      try {
        const student: Partial<InsertStudent> = {};
        
        // Map each field from CSV to our student object
        for (const [field, header] of Object.entries(mapping) as [keyof CsvMapping, string][]) {
          if (!header) continue;
          
          let value = row[header];
          
          // Handle boolean fields
          if (['yearbook', 'personalization', 'signaturePackage', 'clearCover', 'photoPockets'].includes(field)) {
            // Check if the value looks like a boolean
            if (typeof value === 'string') {
              value = value.toLowerCase();
              student[field] = ['yes', 'true', '1', 'y'].includes(value);
            } else if (typeof value === 'boolean') {
              student[field] = value;
            } else if (typeof value === 'number') {
              student[field] = value > 0;
            }
          }
          // Handle date fields
          else if (field === 'orderEnteredDate' && value) {
            try {
              student[field] = new Date(value).toISOString();
            } catch (e) {
              student[field] = new Date().toISOString();
            }
          }
          // Handle string fields
          else {
            student[field] = value;
          }
        }
        
        // Set default values for required fields if missing
        if (!student.paymentStatus) student.paymentStatus = "UNPAID";
        if (!student.orderEnteredDate) student.orderEnteredDate = new Date().toISOString();
        
        transformedData.push(student as InsertStudent);
      } catch (error) {
        console.error("Error transforming row:", error);
      }
    }
    
    return transformedData;
  }, [parsedData, mapping]);
  
  // Handle form submission
  const handleImport = () => {
    try {
      setIsProcessing(true);
      const students = transformData();
      
      if (students.length === 0) {
        toast({
          title: "No data to import",
          description: "No valid student records were found in the file.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      // Start progress animation
      simulateProgress();
      
      // Import students
      importMutation.mutate(students);
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Import error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  };
  
  // Reset the form
  const handleReset = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setParsedData([]);
    setHeaders([]);
    setFileSelected(false);
    setShowMappingDialog(false);
    setShowResults(false);
    setProgress(0);
  };
  
  // Simulate progress for better UX
  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 200);
  };
  
  // Close results dialog
  const handleCloseResults = () => {
    setShowResults(false);
    handleReset();
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-neutral-800 mb-1">Data Management</h3>
            <p className="text-neutral-600 text-sm">Import and manage student data</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-medium mb-3">Import Student Data</h4>
              <div className="border border-dashed border-neutral-300 rounded-lg p-6 text-center bg-neutral-50">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon="file-import" className="text-neutral-400 text-2xl" />
                  </div>
                </div>
                
                <h4 className="text-sm font-medium mb-2">Upload CSV File</h4>
                <p className="text-neutral-600 text-sm mb-4">
                  The system will automatically detect field mappings.
                </p>
                
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  className="hidden"
                  id="csv-file-input"
                />
                
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="mb-2"
                >
                  <FontAwesomeIcon icon="file-upload" className="mr-2" />
                  Select CSV File
                </Button>
                
                {fileSelected && (
                  <p className="text-sm text-green-600">File selected</p>
                )}
              </div>
              
              <div className="mt-4">
                <Alert>
                  <AlertDescription>
                    <p className="text-sm mb-1">
                      <strong>CSV Format:</strong> Your file should include columns for student information such as ID, name, and order details.
                    </p>
                    <p className="text-sm">
                      <strong>Tip:</strong> Include a header row with descriptive column names for best results.
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            
            <div>
              <h4 className="text-md font-medium mb-3">Export Options</h4>
              <div className="border border-neutral-200 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h5 className="text-sm font-medium mb-2">Export Student Data</h5>
                    <p className="text-neutral-600 text-sm mb-3">
                      Download student data in various formats.
                    </p>
                    <div className="flex space-x-2">
                      <Button variant="outline" disabled={isProcessing}>
                        <FontAwesomeIcon icon="file-alt" className="mr-2" />
                        Export to CSV
                      </Button>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-neutral-200">
                    <h5 className="text-sm font-medium mb-2">Data Backup</h5>
                    <p className="text-neutral-600 text-sm mb-3">
                      Create a backup of all system data.
                    </p>
                    <Button variant="outline" disabled={isProcessing}>
                      <FontAwesomeIcon icon="download" className="mr-2" />
                      Backup All Data
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Field Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Map CSV Fields</DialogTitle>
            <DialogDescription>
              We've attempted to automatically map your CSV columns to our system fields.
              Please review and adjust the mappings if needed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="studentId">Student ID <span className="text-red-500">*</span></Label>
                  <Select 
                    value={mapping.studentId} 
                    onValueChange={(value) => handleMappingChange('studentId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                  <Select 
                    value={mapping.firstName} 
                    onValueChange={(value) => handleMappingChange('firstName', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                  <Select 
                    value={mapping.lastName} 
                    onValueChange={(value) => handleMappingChange('lastName', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="grade">Grade</Label>
                  <Select 
                    value={mapping.grade} 
                    onValueChange={(value) => handleMappingChange('grade', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="orderNumber">Order Number</Label>
                  <Select 
                    value={mapping.orderNumber} 
                    onValueChange={(value) => handleMappingChange('orderNumber', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="orderEnteredDate">Order Date</Label>
                  <Select 
                    value={mapping.orderEnteredDate} 
                    onValueChange={(value) => handleMappingChange('orderEnteredDate', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="paymentStatus">Payment Status</Label>
                  <Select 
                    value={mapping.paymentStatus} 
                    onValueChange={(value) => handleMappingChange('paymentStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="yearbook">Has Yearbook</Label>
                  <Select 
                    value={mapping.yearbook} 
                    onValueChange={(value) => handleMappingChange('yearbook', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="personalization">Has Personalization</Label>
                  <Select 
                    value={mapping.personalization} 
                    onValueChange={(value) => handleMappingChange('personalization', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="signaturePackage">Has Signature Package</Label>
                  <Select 
                    value={mapping.signaturePackage} 
                    onValueChange={(value) => handleMappingChange('signaturePackage', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="clearCover">Has Clear Cover</Label>
                  <Select 
                    value={mapping.clearCover} 
                    onValueChange={(value) => handleMappingChange('clearCover', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="photoPockets">Has Photo Pockets</Label>
                  <Select 
                    value={mapping.photoPockets} 
                    onValueChange={(value) => handleMappingChange('photoPockets', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="paymentAmount">Payment Amount</Label>
                  <Select 
                    value={mapping.paymentAmount} 
                    onValueChange={(value) => handleMappingChange('paymentAmount', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="balanceDue">Balance Due</Label>
                  <Select 
                    value={mapping.balanceDue} 
                    onValueChange={(value) => handleMappingChange('balanceDue', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Select field --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {isProcessing && (
              <div className="mt-6">
                <p className="text-sm mb-2">Importing data...</p>
                <Progress value={progress} />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isProcessing || !mapping.studentId || !mapping.firstName || !mapping.lastName}>
              {isProcessing ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="file-import" className="mr-2" />
                  Import Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center justify-center mb-6">
              {importResults.errors > 0 ? (
                <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center">
                  <FontAwesomeIcon icon="exclamation-triangle" className="text-2xl text-yellow-600" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <FontAwesomeIcon icon="check" className="text-2xl text-green-600" />
                </div>
              )}
            </div>
            
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium">Import Complete</h3>
              <p className="text-neutral-600 mt-2">
                {importResults.success} of {importResults.total} students imported successfully.
              </p>
            </div>
            
            {importResults.errors > 0 && (
              <div className="mt-4 p-4 bg-neutral-50 border border-neutral-200 rounded-md max-h-[200px] overflow-y-auto">
                <h4 className="text-sm font-medium mb-2">Errors ({importResults.errors})</h4>
                <ul className="text-sm text-neutral-700 list-disc list-inside">
                  {importResults.errorMessages.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={handleCloseResults}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}