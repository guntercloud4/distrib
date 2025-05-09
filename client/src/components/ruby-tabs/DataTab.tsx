import React, { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useToast } from "@/hooks/use-toast";
import { socketProvider } from "@/lib/socket";
import { apiRequest } from "@/lib/queryClient";
import { parseCSV } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";

// Auto-detect function to map CSV fields to database fields
const autoMapCsvFields = (headers: string[]) => {
  const mappings: Record<string, string> = {};
  const possibleMappings: Record<string, string[]> = {
    studentIdField: ["student id", "id", "studentid", "student_id", "student-id"],
    lastNameField: ["last name", "lastname", "last", "surname", "family name", "family_name"],
    firstNameField: ["first name", "firstname", "first", "given name", "given_name"],
    orderTypeField: ["order type", "ordertype", "type", "order_type"],
    orderNumberField: ["order number", "ordernumber", "order_number", "order #", "order no"],
    balanceDueField: ["balance due", "balancedue", "balance", "amount due", "amount", "balance_due"],
    paymentStatusField: ["payment status", "paymentstatus", "status", "payment_status"],
    yearbookField: ["yearbook", "has yearbook", "yearbook_ordered"],
    personalizationField: ["personalization", "personalized", "name on cover", "has_personalization"],
    signaturePackageField: ["signature package", "signature", "signatures", "has_signature_package"],
    clearCoverField: ["clear cover", "clear_cover", "has_clear_cover"],
    photoPocketsField: ["photo pockets", "photos", "pockets", "has_photo_pockets"],
  };

  // For each field we need to map, check if any of the possible header values exist in our CSV headers
  Object.entries(possibleMappings).forEach(([field, possibleValues]) => {
    // Try to find an exact match first (case-insensitive)
    const exactMatch = headers.find(header => 
      possibleValues.includes(header.toLowerCase())
    );
    
    if (exactMatch) {
      mappings[field] = exactMatch;
      return;
    }
    
    // If no exact match, try partial match
    const partialMatch = headers.find(header => 
      possibleValues.some(value => header.toLowerCase().includes(value))
    );
    
    if (partialMatch) {
      mappings[field] = partialMatch;
    }
  });
  
  return mappings;
};

interface DataTabProps {
  operatorName: string;
}

