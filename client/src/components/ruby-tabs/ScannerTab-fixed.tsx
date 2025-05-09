import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { socketProvider } from "@/lib/socket";
import { apiRequest } from "@/lib/queryClient";
import { Student, InsertDistribution } from "@shared/schema";
import { StudentInfo } from "../student-info";
import { useIsMobile } from "@/hooks/use-mobile";

interface ScannerTabProps {
  operatorName: string;
}

export function ScannerTab({ operatorName }: ScannerTabProps) {
  const [studentId, setStudentId] = useState("");
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
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
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
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
    mutationFn: async (studentId: number) => {
      const res = await apiRequest('POST', '/api/distributions', {
        studentId: studentId,
        distributedBy: operatorName,
        timestamp: new Date(),
        verified: false
      });
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
    
    distributeMutation.mutate(student.id);
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
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-neutral-800 mb-1">Scanner Station</h3>
            <p className="text-neutral-600 text-sm">Scan student IDs to record book distributions</p>
          </div>
          
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="scanner-input" className="block text-sm font-medium text-neutral-700 mb-1">
                  Enter or scan student ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <FontAwesomeIcon icon="barcode" />
                  </span>
                  <Input
                    id="scanner-input"
                    ref={inputRef}
                    className="pl-10 text-lg py-6"
                    placeholder="Scan or type ID..."
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    onKeyDown={(e) => handleScannerEnter(e, () => handleScan(studentId))}
                    disabled={isScanning || distributeMutation.isPending}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={!studentId.trim() || isScanning || distributeMutation.isPending}
              >
                {isScanning ? (
                  <>
                    <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="search" className="mr-2" />
                    Lookup Student
                  </>
                )}
              </Button>
            </div>
          </form>
          
          {/* Student Information Display */}
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
            <div className="mt-6">
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
          ) : scannedId ? (
            <div className="flex items-center justify-center h-64 bg-white border border-neutral-200 rounded-lg">
              <div className="text-center">
                <FontAwesomeIcon icon="spinner" className="animate-spin text-3xl text-neutral-400 mb-2" />
                <p className="text-neutral-600">Searching...</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

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