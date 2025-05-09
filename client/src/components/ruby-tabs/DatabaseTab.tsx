import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Student } from "@shared/schema";
import { useIsMobile } from "../../hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Papa from "papaparse";

interface DatabaseTabProps {
  operatorName: string;
}

export function DatabaseTab({ operatorName }: DatabaseTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMappings, setCsvMappings] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreviewMode, setIsPreviewMode] = useState(true);

  const studentsPerPage = 50; // Changed to 50 as requested
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // New student form state
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    lastName: "",
    firstName: "",
    orderType: "",
    orderNumber: "",
    balanceDue: "0",
    paymentStatus: "Unpaid",
    yearbook: false,
    personalization: false,
    signaturePackage: false,
    clearCover: false,
    photoPockets: false
  });

  // Fetch students
  const { 
    data: students,
    isLoading,
    isError 
  } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 30000
  });

  // Smart CSV auto-mapping
  const autoMapCsvFields = (headers: string[]) => {
    const mappings: Record<string, string> = {};
    
    // Define field mappings with variations
    const fieldVariations: Record<string, string[]> = {
      studentIdField: ['studentid', 'student id', 'student_id', 'id', 'studentnumber', 'student number', 'student_number'],
      lastNameField: ['lastname', 'last name', 'last_name', 'surname', 'family name', 'family_name'],
      firstNameField: ['firstname', 'first name', 'first_name', 'given name', 'given_name'],
      orderTypeField: ['ordertype', 'order type', 'order_type', 'type', 'sales type', 'sales_type'],
      orderNumberField: ['ordernumber', 'order number', 'order_number', 'order id', 'order_id', 'salesid', 'sales id'],
      balanceDueField: ['balancedue', 'balance due', 'balance_due', 'balance', 'amount due', 'amount_due', 'cost', 'price'],
      paymentStatusField: ['paymentstatus', 'payment status', 'payment_status', 'status', 'paid', 'payment'],
      yearbookField: ['yearbook', 'yearbook type', 'yearbook_type', 'book', 'book type'],
      personalizationField: ['personalization', 'personal', 'custom', 'customization'],
      signaturePackageField: ['signature', 'signature package', 'signature_package', 'autograph'],
      clearCoverField: ['cover', 'clear cover', 'clear_cover', 'hardcover'],
      photoPocketsField: ['photo', 'photos', 'photo pockets', 'photo_pockets', 'pictures']
    };
    
    // Try to match headers to field variations
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim();
      
      // Check each field for a match
      Object.entries(fieldVariations).forEach(([field, variations]) => {
        // Match exact header
        if (variations.includes(lowerHeader) && !mappings[field]) {
          mappings[field] = header;
        }
        
        // Match partial header (for headers that might contain additional text)
        if (!mappings[field]) {
          for (const variation of variations) {
            if (lowerHeader.includes(variation)) {
              mappings[field] = header;
              break;
            }
          }
        }
      });
    });
    
    return mappings;
  };

  // Handle CSV file upload
  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      
      // Parse CSV headers
      Papa.parse(text, {
        header: true,
        preview: 1,
        complete: (results) => {
          const headers = results.meta.fields || [];
          setCsvHeaders(headers);
          
          // Auto-map fields based on header names
          const autoMappings = autoMapCsvFields(headers);
          setCsvMappings(autoMappings);
        }
      });
      
      // Switch to mapping mode
      setIsPreviewMode(false);
    };
    
    reader.readAsText(file);
  };

  // Handle mapping selection
  const handleMappingSelect = (field: string, header: string) => {
    setCsvMappings({
      ...csvMappings,
      [field]: header
    });
  };

  // CSV import mutation
  const importCsvMutation = useMutation({
    mutationFn: async (data: { mappings: Record<string, string>, csvData: any[], operatorName: string }) => {
      const res = await apiRequest('POST', '/api/students/import', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "CSV Import Successful",
        description: `Imported ${data.imported} students.`,
      });
      
      // Reset CSV state and close dialog
      setCsvFile(null);
      setCsvContent("");
      setCsvHeaders([]);
      setCsvMappings({});
      setShowCsvDialog(false);
      setIsPreviewMode(true);
      
      // Refetch students
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: Error) => {
      toast({
        title: "CSV Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Import CSV
  const importCsv = () => {
    if (!csvContent || !csvFile || Object.keys(csvMappings).length === 0) {
      toast({
        title: "Missing CSV Data",
        description: "Please upload a CSV file and map the required fields.",
        variant: "destructive"
      });
      return;
    }
    
    // Required fields
    const requiredFields = [
      "studentIdField", 
      "lastNameField", 
      "firstNameField", 
      "orderTypeField", 
      "orderNumberField", 
      "balanceDueField", 
      "paymentStatusField"
    ];
    
    // Check if all required fields are mapped
    const missingFields = requiredFields.filter(field => !csvMappings[field]);
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please map the following fields: ${missingFields.join(", ")}`,
        variant: "destructive"
      });
      return;
    }
    
    // Parse CSV
    Papa.parse(csvContent, {
      header: true,
      complete: (results) => {
        importCsvMutation.mutate({
          mappings: csvMappings,
          csvData: results.data,
          operatorName
        });
      },
      error: (error) => {
        toast({
          title: "CSV Parsing Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: async (student: typeof newStudent & { operatorName: string }) => {
      const res = await apiRequest('POST', '/api/students', student);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Student Created",
        description: "Successfully created new student.",
      });
      
      // Reset form and close dialog
      setNewStudent({
        studentId: "",
        lastName: "",
        firstName: "",
        orderType: "",
        orderNumber: "",
        balanceDue: "0",
        paymentStatus: "Unpaid",
        yearbook: false,
        personalization: false,
        signaturePackage: false,
        clearCover: false,
        photoPockets: false
      });
      setShowAddDialog(false);
      
      // Refetch students
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Create Student Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, student }: { id: number, student: Partial<typeof newStudent> & { operatorName: string }}) => {
      const res = await apiRequest('PUT', `/api/students/${id}`, student);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Student Updated",
        description: "Successfully updated student.",
      });
      
      // Reset state and close dialog
      setSelectedStudent(null);
      setShowEditDialog(false);
      
      // Refetch students
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Student Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async ({ id, operatorName }: { id: number, operatorName: string }) => {
      const res = await apiRequest('DELETE', `/api/students/${id}`, { operatorName });
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Student Deleted",
        description: "Successfully deleted student.",
      });
      
      // Refetch students
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Student Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle add student
  const handleAddStudent = () => {
    // Validate required fields
    if (!newStudent.studentId || !newStudent.lastName || !newStudent.firstName) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    
    createStudentMutation.mutate({
      ...newStudent,
      operatorName
    });
  };

  // Handle edit student
  const handleEditStudent = () => {
    if (!selectedStudent) return;
    
    updateStudentMutation.mutate({
      id: selectedStudent.id,
      student: {
        ...selectedStudent,
        operatorName
      }
    });
  };

  // Handle delete student
  const handleDeleteStudent = (id: number) => {
    if (confirm("Are you sure you want to delete this student?")) {
      deleteStudentMutation.mutate({ id, operatorName });
    }
  };

  // Filter students by search term
  const filteredStudents = students ? students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.studentId.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.firstName.toLowerCase().includes(searchLower) ||
      student.orderType.toLowerCase().includes(searchLower) ||
      student.orderNumber.toLowerCase().includes(searchLower) ||
      student.paymentStatus.toLowerCase().includes(searchLower)
    );
  }) : [];

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * studentsPerPage,
    currentPage * studentsPerPage
  );

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800 mb-2 lg:mb-0">Database</h3>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-auto">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-primary">
                    <FontAwesomeIcon icon="plus" className="mr-2" />
                    Add New Entry
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Student</DialogTitle>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="studentId" className="text-sm font-medium">
                          Student ID *
                        </label>
                        <Input
                          id="studentId"
                          value={newStudent.studentId}
                          onChange={e => setNewStudent({...newStudent, studentId: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="orderType" className="text-sm font-medium">
                          Order Type *
                        </label>
                        <Input
                          id="orderType"
                          value={newStudent.orderType}
                          onChange={e => setNewStudent({...newStudent, orderType: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="text-sm font-medium">
                          First Name *
                        </label>
                        <Input
                          id="firstName"
                          value={newStudent.firstName}
                          onChange={e => setNewStudent({...newStudent, firstName: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="lastName" className="text-sm font-medium">
                          Last Name *
                        </label>
                        <Input
                          id="lastName"
                          value={newStudent.lastName}
                          onChange={e => setNewStudent({...newStudent, lastName: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="orderNumber" className="text-sm font-medium">
                          Order Number *
                        </label>
                        <Input
                          id="orderNumber"
                          value={newStudent.orderNumber}
                          onChange={e => setNewStudent({...newStudent, orderNumber: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="balanceDue" className="text-sm font-medium">
                          Balance Due *
                        </label>
                        <Input
                          id="balanceDue"
                          type="number"
                          value={newStudent.balanceDue}
                          onChange={e => setNewStudent({...newStudent, balanceDue: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="paymentStatus" className="text-sm font-medium">
                        Payment Status *
                      </label>
                      <Select 
                        defaultValue={newStudent.paymentStatus}
                        onValueChange={value => setNewStudent({...newStudent, paymentStatus: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Unpaid">Unpaid</SelectItem>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="Free">Free</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="yearbook"
                          checked={newStudent.yearbook}
                          onChange={e => setNewStudent({...newStudent, yearbook: e.target.checked})}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="yearbook" className="text-sm font-medium">
                          Yearbook
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="personalization"
                          checked={newStudent.personalization}
                          onChange={e => setNewStudent({...newStudent, personalization: e.target.checked})}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="personalization" className="text-sm font-medium">
                          Personalization
                        </label>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="signaturePackage"
                          checked={newStudent.signaturePackage}
                          onChange={e => setNewStudent({...newStudent, signaturePackage: e.target.checked})}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="signaturePackage" className="text-sm font-medium">
                          Signature Package
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="clearCover"
                          checked={newStudent.clearCover}
                          onChange={e => setNewStudent({...newStudent, clearCover: e.target.checked})}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="clearCover" className="text-sm font-medium">
                          Clear Cover
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="photoPockets"
                          checked={newStudent.photoPockets}
                          onChange={e => setNewStudent({...newStudent, photoPockets: e.target.checked})}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="photoPockets" className="text-sm font-medium">
                          Photo Pockets
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddStudent} disabled={createStudentMutation.isPending}>
                      {createStudentMutation.isPending ? (
                        <>
                          <FontAwesomeIcon icon="spinner" className="mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Student"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-primary">
                    <FontAwesomeIcon icon="file-import" className="mr-2" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Import Students from CSV</DialogTitle>
                  </DialogHeader>
                  
                  {isPreviewMode ? (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Select CSV File
                      </label>
                      <Input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleCsvFileUpload}
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <>
                      <h4 className="text-sm font-medium text-neutral-700 mb-2">
                        Verify CSV Headers to Student Fields Mapping
                      </h4>
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-sm font-medium text-neutral-700">Student Field</div>
                          <div className="text-sm font-medium text-neutral-700">CSV Header</div>
                          
                          {[
                            { key: "studentIdField", label: "Student ID" },
                            { key: "lastNameField", label: "Last Name" },
                            { key: "firstNameField", label: "First Name" },
                            { key: "orderTypeField", label: "Order Type" },
                            { key: "orderNumberField", label: "Order Number" },
                            { key: "balanceDueField", label: "Balance Due" },
                            { key: "paymentStatusField", label: "Payment Status" },
                            { key: "yearbookField", label: "Yearbook" },
                            { key: "personalizationField", label: "Personalization" },
                            { key: "signaturePackageField", label: "Signature Package" },
                            { key: "clearCoverField", label: "Clear Cover" },
                            { key: "photoPocketsField", label: "Photo Pockets" },
                          ].map(field => (
                            <React.Fragment key={field.key}>
                              <div className="text-sm text-neutral-600">
                                {field.label}
                                {field.key.includes("Field") && !field.key.includes("yearbook") && !field.key.includes("personalization") && !field.key.includes("signature") && !field.key.includes("clear") && !field.key.includes("photo") && (
                                  <span className="text-red-500">*</span>
                                )}
                              </div>
                              <select 
                                className="w-full text-sm p-1 border border-neutral-300 rounded"
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
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mt-4 flex space-x-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCsvFile(null);
                            setCsvContent("");
                            setCsvHeaders([]);
                            setCsvMappings({});
                            setIsPreviewMode(true);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={importCsv}
                          disabled={importCsvMutation.isPending}
                        >
                          {importCsvMutation.isPending ? (
                            <>
                              <FontAwesomeIcon icon="spinner" className="mr-2 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            "Import CSV"
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Quick Actions section moved above the table */}
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <div className="mb-2 sm:mb-0 w-full sm:w-auto">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <FontAwesomeIcon icon="search" />
                  </span>
                  <Input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1); // Reset to first page on search
                    }}
                    className="pl-10 w-full sm:w-80"
                  />
                </div>
              </div>
              
              <div className="flex space-x-2 w-full sm:w-auto justify-end">
                <Select
                  value={currentPage.toString()}
                  onValueChange={(value) => setCurrentPage(parseInt(value))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Page" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Page {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <FontAwesomeIcon icon="chevron-left" />
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <FontAwesomeIcon icon="chevron-right" />
                </Button>
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <FontAwesomeIcon icon="spinner" className="animate-spin text-2xl text-neutral-400" />
            </div>
          ) : isError ? (
            <div className="flex justify-center items-center py-12 text-red-500">
              Error loading students
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.length > 0 ? (
                    paginatedStudents.map(student => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.studentId}</TableCell>
                        <TableCell>
                          {student.lastName}, {student.firstName}
                        </TableCell>
                        <TableCell>
                          <div>{student.orderType}</div>
                          <div className="text-xs text-neutral-500">#{student.orderNumber}</div>
                        </TableCell>
                        <TableCell>
                          <span 
                            className={`text-xs px-2 py-1 rounded-full ${
                              student.paymentStatus === 'Paid' 
                                ? 'bg-green-100 text-green-800' 
                                : student.paymentStatus === 'Unpaid'
                                ? 'bg-red-100 text-red-800'
                                : student.paymentStatus === 'Free'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {student.paymentStatus}
                          </span>
                          {student.balanceDue && student.balanceDue !== "0" && (
                            <div className="text-xs text-neutral-500 mt-1">
                              ${parseFloat(student.balanceDue.toString()).toFixed(2)} due
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-neutral-500"
                              onClick={() => {
                                setSelectedStudent(student);
                                setShowEditDialog(true);
                              }}
                            >
                              <FontAwesomeIcon icon="edit" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500"
                              onClick={() => handleDeleteStudent(student.id)}
                            >
                              <FontAwesomeIcon icon="trash-alt" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-neutral-500">
                        {searchTerm ? "No students found matching your search" : "No students found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination info */}
          <div className="mt-4 text-sm text-neutral-500">
            Showing {paginatedStudents.length} of {filteredStudents.length} entries
          </div>
        </CardContent>
      </Card>
      
      {/* Edit Student Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="edit-studentId" className="text-sm font-medium">
                    Student ID *
                  </label>
                  <Input
                    id="edit-studentId"
                    value={selectedStudent.studentId}
                    onChange={e => setSelectedStudent({...selectedStudent, studentId: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="edit-orderType" className="text-sm font-medium">
                    Order Type *
                  </label>
                  <Input
                    id="edit-orderType"
                    value={selectedStudent.orderType}
                    onChange={e => setSelectedStudent({...selectedStudent, orderType: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="edit-firstName" className="text-sm font-medium">
                    First Name *
                  </label>
                  <Input
                    id="edit-firstName"
                    value={selectedStudent.firstName}
                    onChange={e => setSelectedStudent({...selectedStudent, firstName: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="edit-lastName" className="text-sm font-medium">
                    Last Name *
                  </label>
                  <Input
                    id="edit-lastName"
                    value={selectedStudent.lastName}
                    onChange={e => setSelectedStudent({...selectedStudent, lastName: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="edit-orderNumber" className="text-sm font-medium">
                    Order Number *
                  </label>
                  <Input
                    id="edit-orderNumber"
                    value={selectedStudent.orderNumber}
                    onChange={e => setSelectedStudent({...selectedStudent, orderNumber: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="edit-balanceDue" className="text-sm font-medium">
                    Balance Due *
                  </label>
                  <Input
                    id="edit-balanceDue"
                    type="number"
                    value={selectedStudent.balanceDue.toString()}
                    onChange={e => setSelectedStudent({...selectedStudent, balanceDue: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="edit-paymentStatus" className="text-sm font-medium">
                  Payment Status *
                </label>
                <Select 
                  value={selectedStudent.paymentStatus}
                  onValueChange={value => setSelectedStudent({...selectedStudent, paymentStatus: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Free">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="edit-yearbook"
                    checked={selectedStudent.yearbook}
                    onChange={e => setSelectedStudent({...selectedStudent, yearbook: e.target.checked})}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="edit-yearbook" className="text-sm font-medium">
                    Yearbook
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="edit-personalization"
                    checked={selectedStudent.personalization}
                    onChange={e => setSelectedStudent({...selectedStudent, personalization: e.target.checked})}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="edit-personalization" className="text-sm font-medium">
                    Personalization
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="edit-signaturePackage"
                    checked={selectedStudent.signaturePackage}
                    onChange={e => setSelectedStudent({...selectedStudent, signaturePackage: e.target.checked})}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="edit-signaturePackage" className="text-sm font-medium">
                    Signature Package
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="edit-clearCover"
                    checked={selectedStudent.clearCover}
                    onChange={e => setSelectedStudent({...selectedStudent, clearCover: e.target.checked})}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="edit-clearCover" className="text-sm font-medium">
                    Clear Cover
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="edit-photoPockets"
                    checked={selectedStudent.photoPockets}
                    onChange={e => setSelectedStudent({...selectedStudent, photoPockets: e.target.checked})}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="edit-photoPockets" className="text-sm font-medium">
                    Photo Pockets
                  </label>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStudent} disabled={updateStudentMutation.isPending}>
              {updateStudentMutation.isPending ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Student"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}