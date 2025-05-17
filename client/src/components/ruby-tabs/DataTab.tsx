import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  Student, 
  InsertStudent, 
  insertStudentSchema, 
  Distribution
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import Papa from "papaparse";

export function DataTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10; // Show 10 students per page
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showStudentDetailDialog, setShowStudentDetailDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [fileSelected, setFileSelected] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{[key: string]: string}>({});
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Extended schema for form validation
  const formSchema = insertStudentSchema.extend({
    orderNumber: z.string().min(1, "Order number is required"),
    balanceDue: z.string().refine(val => !isNaN(parseFloat(val)), {
      message: "Balance due must be a number",
    }),
  });
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: "",
      firstName: "",
      lastName: "",
      orderNumber: "",
      orderType: "Standard",
      balanceDue: "0",
      paymentStatus: "UNPAID",
      yearbook: true,
      personalization: false,
      signaturePackage: false,
      clearCover: false,
      photoPockets: false,
    },
  });
  
  // Fetch students
  const { 
    data: students, 
    isLoading: studentsLoading,
    isError: studentsError
  } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 10000,
  });
  
  // Fetch distributions
  const {
    data: distributions
  } = useQuery<Distribution[]>({
    queryKey: ['/api/distributions'],
    staleTime: 10000,
  });
  
  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (data: InsertStudent) => {
      const res = await apiRequest('POST', '/api/students', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Student added",
        description: "The student has been added successfully and is pending distribution.",
      });
      
      // Invalidate all related queries to ensure proper status updates
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      
      setShowAddDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add student",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Import students mutation
  const importStudentsMutation = useMutation({
    mutationFn: async (students: InsertStudent[]) => {
      const res = await apiRequest('POST', '/api/students/import', students);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import complete",
        description: `Successfully imported ${data.success} of ${data.total} students. All students start with "Pending Distribution" status.`,
        variant: data.errors > 0 ? "destructive" : "default"
      });
      
      // Invalidate all related queries to ensure proper status updates
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      
      setShowImportDialog(false);
      setFileSelected(false);
      setParsedData([]);
      setHeaders([]);
      setMapping({});
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive"
      });
      setIsImporting(false);
    }
  });
  
  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      await apiRequest('DELETE', `/api/students/${studentId}`);
      return true;
    },
    onSettled: () => {
      // Always refresh and close dialog regardless of success/failure
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      setShowStudentDetailDialog(false);
    }
  });
  
  // Handle form submission
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    addStudentMutation.mutate(data);
  };
  
  // Get distribution status for student
  const getDistributionStatus = (studentId: number) => {
    // Default to "Pending Distribution" status
    // This ensures new students are properly marked as pending
    if (!distributions) return { distributed: false, verified: false };
    
    // Get the student object to find their studentId (rather than database id)
    const student = students?.find(s => s.id === studentId);
    if (!student) return { distributed: false, verified: false };
    
    // Match using studentId (not the database id)
    const studentDistributions = distributions.filter(d => d.studentId === student.studentId);
    
    // If no distributions, student is "Pending Distribution"
    if (studentDistributions.length === 0) return { distributed: false, verified: false };
    
    // Check if any distribution is verified
    const verifiedDistribution = studentDistributions.find(d => d.verified);
    if (verifiedDistribution) {
      return { 
        distributed: true, 
        verified: true,
        timestamp: verifiedDistribution.timestamp,
        distributedBy: verifiedDistribution.operatorName,
        verifiedBy: verifiedDistribution.verifiedBy
      };
    }
    
    // If distributed but not verified
    return { 
      distributed: true, 
      verified: false,
      timestamp: studentDistributions[0].timestamp,
      distributedBy: studentDistributions[0].operatorName
    };
  };
  
  // Filter students based on search term
  const filteredStudents = students?.filter(student => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.studentId.toLowerCase().includes(searchLower) ||
      student.orderNumber.toLowerCase().includes(searchLower)
    );
  });
  
  // Get current page of students for pagination
  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents?.slice(indexOfFirstStudent, indexOfLastStudent);
  
  // Calculate total number of pages
  const totalPages = Math.ceil((filteredStudents?.length || 0) / studentsPerPage);
  
  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  // Handle file selection for import
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
        const headers = Object.keys(results.data[0] as object);
        setHeaders(headers);
        setParsedData(results.data);
        setShowImportDialog(true);
        
        // Auto-detect mappings
        autoDetectMappings(headers);
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
  
  // Auto-detect field mappings
  const autoDetectMappings = (headers: string[]) => {
    const newMapping: {[key: string]: string} = {};
    
    // Define mapping patterns
    const patterns: {[key: string]: RegExp[]} = {
      studentId: [/student.?id/i, /id.?number/i, /school.?id/i],
      firstName: [/first.?name/i, /name.?first/i, /given.?name/i],
      lastName: [/last.?name/i, /name.?last/i, /family.?name/i, /surname/i],
      orderNumber: [/order.?number/i, /order.?id/i, /order.?#/i],
      orderType: [/order.?type/i, /type/i],
      orderEnteredDate: [/order.?date/i, /date.?entered/i, /order.?entry.?date/i],
      yearbook: [/yearbook/i, /has.?yearbook/i, /book.?ordered/i],
      personalization: [/personal/i, /name.?stamp/i, /custom/i],
      signaturePackage: [/signature/i, /autograph/i, /sign/i],
      clearCover: [/clear.?cover/i, /protective.?cover/i, /cover/i],
      photoPockets: [/photo.?pocket/i, /picture.?pocket/i, /photo.?sleeve/i],
      balanceDue: [/balance/i, /amount.?due/i, /remaining/i, /due/i],
      paymentStatus: [/status/i, /payment.?status/i, /paid.?status/i],
    };
    
    // For each field, check if any headers match the patterns
    Object.entries(patterns).forEach(([field, fieldPatterns]) => {
      for (const header of headers) {
        if (fieldPatterns.some(pattern => pattern.test(header))) {
          newMapping[field] = header;
          break;
        }
      }
    });
    
    setMapping(newMapping);
  };
  
  // Handle mapping change
  const handleMappingChange = (field: string, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle import submission
  const handleImport = () => {
    if (!parsedData.length) return;
    
    setIsImporting(true);
    
    const studentsData: InsertStudent[] = parsedData.map(row => {
      const studentData: any = {
        // Required fields
        studentId: row[mapping.studentId] || `IMPORT${Math.floor(Math.random() * 1000000)}`,
        firstName: row[mapping.firstName] || "Unknown",
        lastName: row[mapping.lastName] || "Unknown",
        orderNumber: row[mapping.orderNumber] || `ORD${Math.floor(Math.random() * 1000000)}`,
        orderType: row[mapping.orderType] || "Standard",
        balanceDue: row[mapping.balanceDue] || "0",
        paymentStatus: row[mapping.paymentStatus] || "UNPAID",
        
        // Boolean fields
        yearbook: convertToBoolean(row[mapping.yearbook]),
        personalization: convertToBoolean(row[mapping.personalization]),
        signaturePackage: convertToBoolean(row[mapping.signaturePackage]),
        clearCover: convertToBoolean(row[mapping.clearCover]),
        photoPockets: convertToBoolean(row[mapping.photoPockets]),
      };
      
      // Add order date if present
      if (mapping.orderEnteredDate && row[mapping.orderEnteredDate]) {
        try {
          studentData.orderEnteredDate = new Date(row[mapping.orderEnteredDate]).toISOString();
        } catch (e) {
          // Use current date as fallback
          studentData.orderEnteredDate = new Date().toISOString();
        }
      }
      
      return studentData;
    });
    
    importStudentsMutation.mutate(studentsData);
  };
  
  // Helper function to convert various values to boolean
  const convertToBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const lowerVal = value.toLowerCase();
      return ['yes', 'true', 'y', '1'].includes(lowerVal);
    }
    return false;
  };
  
  // Show student details
  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentDetailDialog(true);
  };
  
  // Edit student mutation
  const editStudentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<InsertStudent> }) => {
      const res = await apiRequest('PUT', `/api/students/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Student updated",
        description: "The student information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      setShowEditDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update student",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle student edit
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: "",
      firstName: "",
      lastName: "",
      orderNumber: "",
      orderType: "Standard",
      balanceDue: "0",
      paymentStatus: "UNPAID",
      yearbook: true,
      personalization: false,
      signaturePackage: false,
      clearCover: false,
      photoPockets: false,
    },
  });
  
  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    
    // Set form values
    editForm.reset({
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      orderNumber: student.orderNumber,
      orderType: student.orderType,
      balanceDue: student.balanceDue.toString(),
      paymentStatus: student.paymentStatus,
      yearbook: student.yearbook,
      personalization: student.personalization,
      signaturePackage: student.signaturePackage,
      clearCover: student.clearCover,
      photoPockets: student.photoPockets,
    });
    
    setShowEditDialog(true);
  };
  
  const onEditSubmit = (data: z.infer<typeof formSchema>) => {
    if (editingStudent) {
      editStudentMutation.mutate({ 
        id: editingStudent.id, 
        data: data 
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg text-neutral-800 mb-1">Student Records</h3>
              <p className="text-neutral-600 text-sm">View and manage all student data</p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={() => setShowAddDialog(true)}>
                <FontAwesomeIcon icon="user-plus" className="mr-2" />
                Add Student
              </Button>
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FontAwesomeIcon icon="file-import" className="mr-2" />
                Import CSV
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          {studentsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FontAwesomeIcon icon="spinner" className="animate-spin text-3xl text-neutral-400 mb-2" />
                <p className="text-neutral-600">Loading students...</p>
              </div>
            </div>
          ) : studentsError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Failed to load students. Please try refreshing the page.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-auto max-h-[600px] rounded-md border">
              <Table>
                <TableCaption>
                  {filteredStudents?.length 
                    ? `Showing ${indexOfFirstStudent + 1}-${Math.min(indexOfLastStudent, filteredStudents.length)} of ${filteredStudents.length} student${filteredStudents.length > 1 ? 's' : ''}`
                    : 'No students found'}
                </TableCaption>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Yearbook</TableHead>
                    <TableHead>Distribution Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentStudents?.length ? (
                    currentStudents.map((student) => {
                      const distributionStatus = getDistributionStatus(student.id);
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.studentId}</TableCell>
                          <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
                          <TableCell>{student.orderNumber}</TableCell>
                          <TableCell>${Number(student.balanceDue).toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`py-1 px-2 rounded-full text-xs ${
                              student.paymentStatus === 'PAID' || student.paymentStatus === 'FREE' ? 'bg-green-100 text-green-800' :
                              student.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {student.paymentStatus}
                            </span>
                          </TableCell>
                          <TableCell>{student.yearbook ? 'Yes' : 'No'}</TableCell>
                          <TableCell>
                            {!distributionStatus.distributed ? (
                              <span className="py-1 px-2 rounded-full text-xs bg-neutral-100 text-neutral-800">
                                Pending Distribution
                              </span>
                            ) : distributionStatus.verified ? (
                              <span className="py-1 px-2 rounded-full text-xs bg-green-100 text-green-800">
                                Confirmed
                              </span>
                            ) : (
                              <span className="py-1 px-2 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                Distributed
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditStudent(student)}
                              >
                                <FontAwesomeIcon icon="edit" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewStudent(student)}
                              >
                                <FontAwesomeIcon icon="info-circle" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-neutral-500">
                        No students found. Add students using the "Add Student" button.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              {filteredStudents && filteredStudents.length > 0 && (
                <div className="flex justify-center items-center mt-4 mb-2 space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <FontAwesomeIcon icon="angle-double-left" className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <FontAwesomeIcon icon="angle-left" className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm mx-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <FontAwesomeIcon icon="angle-right" className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <FontAwesomeIcon icon="angle-double-right" className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Add Student Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter the student details to add them to the database.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="studentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter order #" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Order type" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="balanceDue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Balance Due</FormLabel>
                      <FormControl>
                        <Input placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <FormControl>
                        <Input placeholder="PAID/UNPAID/PARTIAL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="md:col-span-2">
                  <div className="font-medium text-sm mb-2">Yearbook Options</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="yearbook"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">Yearbook</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="personalization"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">Personalization</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="signaturePackage"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">Signature Package</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="clearCover"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">Clear Cover</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="photoPockets"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">Photo Pockets</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addStudentMutation.isPending}
                >
                  {addStudentMutation.isPending ? (
                    <>
                      <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                      Saving...
                    </>
                  ) : "Add Student"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Import Students from CSV</DialogTitle>
            <DialogDescription>
              Map the columns from your CSV file to the appropriate fields in our system.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Required Fields */}
              <div>
                <h3 className="text-sm font-medium mb-2">Required Fields</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Student ID <span className="text-red-500">*</span></label>
                    <select
                      value={mapping.studentId || ""}
                      onChange={(e) => handleMappingChange("studentId", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">First Name <span className="text-red-500">*</span></label>
                    <select
                      value={mapping.firstName || ""}
                      onChange={(e) => handleMappingChange("firstName", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Last Name <span className="text-red-500">*</span></label>
                    <select
                      value={mapping.lastName || ""}
                      onChange={(e) => handleMappingChange("lastName", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Order Number</label>
                    <select
                      value={mapping.orderNumber || ""}
                      onChange={(e) => handleMappingChange("orderNumber", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Optional Fields */}
              <div>
                <h3 className="text-sm font-medium mb-2">Optional Fields</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Yearbook</label>
                    <select
                      value={mapping.yearbook || ""}
                      onChange={(e) => handleMappingChange("yearbook", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Personalization</label>
                    <select
                      value={mapping.personalization || ""}
                      onChange={(e) => handleMappingChange("personalization", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Signature Package</label>
                    <select
                      value={mapping.signaturePackage || ""}
                      onChange={(e) => handleMappingChange("signaturePackage", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Payment Status</label>
                    <select
                      value={mapping.paymentStatus || ""}
                      onChange={(e) => handleMappingChange("paymentStatus", e.target.value)}
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {parsedData.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Preview (First {Math.min(3, parsedData.length)} of {parsedData.length} records)</h3>
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full divide-y divide-neutral-200 text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        {headers.map(header => (
                          <th key={header} className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {parsedData.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {headers.map(header => (
                            <td key={header} className="px-3 py-2 whitespace-nowrap">
                              {String(row[header] || "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || !mapping.studentId || !mapping.firstName || !mapping.lastName}
            >
              {isImporting ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Importing...
                </>
              ) : "Import Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Student Detail Dialog */}
      <Dialog open={showStudentDetailDialog} onOpenChange={setShowStudentDetailDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Student ID</h4>
                  <p className="text-sm font-medium">{selectedStudent.studentId}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Name</h4>
                  <p className="text-sm font-medium">{`${selectedStudent.firstName} ${selectedStudent.lastName}`}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Order Number</h4>
                  <p className="text-sm">{selectedStudent.orderNumber}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Order Type</h4>
                  <p className="text-sm">{selectedStudent.orderType}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Balance Due</h4>
                  <p className="text-sm">${Number(selectedStudent.balanceDue).toFixed(2)}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500 mb-1">Payment Status</h4>
                  <span className={`py-1 px-2 rounded-full text-xs ${
                    selectedStudent.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                    selectedStudent.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {selectedStudent.paymentStatus}
                  </span>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-neutral-500 mb-2">Yearbook Options</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <div className={`h-4 w-4 rounded-sm ${selectedStudent.yearbook ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
                      {selectedStudent.yearbook && <FontAwesomeIcon icon="check" className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">Yearbook</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`h-4 w-4 rounded-sm ${selectedStudent.personalization ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
                      {selectedStudent.personalization && <FontAwesomeIcon icon="check" className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">Personalization</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`h-4 w-4 rounded-sm ${selectedStudent.signaturePackage ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
                      {selectedStudent.signaturePackage && <FontAwesomeIcon icon="check" className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">Signature Package</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`h-4 w-4 rounded-sm ${selectedStudent.clearCover ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
                      {selectedStudent.clearCover && <FontAwesomeIcon icon="check" className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">Clear Cover</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`h-4 w-4 rounded-sm ${selectedStudent.photoPockets ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
                      {selectedStudent.photoPockets && <FontAwesomeIcon icon="check" className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">Photo Pockets</span>
                  </div>
                </div>
              </div>
              
              {selectedStudent.photoUrl && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-neutral-500 mb-2">Student Photo</h4>
                  <img 
                    src={selectedStudent.photoUrl} 
                    alt={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
                    className="rounded-md max-h-48 border"
                  />
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium text-neutral-500 mb-2">Distribution Status</h4>
                {(() => {
                  const distributionStatus = getDistributionStatus(selectedStudent.id);
                  if (!distributionStatus.distributed) {
                    return (
                      <div className="bg-neutral-50 p-3 rounded-md border">
                        <p className="text-sm text-neutral-600">This yearbook has not been distributed yet.</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-neutral-50 p-3 rounded-md border">
                      <p className="text-sm mb-1">
                        <span className="font-medium">Distributed:</span> Yes
                      </p>
                      <p className="text-sm mb-1">
                        <span className="font-medium">Date:</span> {new Date(distributionStatus.timestamp!).toLocaleString()}
                      </p>
                      <p className="text-sm mb-1">
                        <span className="font-medium">Distributed By:</span> {distributionStatus.distributedBy}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Verified:</span> {distributionStatus.verified ? 'Yes' : 'No'}
                        {distributionStatus.verified && (
                          <span> (by {distributionStatus.verifiedBy})</span>
                        )}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="destructive" 
              onClick={() => selectedStudent && deleteStudentMutation.mutate(selectedStudent.id)}
              disabled={deleteStudentMutation.isPending}
            >
              {deleteStudentMutation.isPending ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="trash" className="mr-2" />
                  Delete
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowStudentDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Student Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Type</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="balanceDue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Balance Due</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Features</h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={editForm.control}
                    name="yearbook"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Yearbook</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="personalization"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Personalization</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="signaturePackage"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Signature Package</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="clearCover"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Clear Cover</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="photoPockets"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Photo Pockets</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={editStudentMutation.isPending}
                >
                  {editStudentMutation.isPending ? (
                    <>
                      <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}