import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface AdminTabProps {
  operatorName: string;
}

export function AdminTab({ operatorName }: AdminTabProps) {
  const [showFreeBookDialog, setShowFreeBookDialog] = useState(false);
  const [freeBookStudentId, setFreeBookStudentId] = useState("");
  
  const { toast } = useToast();

  // Fetch all students
  const { data: students } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 30000 // 30 seconds
  });

  // Free book mutation
  const freeBookMutation = useMutation({
    mutationFn: async ({ studentId, operatorName }: { studentId: string, operatorName: string }) => {
      const res = await apiRequest('POST', `/api/students/${studentId}/free-book`, { operatorName });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Free Book Issued",
        description: `Successfully issued a free book to ${data.student.firstName} ${data.student.lastName}.`,
      });
      
      // Close dialog and reset form
      setShowFreeBookDialog(false);
      setFreeBookStudentId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Free Book Issue Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle database backup
  const handleDatabaseBackup = () => {
    toast({
      title: "Database Backup",
      description: "Database backup initiated. A file will download shortly.",
    });
    
    // Create a CSV or JSON of all students
    if (students && students.length > 0) {
      // Format the data
      const headers = Object.keys(students[0]).join(',');
      const rows = students.map(student => {
        return Object.values(student).map(value => {
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
      a.download = `yearbook_students_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } else {
      toast({
        title: "No Data",
        description: "There are no students to backup.",
        variant: "destructive"
      });
    }
  };

  // Issue free book
  const issueFreeBook = () => {
    if (!freeBookStudentId) {
      toast({
        title: "Student Name Required",
        description: "Please enter a student name to issue a free book.",
        variant: "destructive"
      });
      return;
    }
    
    // Find student by name
    const student = students?.find(s => 
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(freeBookStudentId.toLowerCase()) ||
      `${s.lastName} ${s.firstName}`.toLowerCase().includes(freeBookStudentId.toLowerCase())
    );
    
    if (!student) {
      toast({
        title: "Student Not Found",
        description: `No student found with name: ${freeBookStudentId}`,
        variant: "destructive"
      });
      return;
    }
    
    freeBookMutation.mutate({
      studentId: student.studentId,
      operatorName
    });
  };

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Administrative Actions</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 mr-3">
                  <FontAwesomeIcon icon="gift" />
                </div>
                <h4 className="text-lg font-medium">Free Book Management</h4>
              </div>
              <p className="text-neutral-600 mb-4">
                Issue a complimentary yearbook to a student without requiring payment.
              </p>
              <Dialog open={showFreeBookDialog} onOpenChange={setShowFreeBookDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary">
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
                        value={freeBookStudentId}
                        onChange={(e) => setFreeBookStudentId(e.target.value)}
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
                            <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
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
            
            <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-green-100 text-green-600 mr-3">
                  <FontAwesomeIcon icon="database" />
                </div>
                <h4 className="text-lg font-medium">Database Management</h4>
              </div>
              <p className="text-neutral-600 mb-4">
                Create a backup of the current database or perform database maintenance.
              </p>
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleDatabaseBackup}>
                <FontAwesomeIcon icon="download" className="mr-2" />
                Download Database Backup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">System Information</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Database Status</span>
              <span className="inline-flex items-center text-xs font-medium text-green-800">
                <span className="h-2 w-2 rounded-full bg-green-400 mr-1.5"></span>
                Online
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Students in Database</span>
              <span className="text-sm font-medium text-neutral-800">{students?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">System Uptime</span>
              <span className="text-sm font-medium text-neutral-800">Active</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}