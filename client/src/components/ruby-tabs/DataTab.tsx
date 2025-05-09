import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Student } from "@shared/schema";

export function DataTab() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Fetch students
  const { 
    data: students, 
    isLoading: studentsLoading,
    isError: studentsError
  } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 10000,
  });
  
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
  
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg text-neutral-800 mb-1">Student Records</h3>
              <p className="text-neutral-600 text-sm">View all student data</p>
            </div>
            
            <Button variant="outline" onClick={() => window.location.hash = "#database"}>
              <FontAwesomeIcon icon="database" className="mr-2" />
              Go to Database
            </Button>
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
                    ? `${filteredStudents.length} student${filteredStudents.length > 1 ? 's' : ''} found`
                    : 'No students found'}
                </TableCaption>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Yearbook</TableHead>
                    <TableHead>Personalization</TableHead>
                    <TableHead>Signature Pkg</TableHead>
                    <TableHead>Options</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents?.length ? (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.studentId}</TableCell>
                        <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
                        <TableCell>{student.orderNumber}</TableCell>
                        <TableCell>${Number(student.balanceDue).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`py-1 px-2 rounded-full text-xs ${
                            student.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                            student.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {student.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell>{student.yearbook ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{student.personalization ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{student.signaturePackage ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <FontAwesomeIcon icon="edit" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <FontAwesomeIcon icon="info-circle" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-neutral-500">
                        No students found. Add students in the Database tab.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}