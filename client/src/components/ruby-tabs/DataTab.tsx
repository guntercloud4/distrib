import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "../../lib/queryClient";
import { type Student, insertStudentSchema } from "@shared/schema";

interface DataTabProps {
  operatorName: string;
}

const studentFormSchema = insertStudentSchema.extend({
  balanceDue: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? val : val.toString()
  ),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

export function DataTab({ operatorName }: DataTabProps) {
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  
  const queryClient = useQueryClient();
  
  // Fetch all students
  const { data: students = [] as Student[], isLoading, error } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    refetchInterval: 5000
  });
  
  // Edit student mutation
  const editStudentMutation = useMutation({
    mutationFn: async (data: StudentFormValues & { id: number }) => {
      const { id, ...studentData } = data;
      return apiRequest(
        'PUT',
        `/api/students/${id}`,
        { ...studentData, operatorName }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      setEditingStudent(null);
    }
  });
  
  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (data: StudentFormValues) => {
      return apiRequest(
        'POST',
        '/api/students',
        { ...data, operatorName }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      setIsAddDialogOpen(false);
      form.reset();
    }
  });

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(
        'DELETE',
        `/api/students/${id}`,
        { operatorName }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    }
  });
  
  // Setup form with default values if editing a student
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: editingStudent ? {
      studentId: editingStudent.studentId,
      firstName: editingStudent.firstName,
      lastName: editingStudent.lastName,
      orderType: editingStudent.orderType,
      orderNumber: editingStudent.orderNumber,
      balanceDue: editingStudent.balanceDue,
      paymentStatus: editingStudent.paymentStatus,
      yearbook: editingStudent.yearbook,
      personalization: editingStudent.personalization,
      signaturePackage: editingStudent.signaturePackage,
      clearCover: editingStudent.clearCover,
      photoPockets: editingStudent.photoPockets,
      photoUrl: editingStudent.photoUrl || "",
    } : {
      studentId: "",
      firstName: "",
      lastName: "",
      orderType: "Standard",
      orderNumber: "",
      balanceDue: "0",
      paymentStatus: "Unpaid",
      yearbook: false,
      personalization: false,
      signaturePackage: false,
      clearCover: false,
      photoPockets: false,
      photoUrl: "",
    }
  });
  
  // Update form values when editing student changes
  useEffect(() => {
    if (editingStudent) {
      form.reset({
        studentId: editingStudent.studentId,
        firstName: editingStudent.firstName,
        lastName: editingStudent.lastName,
        orderType: editingStudent.orderType,
        orderNumber: editingStudent.orderNumber,
        balanceDue: editingStudent.balanceDue,
        paymentStatus: editingStudent.paymentStatus,
        yearbook: editingStudent.yearbook,
        personalization: editingStudent.personalization,
        signaturePackage: editingStudent.signaturePackage,
        clearCover: editingStudent.clearCover,
        photoPockets: editingStudent.photoPockets,
        photoUrl: typeof editingStudent.photoUrl === 'string' ? editingStudent.photoUrl : "",
      });
    } else if (isAddDialogOpen) {
      form.reset({
        studentId: "",
        firstName: "",
        lastName: "",
        orderType: "Standard",
        orderNumber: "",
        balanceDue: "0",
        paymentStatus: "Unpaid",
        yearbook: false,
        personalization: false,
        signaturePackage: false,
        clearCover: false,
        photoPockets: false,
        photoUrl: "",
      });
    }
  }, [editingStudent, isAddDialogOpen, form]);
  
  // Handle form submission
  function onSubmit(data: StudentFormValues) {
    if (editingStudent) {
      editStudentMutation.mutate({
        ...data,
        id: editingStudent.id
      });
    } else {
      addStudentMutation.mutate(data);
    }
  }
  
  // Filter students based on search term
  const filteredStudents = students.filter((student: Student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.studentId.toLowerCase().includes(searchLower) ||
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.orderType.toLowerCase().includes(searchLower) ||
      student.orderNumber.toLowerCase().includes(searchLower) ||
      student.paymentStatus.toLowerCase().includes(searchLower)
    );
  });
  
  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold">Student Data</CardTitle>
          <div className="flex space-x-2">
            <div className="relative">
              <FontAwesomeIcon 
                icon="search" 
                className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" 
              />
              <Input
                type="search"
                placeholder="Search students..."
                className="w-64 pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <FontAwesomeIcon icon="plus" className="mr-2" />
              Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-4">
              <FontAwesomeIcon icon="spinner" spin className="text-2xl" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              <FontAwesomeIcon icon="exclamation-triangle" className="mr-2" />
              Failed to load student data
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Order Type</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Options</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center">
                        No students found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student: Student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.studentId}</TableCell>
                        <TableCell>{student.lastName}, {student.firstName}</TableCell>
                        <TableCell>{student.orderType}</TableCell>
                        <TableCell>{student.orderNumber}</TableCell>
                        <TableCell>${student.balanceDue}</TableCell>
                        <TableCell>
                          <span 
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              student.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                              student.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}
                          >
                            {student.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {student.yearbook && (
                              <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                YB
                              </span>
                            )}
                            {student.personalization && (
                              <span className="px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                                PER
                              </span>
                            )}
                            {student.signaturePackage && (
                              <span className="px-1 py-0.5 bg-teal-100 text-teal-800 text-xs rounded">
                                SIG
                              </span>
                            )}
                            {student.clearCover && (
                              <span className="px-1 py-0.5 bg-indigo-100 text-indigo-800 text-xs rounded">
                                CC
                              </span>
                            )}
                            {student.photoPockets && (
                              <span className="px-1 py-0.5 bg-pink-100 text-pink-800 text-xs rounded">
                                PP
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setEditingStudent(student)}
                            >
                              <FontAwesomeIcon icon="edit" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this student?")) {
                                  deleteStudentMutation.mutate(student.id);
                                }
                              }}
                            >
                              <FontAwesomeIcon icon="trash" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Student Dialog */}
      <Dialog 
        open={editingStudent !== null} 
        onOpenChange={(open) => !open && setEditingStudent(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information in the database.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="studentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student ID</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly={!!editingStudent} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
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
                      control={form.control}
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
                      control={form.control}
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
                      control={form.control}
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
                      control={form.control}
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
                      control={form.control}
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
                  
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Photo URL</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="yearbook"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Yearbook</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="personalization"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Personalization</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="signaturePackage"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Signature Package</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="clearCover"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Clear Cover</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="photoPockets"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Photo Pockets</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setEditingStudent(null)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={editStudentMutation.isPending}
                    >
                      {editStudentMutation.isPending && (
                        <FontAwesomeIcon icon="spinner" spin className="mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
            
            <div className="flex flex-col items-center justify-start">
              <div className="border rounded-md p-2 w-full">
                <h3 className="font-medium mb-2">Student Photo</h3>
                {editingStudent && (
                  <div className="flex flex-col items-center">
                    {!imgError[editingStudent.id] ? (
                      <img
                        src={editingStudent.photoUrl || `https://cdn.gunter.cloud/faces/${editingStudent.lastName}_${editingStudent.firstName}.jpg`}
                        alt={`${editingStudent.firstName} ${editingStudent.lastName}`}
                        className="w-48 h-48 object-cover rounded-md"
                        onError={() => setImgError({...imgError, [editingStudent.id]: true})}
                      />
                    ) : (
                      <div className="w-48 h-48 bg-gray-100 rounded-md flex items-center justify-center">
                        <p className="text-gray-500 text-center">No image available</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Student Dialog */}
      <Dialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen}
      >
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter student information to add to the database.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
              
              <FormField
                control={form.control}
                name="photoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo URL (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Leave blank to use default from cdn.gunter.cloud" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="yearbook"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Yearbook</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="personalization"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Personalization</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="signaturePackage"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Signature Package</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="clearCover"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Clear Cover</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="photoPockets"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Photo Pockets</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={addStudentMutation.isPending}
                >
                  {addStudentMutation.isPending && (
                    <FontAwesomeIcon icon="spinner" spin className="mr-2" />
                  )}
                  Add Student
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}