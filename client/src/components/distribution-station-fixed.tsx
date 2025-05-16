import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { socketProvider } from "@/lib/socket";
import { apiRequest } from "@/lib/queryClient";
import { Student, InsertDistribution } from "@shared/schema";
import { StudentInfo } from "./student-info";
import { RecentActivity } from "./recent-activity";

interface DistributionStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function DistributionStation({ operatorName, onLogout }: DistributionStationProps) {
  const [studentId, setStudentId] = useState("");
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-focus the input field when the component mounts or refreshes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Re-focus the input field after operations are complete
  useEffect(() => {
    if (!isScanning && !showSuccessDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isScanning, showSuccessDialog]);

  // Fetch student by ID
  const { 
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    error: studentErrorData
  } = useQuery<Student>({
    queryKey: ['/api/students', scannedId],
    enabled: !!scannedId,
    staleTime: 10000, // 10 seconds
    retry: false
  });

  // Distribute mutation
  const distributeMutation = useMutation({
    mutationFn: async (distribution: InsertDistribution) => {
      const res = await apiRequest('POST', '/api/distributions', distribution);
      return res.json();
    },
    onSuccess: (data) => {
      // Reset state
      setShowSuccessDialog(true);
      setIsScanning(false);
      
      // Show success message
      toast({
        title: "Distribution recorded",
        description: `Yearbook distributed to ${student?.firstName} ${student?.lastName}`,
      });
      
      // Log the action via WebSocket
      socketProvider.send({
        type: 'NEW_DISTRIBUTION',
        data: {
          ...data,
          studentId: student?.studentId
        }
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
    },
    onError: (error: Error) => {
      setIsScanning(false);
      toast({
        title: "Distribution failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId.trim()) {
      handleScan(studentId);
    }
  };

  // Handle scanner input
  const handleScan = (value: string) => {
    if (!value.trim()) return;
    
    setIsScanning(true);
    setScannedId(value);
    setStudentId("");
  };

  // Handle scanner enter key press
  const handleScannerEnter = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      callback();
    }
  };

  // Handle distribution
  const handleDistribute = () => {
    if (!student) return;
    
    distributeMutation.mutate({
      studentId: student.studentId, // Use studentId instead of id
      operatorName: operatorName
    });
  };

  // Start a new distribution
  const handleNewDistribution = () => {
    setShowSuccessDialog(false);
    setScannedId(null);
    setStudentId("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 container mx-auto py-6 px-4">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-neutral-800">Distribution Station</h2>
                <p className="text-neutral-500">Scan student IDs to distribute yearbooks</p>
              </div>
              
              <Button variant="outline" onClick={onLogout} className="mt-4 md:mt-0">
                <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
                Logout
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="student-id" className="block text-sm font-medium text-neutral-700 mb-1">
                          Scan Student ID
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                            <FontAwesomeIcon icon="barcode" />
                          </span>
                          <Input
                            id="student-id"
                            ref={inputRef}
                            className="pl-10"
                            placeholder="Scan or type ID..."
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            onKeyDown={(e) => handleScannerEnter(e, () => handleScan(studentId))}
                            disabled={isScanning || distributeMutation.isPending}
                          />
                        </div>
                      </div>
                      
                      <Button 
                        type="button" 
                        onClick={() => handleScan(studentId)}
                        disabled={!studentId.trim() || isScanning || distributeMutation.isPending}
                        className="w-full"
                      >
                        {isScanning ? (
                          <>
                            <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon="search" className="mr-2" />
                            Find Student
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
                
                <RecentActivity stationType="distribution" />
              </div>
              
              <div className="lg:col-span-2">
                {studentLoading ? (
                  <div className="flex items-center justify-center h-64 bg-white border border-neutral-200 rounded-lg">
                    <div className="text-center">
                      <FontAwesomeIcon icon="spinner" className="animate-spin text-3xl text-neutral-400 mb-2" />
                      <p className="text-neutral-600">Loading student information...</p>
                    </div>
                  </div>
                ) : studentError ? (
                  <div className="flex items-center justify-center h-64 bg-white border border-neutral-200 rounded-lg">
                    <div className="text-center p-6">
                      <FontAwesomeIcon icon="exclamation-circle" className="text-3xl text-red-500 mb-2" />
                      <h3 className="text-lg font-medium text-neutral-800 mb-1">Student Not Found</h3>
                      <p className="text-neutral-600 mb-4">
                        We couldn't find a student with ID "{scannedId}". Please check the ID and try again.
                      </p>
                      <Button variant="outline" onClick={handleNewDistribution}>
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : student ? (
                  <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="p-6">
                      <h3 className="text-lg font-medium text-neutral-800 mb-4">Student Information</h3>
                      
                      <StudentInfo 
                        student={student} 
                        showActions={true}
                        actionButton={
                          <Button 
                            onClick={handleDistribute} 
                            disabled={distributeMutation.isPending}
                            className="mt-4 w-full"
                          >
                            {distributeMutation.isPending ? (
                              <>
                                <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <FontAwesomeIcon icon="book" className="mr-2" />
                                Distribute Yearbook
                              </>
                            )}
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-white border border-neutral-200 rounded-lg">
                    <div className="text-center p-6">
                      <FontAwesomeIcon icon="barcode" className="text-5xl text-neutral-300 mb-3" />
                      <h3 className="text-lg font-medium text-neutral-800 mb-1">No Student Selected</h3>
                      <p className="text-neutral-600">
                        Scan a student ID barcode or enter an ID number to begin distribution.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yearbook Distributed</DialogTitle>
          </DialogHeader>
          
          <div className="py-6">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <FontAwesomeIcon icon="check" className="text-2xl text-green-600" />
              </div>
            </div>
            
            <div className="text-center mt-4">
              <h3 className="text-lg font-medium">
                Yearbook distributed to {student?.firstName} {student?.lastName}
              </h3>
              <p className="text-neutral-600 mt-2">
                Student ID: {student?.studentId}
              </p>
              <p className="text-neutral-600">
                Distributed by: {operatorName}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleNewDistribution}>
              <FontAwesomeIcon icon="barcode" className="mr-2" />
              Scan Next Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}