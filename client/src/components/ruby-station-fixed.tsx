import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student } from "@shared/schema";
import { formatCurrency, parseCSV } from "@/lib/utils";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { socketProvider } from "@/lib/socket";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface RubyStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function RubyStation({ operatorName, onLogout }: RubyStationProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [csvMappings, setCsvMappings] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showFreeBookDialog, setShowFreeBookDialog] = useState(false);
  const [freeBookStudentName, setFreeBookStudentName] = useState(""); // Changed from studentId to name
  const [showSystemLogs, setShowSystemLogs] = useState(false);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    lastName: "",
    firstName: "",
    orderType: "",
    orderNumber: "",
    balanceDue: "0",
    paymentStatus: "Unpaid",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formattedLogs, isConnected } = useWsLogs();

  // Fetch all students
  const {
    data: students,
    isLoading: studentsLoading,
    refetch: refetchStudents,
  } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    staleTime: 30000, // 30 seconds
  });

  // Filter students based on search term
  const filteredStudents = students?.filter((student) => {
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    return (
      student.studentId.toLowerCase().includes(term) ||
      student.firstName.toLowerCase().includes(term) ||
      student.lastName.toLowerCase().includes(term) ||
      student.orderNumber.toLowerCase().includes(term)
    );
  });

  // CSV upload mutation
  const csvMutation = useMutation({
    mutationFn: async (data: {
      mappings: Record<string, string>;
      csvData: any[];
      operatorName: string;
    }) => {
      const res = await apiRequest("POST", "/api/students/import", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "CSV Import Successful",
        description: `Successfully imported ${data.imported} students.`,
      });

      // Log the action via WebSocket
      socketProvider.send({
        type: "LOG_ACTION",
        data: {
          id: Date.now(),
          timestamp: new Date(),
          studentId: null,
          action: "IMPORT_STUDENTS",
          details: { count: data.imported },
          stationName: "Ruby Station",
          operatorName,
        },
      });

      // Close dialog and reset form
      setShowCsvDialog(false);
      setCsvContent("");
      setCsvMappings({});
      setCsvHeaders([]);

      // Refetch students to update the table
      refetchStudents();
    },
    onError: (error: Error) => {
      toast({
        title: "CSV Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (studentData: typeof newStudent) => {
      const res = await apiRequest("POST", "/api/students", studentData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Student Added",
        description: `Successfully added ${data.firstName} ${data.lastName} to the database.`,
      });

      // Close dialog and reset form
      setShowAddStudentDialog(false);
      setNewStudent({
        studentId: "",
        lastName: "",
        firstName: "",
        orderType: "",
        orderNumber: "",
        balanceDue: "0",
        paymentStatus: "Unpaid",
      });

      // Refetch students to update the table
      refetchStudents();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Student",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Free book mutation
  const freeBookMutation = useMutation({
    mutationFn: async ({
      studentName,
      operatorName,
    }: {
      studentName: string;
      operatorName: string;
    }) => {
      // Find student by name
      const student = students?.find(
        (s) =>
          `${s.firstName} ${s.lastName}`
            .toLowerCase()
            .includes(studentName.toLowerCase()) ||
          `${s.lastName} ${s.firstName}`
            .toLowerCase()
            .includes(studentName.toLowerCase()),
      );

      if (!student) {
        throw new Error(`No student found with name: ${studentName}`);
      }

      const res = await apiRequest(
        "POST",
        `/api/students/${student.studentId}/free-book`,
        { operatorName },
      );
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Free Book Issued",
        description: `Successfully issued a free book to ${data.student.firstName} ${data.student.lastName}.`,
      });

      // Close dialog and reset form
      setShowFreeBookDialog(false);
      setFreeBookStudentName("");

      // Refetch students to update the table
      refetchStudents();
    },
    onError: (error: Error) => {
      toast({
        title: "Free Book Issue Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle CSV file upload
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target?.result as string;
      setCsvContent(csvText);

      // Parse the CSV to get headers
      const parsedData = parseCSV(csvText);
      if (parsedData.length > 0) {
        setCsvHeaders(Object.keys(parsedData[0]));
      }
    };
    reader.readAsText(file);
  };

  // Handle CSV mapping selection
  const handleMappingSelect = (field: string, header: string) => {
    setCsvMappings((prev) => ({
      ...prev,
      [field]: header,
    }));
  };

  // Process CSV import
  const processCsvImport = () => {
    if (!csvContent || Object.keys(csvMappings).length < 7) {
      toast({
        title: "Mapping Required",
        description: "Please map all required fields before importing.",
        variant: "destructive",
      });
      return;
    }

    const parsedData = parseCSV(csvContent);
    csvMutation.mutate({
      mappings: csvMappings,
      csvData: parsedData,
      operatorName,
    });
  };

  // Handle add student form changes
  const handleNewStudentChange = (field: string, value: string) => {
    setNewStudent((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Add a new student
  const addStudent = () => {
    if (
      !newStudent.studentId ||
      !newStudent.firstName ||
      !newStudent.lastName
    ) {
      toast({
        title: "Missing Information",
        description:
          "Please provide Student ID, First Name, and Last Name at minimum.",
        variant: "destructive",
      });
      return;
    }

    addStudentMutation.mutate(newStudent);
  };

  // Issue free book
  const issueFreeBook = () => {
    if (!freeBookStudentName) {
      toast({
        title: "Student Name Required",
        description: "Please enter a student name to issue a free book.",
        variant: "destructive",
      });
      return;
    }

    freeBookMutation.mutate({
      studentName: freeBookStudentName,
      operatorName,
    });
  };

  // Handle database backup
  const handleDatabaseBackup = () => {
    // This would typically download a CSV or JSON file of the database
    // For now, just show a toast message
    toast({
      title: "Database Backup",
      description: "Database backup functionality would be implemented here.",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">
          Ruby Station (Admin Hub)
        </h2>
        <Button
          variant="outline"
          onClick={onLogout}
          className="text-neutral-600 hover:text-neutral-800"
        >
          <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
          Exit Station
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-neutral-800">
                  Student Database
                </h3>
                <div className="flex space-x-2">
                  <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="px-3 py-1 h-9 text-sm text-primary"
                      >
                        <FontAwesomeIcon icon="file-upload" className="mr-2" />
                        Import CSV
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Import Students from CSV</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        {!csvContent ? (
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
                              Map CSV Headers to Student Fields
                            </h4>
                            <div className="space-y-4 max-h-80 overflow-y-auto">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="text-sm font-medium text-neutral-700">
                                  Student Field
                                </div>
                                <div className="text-sm font-medium text-neutral-700">
                                  CSV Header
                                </div>

                                {[
                                  {
                                    key: "studentIdField",
                                    label: "Student ID",
                                  },
                                  { key: "lastNameField", label: "Last Name" },
                                  {
                                    key: "firstNameField",
                                    label: "First Name",
                                  },
                                  {
                                    key: "orderTypeField",
                                    label: "Order Type",
                                  },
                                  {
                                    key: "orderNumberField",
                                    label: "Order Number",
                                  },
                                  {
                                    key: "balanceDueField",
                                    label: "Balance Due",
                                  },
                                  {
                                    key: "paymentStatusField",
                                    label: "Payment Status",
                                  },
                                  { key: "yearbookField", label: "Yearbook" },
                                  {
                                    key: "personalizationField",
                                    label: "Personalization",
                                  },
                                  {
                                    key: "signaturePackageField",
                                    label: "Signature Package",
                                  },
                                  {
                                    key: "clearCoverField",
                                    label: "Clear Cover",
                                  },
                                  {
                                    key: "photoPocketsField",
                                    label: "Photo Pockets",
                                  },
                                ].map((field) => (
                                  <Fragment key={field.key}>
                                    <div className="text-sm text-neutral-600">
                                      {field.label}
                                      {field.key.includes("Field") &&
                                        !field.key.includes("yearbook") &&
                                        !field.key.includes(
                                          "personalization",
                                        ) &&
                                        !field.key.includes("signature") &&
                                        !field.key.includes("clear") &&
                                        !field.key.includes("photo") && (
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        )}
                                    </div>
                                    <select
                                      className="w-full text-sm p-1 border border-neutral-300 rounded"
                                      value={csvMappings[field.key] || ""}
                                      onChange={(e) =>
                                        handleMappingSelect(
                                          field.key,
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="">Select header...</option>
                                      {csvHeaders.map((header) => (
                                        <option key={header} value={header}>
                                          {header}
                                        </option>
                                      ))}
                                    </select>
                                  </Fragment>
                                ))}
                              </div>
                            </div>

                            <div className="text-xs text-neutral-500 mt-4">
                              * Required fields
                            </div>

                            <div className="flex justify-end space-x-2 mt-4">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setCsvContent("");
                                  setCsvMappings({});
                                  setCsvHeaders([]);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={processCsvImport}
                                disabled={csvMutation.isPending}
                              >
                                {csvMutation.isPending ? (
                                  <>
                                    <FontAwesomeIcon
                                      icon="sync"
                                      className="mr-2 animate-spin"
                                    />
                                    Importing...
                                  </>
                                ) : (
                                  "Import Students"
                                )}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                      <FontAwesomeIcon icon="search" />
                    </span>
                    <Input
                      type="text"
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 py-1 h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div
                className="overflow-hidden overflow-x-auto"
                style={{ maxHeight: "400px" }}
              >
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                      >
                        ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                      >
                        Last Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                      >
                        First Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                      >
                        Order Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                      >
                        Balance
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {studentsLoading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-4 text-center text-sm text-neutral-500"
                        >
                          <FontAwesomeIcon
                            icon="sync"
                            className="animate-spin mr-2"
                          />
                          Loading students...
                        </td>
                      </tr>
                    ) : filteredStudents && filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                            {student.studentId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800">
                            {student.lastName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                            {student.firstName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                            {new Date(
                              student.orderEnteredDate,
                            ).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                            {formatCurrency(
                              parseFloat(student.balanceDue.toString()),
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant="secondary"
                              className={`
                                ${student.paymentStatus.toLowerCase() === "paid" ? "bg-green-100 text-green-800" : ""}
                                ${student.paymentStatus.toLowerCase() === "unpaid" ? "bg-yellow-100 text-yellow-800" : ""}
                                ${student.paymentStatus.toLowerCase() === "free" ? "bg-blue-100 text-blue-800" : ""}
                              `}
                            >
                              {student.paymentStatus}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                            >
                              <FontAwesomeIcon icon="edit" className="mr-1" />{" "}
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-4 text-center text-sm text-neutral-500"
                        >
                          {searchTerm
                            ? "No students match your search."
                            : "No students found in the database."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-neutral-800">
                  Quick Actions
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-neutral-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-neutral-800 mb-2">
                    Add Student
                  </h4>
                  <p className="text-xs text-neutral-600 mb-3">
                    Manually add a new student to the database
                  </p>
                  <Dialog
                    open={showAddStudentDialog}
                    onOpenChange={setShowAddStudentDialog}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        className="inline-flex items-center bg-primary hover:bg-primary-dark"
                      >
                        <FontAwesomeIcon icon="user-plus" className="mr-2" />
                        Add Student
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New Student</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              Student ID <span className="text-red-500">*</span>
                            </label>
                            <Input
                              value={newStudent.studentId}
                              onChange={(e) =>
                                handleNewStudentChange(
                                  "studentId",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter student ID"
                              className="w-full"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                First Name{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <Input
                                value={newStudent.firstName}
                                onChange={(e) =>
                                  handleNewStudentChange(
                                    "firstName",
                                    e.target.value,
                                  )
                                }
                                placeholder="First name"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Last Name{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <Input
                                value={newStudent.lastName}
                                onChange={(e) =>
                                  handleNewStudentChange(
                                    "lastName",
                                    e.target.value,
                                  )
                                }
                                placeholder="Last name"
                                className="w-full"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Order Type
                              </label>
                              <Input
                                value={newStudent.orderType}
                                onChange={(e) =>
                                  handleNewStudentChange(
                                    "orderType",
                                    e.target.value,
                                  )
                                }
                                placeholder="Order type"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Order Number
                              </label>
                              <Input
                                value={newStudent.orderNumber}
                                onChange={(e) =>
                                  handleNewStudentChange(
                                    "orderNumber",
                                    e.target.value,
                                  )
                                }
                                placeholder="Order number"
                                className="w-full"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Balance Due ($)
                              </label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={newStudent.balanceDue}
                                onChange={(e) =>
                                  handleNewStudentChange(
                                    "balanceDue",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.00"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Payment Status
                              </label>
                              <select
                                value={newStudent.paymentStatus}
                                onChange={(e) =>
                                  handleNewStudentChange(
                                    "paymentStatus",
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-md border border-neutral-300 p-2 text-sm"
                              >
                                <option value="Unpaid">UNPAID</option>
                                <option value="Paid">PAID</option>
                                <option value="Free">FREE</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 mt-6">
                          <Button
                            variant="outline"
                            onClick={() => setShowAddStudentDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={addStudent}
                            disabled={addStudentMutation.isPending}
                          >
                            {addStudentMutation.isPending ? (
                              <>
                                <FontAwesomeIcon
                                  icon="sync"
                                  className="mr-2 animate-spin"
                                />
                                Adding...
                              </>
                            ) : (
                              "Add Student"
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="bg-neutral-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-neutral-800 mb-2">
                    Issue Free Book
                  </h4>
                  <p className="text-xs text-neutral-600 mb-3">
                    Record a complimentary yearbook distribution
                  </p>
                  <Dialog
                    open={showFreeBookDialog}
                    onOpenChange={setShowFreeBookDialog}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        className="inline-flex items-center bg-secondary hover:bg-secondary/90"
                      >
                        <FontAwesomeIcon icon="gift" className="mr-2" />
                        Issue Free Book
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Issue Free Book</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-neutral-700 mb-1">
                            Student Name
                          </label>
                          <Input
                            value={freeBookStudentName}
                            onChange={(e) =>
                              setFreeBookStudentName(e.target.value)
                            }
                            placeholder="Enter student name"
                            className="w-full"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowFreeBookDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={issueFreeBook}
                            disabled={freeBookMutation.isPending}
                          >
                            {freeBookMutation.isPending ? (
                              <>
                                <FontAwesomeIcon
                                  icon="sync"
                                  className="mr-2 animate-spin"
                                />
                                Processing...
                              </>
                            ) : (
                              "Issue Free Book"
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="bg-neutral-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-neutral-800 mb-2">
                    Backup Database
                  </h4>
                  <p className="text-xs text-neutral-600 mb-3">
                    Create a backup of current database
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="inline-flex items-center bg-neutral-700 hover:bg-neutral-800 text-white"
                    onClick={handleDatabaseBackup}
                  >
                    <FontAwesomeIcon icon="download" className="mr-2" />
                    Backup Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-neutral-800 mb-4">
                  Live Activity
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSystemLogs(true)}
                  className="mb-2"
                >
                  <FontAwesomeIcon icon="list" className="mr-2" />
                  View All
                </Button>
              </div>
              <Dialog open={showSystemLogs} onOpenChange={setShowSystemLogs}>
                <DialogContent className="max-w-3xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>System Logs</DialogTitle>
                  </DialogHeader>
                  <div
                    className="py-4 overflow-y-auto"
                    style={{ maxHeight: "calc(80vh - 120px)" }}
                  >
                    <table className="min-w-full divide-y divide-neutral-200">
                      <thead>
                        <tr>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                          >
                            Time
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                          >
                            Action
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                          >
                            Details
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                          >
                            Operator
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {formattedLogs.length > 0 ? (
                          formattedLogs.map((log, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div
                                    className={`flex-shrink-0 h-6 w-6 rounded-full ${log.color} flex items-center justify-center mr-2`}
                                  >
                                    <FontAwesomeIcon
                                      icon={log.icon}
                                      className="text-xs"
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-neutral-800">
                                    {log.title}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-600">
                                {log.details}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-600">
                                {log.data.operatorName || "System"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-2 text-center text-sm text-neutral-500"
                            >
                              No system logs available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {formattedLogs.length > 0 ? (
                  formattedLogs.slice(0, 15).map((log, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div
                        className={`flex-shrink-0 h-8 w-8 rounded-full ${log.color} flex items-center justify-center`}
                      >
                        <FontAwesomeIcon icon={log.icon} />
                      </div>
                      <div>
                        <p className="text-sm text-neutral-800">
                          <span className="font-medium">{log.title}</span>{" "}
                          {log.details}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(log.timestamp).toLocaleTimeString()} by{" "}
                          {log.data.operatorName || "System"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <div className="bg-neutral-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                      <FontAwesomeIcon
                        icon="info-circle"
                        className="text-neutral-400"
                      />
                    </div>
                    <p className="text-sm text-neutral-600">
                      No activity logged yet.
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Recent actions will appear here.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center mt-4">
                <p className="text-xs text-neutral-500 flex items-center justify-center">
                  {isConnected ? (
                    <>
                      <span className="h-2 w-2 bg-green-500 rounded-full inline-block mr-2"></span>
                      Connected to live updates
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 bg-red-500 rounded-full inline-block mr-2"></span>
                      Disconnected from live updates
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">
                Station Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-blue-100 rounded-full p-2 mr-3">
                      <FontAwesomeIcon icon="box" className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        Distribution
                      </p>
                      <p className="text-xs text-neutral-500">
                        2 active operators
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 border-green-200"
                  >
                    Online
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-purple-100 rounded-full p-2 mr-3">
                      <FontAwesomeIcon
                        icon="clipboard-check"
                        className="text-purple-600"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        Checker
                      </p>
                      <p className="text-xs text-neutral-500">
                        1 active operator
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 border-green-200"
                  >
                    Online
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-green-100 rounded-full p-2 mr-3">
                      <FontAwesomeIcon
                        icon="money-bill-alt"
                        className="text-green-600"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        Cash
                      </p>
                      <p className="text-xs text-neutral-500">
                        1 active operator
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 border-green-200"
                  >
                    Online
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