export function DataTab({ operatorName }: DataTabProps) {
  const { toast } = useToast();
  const [csvContent, setCsvContent] = useState<string>("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMappings, setCsvMappings] = useState<Record<string, string>>({});
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Required fields
  const requiredFields = useMemo(() => [
    { key: "studentIdField", label: "Student ID *" },
    { key: "lastNameField", label: "Last Name *" },
    { key: "firstNameField", label: "First Name *" },
    { key: "orderTypeField", label: "Order Type *" },
    { key: "orderNumberField", label: "Order Number *" },
    { key: "balanceDueField", label: "Balance Due *" },
    { key: "paymentStatusField", label: "Payment Status *" },
  ], []);

  // Optional fields
  const optionalFields = useMemo(() => [
    { key: "yearbookField", label: "Yearbook" },
    { key: "personalizationField", label: "Personalization" },
    { key: "signaturePackageField", label: "Signature Package" },
    { key: "clearCoverField", label: "Clear Cover" },
    { key: "photoPocketsField", label: "Photo Pockets" },
  ], []);

  // Load Students
  const { refetch: refetchStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ['/api/students'],
    enabled: false,
  });

  // Handle CSV file upload
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target?.result as string;
      setCsvContent(csvText);
      
      // Parse the CSV to get headers and preview data
      const parsedData = parseCSV(csvText);
      if (parsedData.length > 0) {
        const headers = Object.keys(parsedData[0]);
        setCsvHeaders(headers);
        
        // Auto-detect and map the CSV fields
        const autoMappings = autoMapCsvFields(headers);
        setCsvMappings(autoMappings);
        
        // Set preview data (first 3 rows)
        setPreviewData(parsedData.slice(0, 3));
      }
    };
    reader.readAsText(file);
    setShowCsvDialog(true);
  };

  // Handle CSV mapping selection
  const handleMappingSelect = (field: string, header: string) => {
    setCsvMappings(prev => ({
      ...prev,
      [field]: header
    }));
  };

  // Process CSV import
  const processCsvImport = () => {
    if (!csvContent || Object.keys(csvMappings).length < 7) {
      toast({
        title: "Mapping Required",
        description: "Please map all required fields before importing.",
        variant: "destructive"
      });
      return;
    }
    
    const parsedData = parseCSV(csvContent);
    csvMutation.mutate({
      mappings: csvMappings,
      csvData: parsedData,
      operatorName
    });
  };

  // CSV upload mutation
  const csvMutation = useMutation({
    mutationFn: async (data: { mappings: Record<string, string>, csvData: any[], operatorName: string }) => {
      const res = await apiRequest('POST', '/api/students/import', data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "CSV Import Successful",
        description: `Successfully imported ${data.imported} students.`,
      });
      
      // Log the action via WebSocket
      socketProvider.send({
        type: 'LOG_ACTION',
        data: {
          id: Date.now(),
          timestamp: new Date(),
          studentId: null,
          action: 'IMPORT_STUDENTS',
          details: { count: data.imported },
          stationName: 'Ruby Station',
          operatorName
        }
      });
      
      // Close dialog and reset form
      setShowCsvDialog(false);
      setCsvContent("");
      setCsvMappings({});
      setCsvHeaders([]);
      setPreviewData([]);
      
      // Refetch students to update the table
      refetchStudents();
    },
    onError: (error: Error) => {
      toast({
        title: "CSV Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h3 className="text-lg text-neutral-800">Data Management</h3>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline"
            onClick={() => document.getElementById('csvFileInput')?.click()}
          >
            <FontAwesomeIcon icon="file-import" className="mr-2" />
            Import CSV
          </Button>
          <input
            type="file"
            accept=".csv"
            id="csvFileInput"
            className="hidden"
            onChange={handleCsvFileUpload}
          />
        </div>
      </div>

      <Card className="border border-neutral-200">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-neutral-700">
              <FontAwesomeIcon icon="database" />
              <h3 className="text-md">Data Import Options</h3>
            </div>
            
            <p className="text-sm text-neutral-600">
              Import student data from CSV files. The system will attempt to automatically detect and map fields from your data.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-neutral-50 p-4 rounded-md">
                <h4 className="font-medium text-sm mb-1">Student Records</h4>
                <p className="text-xs text-neutral-600 mb-2">
                  Import student data including IDs, names, and yearbook options.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('csvFileInput')?.click()}
                >
                  <FontAwesomeIcon icon="file-import" className="mr-2" />
                  Import Students
                </Button>
              </div>
              
              <div className="bg-neutral-50 p-4 rounded-md">
                <h4 className="font-medium text-sm mb-1">Field Detection</h4>
                <p className="text-xs text-neutral-600 mb-2">
                  The importer will attempt to auto-detect fields based on column headers.
                </p>
                <div className="text-xs text-neutral-600">
                  <p>• Student ID, Name, Order fields are required</p>
                  <p>• Format: CSV with headers in first row</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSV Import Dialog */}
      <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Students from CSV</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* CSV Preview */}
            {previewData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Data Preview (First 3 rows)</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map(header => (
                          <TableHead key={header} className="whitespace-nowrap text-xs">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {csvHeaders.map(header => (
                            <TableCell key={`${rowIndex}-${header}`} className="text-xs p-2">
                              {row[header]?.toString().substring(0, 20)}
                              {row[header]?.toString().length > 20 ? '...' : ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            
            {/* Field Mapping */}
            <div>
              <h4 className="text-sm font-medium mb-2">Map CSV Columns to Database Fields</h4>
              <p className="text-xs text-neutral-500 mb-4">
                Required fields are marked with * and must be mapped before import.
                The system has attempted to automatically detect the correct mappings.
              </p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-xs font-medium mb-2">Required Fields</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {requiredFields.map(field => (
                      <div key={field.key} className="flex flex-col space-y-1">
                        <label className="text-xs">{field.label}</label>
                        <select 
                          className="text-xs p-1 border rounded"
                          value={csvMappings[field.key] || ""}
                          onChange={(e) => handleMappingSelect(field.key, e.target.value)}
                        >
                          <option value="">Select header...</option>
                          {csvHeaders.map(header => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h5 className="text-xs font-medium mb-2">Optional Fields</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {optionalFields.map(field => (
                      <div key={field.key} className="flex flex-col space-y-1">
                        <label className="text-xs">{field.label}</label>
                        <select 
                          className="text-xs p-1 border rounded"
                          value={csvMappings[field.key] || ""}
                          onChange={(e) => handleMappingSelect(field.key, e.target.value)}
                        >
                          <option value="">Select header...</option>
                          {csvHeaders.map(header => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCsvDialog(false);
                setCsvContent("");
                setCsvMappings({});
                setCsvHeaders([]);
                setPreviewData([]);
              }}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              onClick={processCsvImport}
              disabled={csvMutation.isPending}
            >
              {csvMutation.isPending ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                'Import Students'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}