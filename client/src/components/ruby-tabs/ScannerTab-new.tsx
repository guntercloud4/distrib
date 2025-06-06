import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student } from "@shared/schema";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { handleScannerEnter } from "@/lib/utils";
import { socketProvider } from "@/lib/socket";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface ScannerTabProps {
  operatorName: string;
}

export function ScannerTab({ operatorName }: ScannerTabProps) {
  const [studentId, setStudentId] = useState("");
  const [scannedStudentId, setScannedStudentId] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  // Auto-focus the input field when the component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Re-focus the input field when needed
  useEffect(() => {
    // Set a timeout to allow any dialogs to close first
    const timeoutId = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [scannedStudentId, showSuccessDialog]);

  // Fetch student by ID
  const { 
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    error: studentErrorData,
    refetch: refetchStudent
  } = useQuery<Student>({
    queryKey: ['/api/students', scannedStudentId],
    queryFn: async () => {
      if (!scannedStudentId) return null;
      const res = await fetch(`/api/students/${scannedStudentId}`);
      if (!res.ok) {
        throw new Error("Student not found");
      }
      return res.json();
    },
    enabled: !!scannedStudentId,
    staleTime: 10000, // 10 seconds
    retry: false
  });

  // Distribution mutation
  const distributeMutation = useMutation({
    mutationFn: async ({ studentId, operatorName }: { studentId: string, operatorName: string }) => {
      const res = await apiRequest('POST', '/api/distributions', { 
        studentId,
        operatorName 
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setShowSuccessDialog(true);
      
      // Only the server should broadcast WebSocket events now
      // We'll let the server handle the logging and broadcasting
      // This fixes the multiple logging issue
    },
    onError: (error: Error) => {
      toast({
        title: "Distribution Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle scan
  const handleScan = (value: string) => {
    setScannedStudentId(value);
  };

  // Handle scan form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId) {
      handleScan(studentId);
    }
  };

  // Handle distribute
  const handleDistribute = () => {
    if (!scannedStudentId) return;
    
    distributeMutation.mutate({
      studentId: scannedStudentId,
      operatorName
    });
  };

  // Handle new scan after distribution
  const handleNewScan = () => {
    setStudentId("");
    setScannedStudentId(null);
    setShowSuccessDialog(false);
    
    // Re-focus the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Barcode Scanner</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
              <div className="text-center mb-6">
                <div className="h-16 w-16 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 mx-auto mb-4">
                  <FontAwesomeIcon icon="qrcode" size="2x" />
                </div>
                <h4 className="text-xl font-medium mb-2">Scan Student ID</h4>
                <p className="text-neutral-600">
                  Scan or enter a student ID to distribute or find information about a student.
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="relative mb-4">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    onKeyDown={(e) => handleScannerEnter(e, () => handleScan(studentId))}
                    placeholder="Enter or scan student ID"
                    className="w-full text-center py-6 text-lg"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <FontAwesomeIcon icon="search" />
                  </Button>
                </div>
                <Button type="submit" className="w-full py-6">
                  <FontAwesomeIcon icon="search" className="mr-2" />
                  Find Student
                </Button>
              </form>
              
              {/* Loading state */}
              {studentLoading && (
                <div className="text-center p-4">
                  <FontAwesomeIcon icon="sync" className="animate-spin text-primary mb-2" size="2x" />
                  <p>Searching for student...</p>
                </div>
              )}
              
              {/* Error state */}
              {studentError && (
                <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                  <FontAwesomeIcon icon="exclamation-triangle" className="text-red-500 mb-2" size="2x" />
                  <p className="text-red-600">{(studentErrorData as Error).message || "Student not found"}. Please try again.</p>
                </div>
              )}
              
              {/* Student found */}
              {student && !showSuccessDialog && (
                <div className="border border-neutral-200 rounded-lg p-4 mb-4">
                  <h5 className="font-medium text-lg mb-2">Student Information</h5>
                  <div className="grid grid-cols-2 gap-y-2 mb-4">
                    <div className="text-neutral-600">Student ID:</div>
                    <div className="font-medium">{student.studentId}</div>
                    <div className="text-neutral-600">Name:</div>
                    <div className="font-medium">{student.firstName} {student.lastName}</div>
                    <div className="text-neutral-600">Order Type:</div>
                    <div className="font-medium">{student.orderType || 'N/A'}</div>
                    <div className="text-neutral-600">Payment Status:</div>
                    <div className="font-medium">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                        ${student.paymentStatus.toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' : ''}
                        ${student.paymentStatus.toLowerCase() === 'unpaid' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${student.paymentStatus.toLowerCase() === 'free' ? 'bg-blue-100 text-blue-800' : ''}
                      `}>
                        {student.paymentStatus}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      onClick={handleDistribute}
                      disabled={distributeMutation.isPending}
                      className="bg-primary hover:bg-primary-dark"
                    >
                      {distributeMutation.isPending ? (
                        <>
                          <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon="check" className="mr-2" />
                          Distribute Yearbook
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl text-green-600">
              <FontAwesomeIcon icon="check-circle" className="mr-2" />
              Distribution Successful
            </DialogTitle>
            <DialogDescription className="text-center">
              Yearbook has been distributed to the student
            </DialogDescription>
          </DialogHeader>
          
          {student && (
            <div className="py-4">
              <div className="bg-neutral-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="text-neutral-600">Student ID:</div>
                  <div className="font-medium">{student.studentId}</div>
                  <div className="text-neutral-600">Student:</div>
                  <div className="font-medium">{student.firstName} {student.lastName}</div>
                  <div className="text-neutral-600">Order Type:</div>
                  <div className="font-medium">{student.orderType || 'N/A'}</div>
                  <div className="text-neutral-600">Distributed By:</div>
                  <div className="font-medium">{operatorName}</div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={handleNewScan} 
              className="w-full"
              autoFocus
            >
              <FontAwesomeIcon icon="qrcode" className="mr-2" />
              Scan Next Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}