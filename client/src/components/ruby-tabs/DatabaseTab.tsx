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
  DialogFooter,
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
  CsvMapping,
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import Papa from "papaparse";

interface DatabaseTabProps {
  operatorName: string;
}

export function DatabaseTab({ operatorName }: DatabaseTabProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fileSelected, setFileSelected] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{ [key: string]: string }>({});
  const [isImporting, setIsImporting] = useState(false);
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extended schema for form validation
  const formSchema = insertStudentSchema.extend({
    orderNumber: z.string().min(1, "Order number is required"),
    balanceDue: z.string().refine((val) => !isNaN(parseFloat(val)), {
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
    isError: studentsError,
  } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    staleTime: 10000,
  });

  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (data: InsertStudent) => {
      const res = await apiRequest("POST", "/api/students", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Student added",
        description: "The student has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setShowAddDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add student",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Import students mutation
  const importStudentsMutation = useMutation({
    mutationFn: async (students: InsertStudent[]) => {
      const res = await apiRequest("POST", "/api/students/import", students);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import complete",
        description: `Successfully imported ${data.success} of ${data.total} students.`,
        variant: data.errors > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
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
        variant: "destructive",
      });
      setIsImporting(false);
    },
  });
  
  // Wipe database mutation
  const wipeDbMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/database/wipe", { operatorName });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Database wiped successfully",
        description: `Successfully deleted ${data.deleted} of ${data.totalStudents} students.`,
        variant: data.errors > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setShowWipeDialog(false);
      setIsWiping(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to wipe database",
        description: error.message,
        variant: "destructive",
      });
      setIsWiping(false);
    },
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    addStudentMutation.mutate(data);
  };

  // Filter students based on search term
  const filteredStudents = students?.filter((student) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.studentId.toLowerCase().includes(searchLower) ||
      student.orderNumber.toLowerCase().includes(searchLower)
    );
  });

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
            variant: "destructive",
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
          variant: "destructive",
        });
      },
    });
  };

  // Auto-detect field mappings
  const autoDetectMappings = (headers: string[]) => {
    const newMapping: { [key: string]: string } = {};

    // Define mapping patterns
    const patterns: { [key: string]: RegExp[] } = {
      studentId: [/student.?id/i, /id.?number/i, /school.?id/i],
      firstName: [/first.?name/i, /name.?first/i, /given.?name/i],
      lastName: [/last.?name/i, /name.?last/i, /family.?name/i, /surname/i],
      orderNumber: [/order.?number/i, /order.?id/i, /order.?#/i],
      orderType: [/order.?type/i, /type/i],
      orderEnteredDate: [
        /order.?date/i,
        /date.?entered/i,
        /order.?entry.?date/i,
      ],
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
        if (fieldPatterns.some((pattern) => pattern.test(header))) {
          newMapping[field] = header;
          break;
        }
      }
    });

    setMapping(newMapping);
  };

  // Handle mapping change
  const handleMappingChange = (field: string, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  // Handle import submission
  const handleImport = () => {
    if (!parsedData.length) return;

    setIsImporting(true);

    const studentsData: InsertStudent[] = parsedData.map((row) => {
      const studentData: any = {
        // Required fields
        studentId:
          row[mapping.studentId] ||
          `IMPORT${Math.floor(Math.random() * 1000000)}`,
        firstName: row[mapping.firstName] || "Unknown",
        lastName: row[mapping.lastName] || "Unknown",
        orderNumber:
          row[mapping.orderNumber] ||
          `ORD${Math.floor(Math.random() * 1000000)}`,
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
          studentData.orderEnteredDate = new Date(
            row[mapping.orderEnteredDate],
          ).toISOString();
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
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") {
      const lowerVal = value.toLowerCase();
      return ["yes", "true", "y", "1"].includes(lowerVal);
    }
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Export and Import Options */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-neutral-800 mb-1">
              Data Management
            </h3>
            <p className="text-neutral-600 text-sm">
              Import and export options
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-medium mb-3">
                CSV Import Instructions
              </h4>
              <Alert>
                <AlertDescription>
                  <p className="text-sm mb-1">
                    <strong>CSV Format:</strong> Your file should include
                    columns for student information such as ID, name, and order
                    details.
                  </p>
                  <p className="text-sm">
                    <strong>Headers:</strong> Include a header row with
                    descriptive column names for automatic field mapping.
                  </p>
                  <p className="text-sm">
                    <strong>Boolean Fields:</strong> For yes/no fields like
                    "Yearbook", use "True" for positive and "False" for
                    negative.
                  </p>
                  <a
                    href="https://cdn.gunter.cloud/uploads/i7b2Bp/student_orders.csv"
                    download
                  >
                    <div className="flex space-x-2">
                      <Button variant="outline">
                        <FontAwesomeIcon icon="file-alt" className="mr-2" />
                        Download Example
                      </Button>
                    </div>
                  </a>
                </AlertDescription>
              </Alert>
            </div>

            <div>
              <h4 className="text-md font-medium mb-3">Export Options</h4>
              <div className="border border-neutral-200 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h5 className="text-sm font-medium mb-2">
                      Export Student Data
                    </h5>
                    <p className="text-neutral-600 text-sm mb-3">
                      Download student data in various formats.
                    </p>
                    <div className="flex space-x-2">
                      <Button 
                      variant="outline" 
                      disabled={!students?.length}
                      onClick={() => {
                        if (students && students.length > 0) {
                          const headers = Object.keys(students[0]).join(',');
                          const rows = students.map(student => {
                            return Object.values(student).map(value => {
                              if (typeof value === 'string' && value.includes(',')) {
                                return `"${value}"`;
                              }
                              return value;
                            }).join(',');
                          });
                          
                          const csv = [headers, ...rows].join('\n');
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `yearbook_students_${new Date().toISOString().slice(0,10)}.csv`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          
                          toast({
                            title: "Export Complete",
                            description: "Student data has been exported to CSV.",
                          });
                        }
                      }}
                    >
                        <FontAwesomeIcon icon="file-alt" className="mr-2" />
                        Export to CSV
                    </Button>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-neutral-200 pt-4">
                    <h5 className="text-sm font-medium mb-2">
                      Database Management
                    </h5>
                    <p className="text-neutral-600 text-sm mb-3">
                      Advanced database options. Please use with caution.
                    </p>
                    <div className="flex space-x-2">
                      <Button 
                        variant="destructive" 
                        disabled={!students?.length}
                        onClick={() => {
                          setShowWipeDialog(true);
                        }}
                      >
                        <FontAwesomeIcon icon="trash-alt" className="mr-2" />
                        Wipe Database
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Confirmation Dialog for Database Wipe */}
      <Dialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete all student 
              records from the database.
              
              <div className="mt-2 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                <p className="text-yellow-800 font-medium">Warning:</p>
                <p className="text-yellow-700 text-sm">
                  All student data, distributions, and payment records will be permanently 
                  deleted. It is strongly recommended to export a backup first.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" disabled={isWiping} onClick={() => setShowWipeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isWiping}
              onClick={() => {
                setIsWiping(true);
                wipeDbMutation.mutate();
              }}
            >
              {isWiping ? (
                <>
                  <FontAwesomeIcon icon="spinner" spin className="mr-2" />
                  Wiping...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="trash-alt" className="mr-2" />
                  Wipe Database
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <div className="font-medium text-sm mb-2">
                    Yearbook Options
                  </div>
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
                          <FormLabel className="text-sm font-normal">
                            Yearbook
                          </FormLabel>
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
                          <FormLabel className="text-sm font-normal">
                            Personalization
                          </FormLabel>
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
                          <FormLabel className="text-sm font-normal">
                            Signature Package
                          </FormLabel>
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
                          <FormLabel className="text-sm font-normal">
                            Clear Cover
                          </FormLabel>
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
                          <FormLabel className="text-sm font-normal">
                            Photo Pockets
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={addStudentMutation.isPending}>
                  {addStudentMutation.isPending ? (
                    <>
                      <FontAwesomeIcon
                        icon="spinner"
                        className="animate-spin mr-2"
                      />
                      Saving...
                    </>
                  ) : (
                    "Add Student"
                  )}
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
              Map the columns from your CSV file to the appropriate fields in
              our system.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Required Fields */}
              <div>
                <h3 className="text-sm font-medium mb-2">Required Fields</h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Student ID <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.studentId || ""}
                      onChange={(e) =>
                        handleMappingChange("studentId", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.firstName || ""}
                      onChange={(e) =>
                        handleMappingChange("firstName", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.lastName || ""}
                      onChange={(e) =>
                        handleMappingChange("lastName", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Order Number
                    </label>
                    <select
                      value={mapping.orderNumber || ""}
                      onChange={(e) =>
                        handleMappingChange("orderNumber", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
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
                    <label className="text-sm font-medium mb-1 block">
                      Yearbook
                    </label>
                    <select
                      value={mapping.yearbook || ""}
                      onChange={(e) =>
                        handleMappingChange("yearbook", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Personalization
                    </label>
                    <select
                      value={mapping.personalization || ""}
                      onChange={(e) =>
                        handleMappingChange("personalization", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Signature Package
                    </label>
                    <select
                      value={mapping.signaturePackage || ""}
                      onChange={(e) =>
                        handleMappingChange("signaturePackage", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Payment Status
                    </label>
                    <select
                      value={mapping.paymentStatus || ""}
                      onChange={(e) =>
                        handleMappingChange("paymentStatus", e.target.value)
                      }
                      className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                    >
                      <option value="">-- Select field --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {parsedData.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">
                  Preview (First {Math.min(3, parsedData.length)} of{" "}
                  {parsedData.length} records)
                </h3>
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full divide-y divide-neutral-200 text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        {headers.map((header) => (
                          <th
                            key={header}
                            className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {parsedData.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {headers.map((header) => (
                            <td
                              key={header}
                              className="px-3 py-2 whitespace-nowrap"
                            >
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
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                isImporting ||
                !mapping.studentId ||
                !mapping.firstName ||
                !mapping.lastName
              }
            >
              {isImporting ? (
                <>
                  <FontAwesomeIcon
                    icon="spinner"
                    className="animate-spin mr-2"
                  />
                  Importing...
                </>
              ) : (
                "Import Data"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
