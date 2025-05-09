import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Student } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ScannerTabProps {
  operatorName: string;
}

export function ScannerTab({ operatorName }: ScannerTabProps) {
  const [studentId, setStudentId] = useState("");
  const [scannedStudentId, setScannedStudentId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  
  // Create a ref for the input element
  const scannerInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-focus the scanner input when component mounts
  useEffect(() => {
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, []);

  // Fetch student by ID
  const { 
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    error: studentErrorData,
    refetch: refetchStudent
  } = useQuery<Student>({
    queryKey: ['/api/students', scannedStudentId],
    enabled: !!scannedStudentId && !scanning,
    retry: false,
    staleTime: 0
  });

  // Handle scanner enter key press
  const handleScannerEnter = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      callback();
    }
  };

  // Handle scan
  const handleScan = () => {
    if (!studentId.trim()) {
      toast({
        title: "No Student ID",
        description: "Please enter or scan a student ID.",
        variant: "destructive"
      });
      return;
    }
    
    // Start scanning animation
    setScanning(true);
    
    // Store the current studentId to use in the query
    const currentStudentId = studentId;
    
    // Reset the input field for next scan immediately to prevent UI glitches
    setStudentId("");
    
    // Set the scanned ID right away, but keep the scanning state for a moment
    // to prevent the white screen issue
    setScannedStudentId(currentStudentId);
    
    // Keep the loading state active briefly for visual feedback
    setTimeout(() => {
      setScanning(false);
    }, 500);
  };

  // Distribution mutation
  const distributionMutation = useMutation({
    mutationFn: async (data: { studentId: string, operatorName: string }) => {
      const res = await apiRequest('POST', '/api/distributions', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Distribution Recorded",
        description: "Successfully recorded book distribution.",
      });
      
      // Reset state
      setScannedStudentId(null);
      
      // Refocus the input
      if (scannerInputRef.current) {
        scannerInputRef.current.focus();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Distribution Failed",
        description: error.message,
        variant: "destructive"
      });
      
      // Refocus the input
      if (scannerInputRef.current) {
        scannerInputRef.current.focus();
      }
    }
  });

  // Handle distribute
  const handleDistribute = () => {
    if (!student) return;
    
    distributionMutation.mutate({
      studentId: student.studentId,
      operatorName
    });
  };

  // Handle clear
  const handleClear = () => {
    setScannedStudentId(null);
    setStudentId("");
    
    // Refocus the input
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  };

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Scanner Station</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-neutral-800 mb-4">Scan Student ID</h4>
                
                <div className="mb-4">
                  <label htmlFor="student-id" className="block text-sm font-medium text-neutral-700 mb-1">
                    Enter or scan student ID
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                      <FontAwesomeIcon icon="qrcode" />
                    </span>
                    <Input
                      id="student-id"
                      ref={scannerInputRef}
                      className="pl-10"
                      placeholder="Student ID"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      onKeyDown={(e) => handleScannerEnter(e, handleScan)}
                      disabled={scanning || distributionMutation.isPending}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleScan}
                  disabled={scanning || distributionMutation.isPending || !studentId}
                  className="w-full mb-2"
                >
                  {scanning ? (
                    <>
                      <FontAwesomeIcon icon="spinner" className="mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon="search" className="mr-2" />
                      Lookup Student
                    </>
                  )}
                </Button>
                
                <div className="text-xs text-neutral-500 text-center">
                  Scan barcode or manually enter student ID
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              {studentLoading || scanning ? (
                <div className="flex flex-col items-center justify-center h-64 bg-neutral-50 rounded-lg">
                  <FontAwesomeIcon icon="spinner" className="text-3xl text-neutral-400 animate-spin mb-4" />
                  <div className="text-neutral-500">Searching for student...</div>
                </div>
              ) : studentError ? (
                <div className="flex flex-col items-center justify-center h-64 bg-red-50 rounded-lg">
                  <FontAwesomeIcon icon="exclamation-circle" className="text-3xl text-red-500 mb-4" />
                  <div className="text-red-700 font-medium mb-2">Student Not Found</div>
                  <div className="text-red-500 text-sm text-center mb-4">
                    {(studentErrorData as Error)?.message || "No student with this ID was found in the system."}
                  </div>
                  <Button variant="outline" onClick={handleClear}>
                    <FontAwesomeIcon icon="times" className="mr-2" />
                    Clear
                  </Button>
                </div>
              ) : student ? (
                <div className="bg-neutral-50 p-6 rounded-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex">
                      <div className="mr-4">
                        <div className="w-24 h-24 bg-neutral-100 rounded overflow-hidden flex items-center justify-center">
                          {(() => {
                            // Create image URL from student data only if both names exist
                            const firstName = student.firstName || '';
                            const lastName = student.lastName || '';
                            const imageUrl = `https://cdn.gunter.cloud/faces/${lastName.toLowerCase()}_${firstName.toLowerCase()}.jpg`;
                            
                            return (
                              <img 
                                src={imageUrl}
                                alt={`${firstName} ${lastName}`}
                                className="object-cover w-full h-full"
                                onError={(e) => {
                                  // If image fails to load, show placeholder with icon
                                  e.currentTarget.src = '';
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-neutral-200');
                                  // Add placeholder icon
                                  const icon = document.createElement('span');
                                  icon.innerHTML = '<i class="fas fa-image fa-2x text-neutral-400"></i>';
                                  icon.className = 'text-center';
                                  e.currentTarget.parentElement?.appendChild(icon);
                                }}
                              />
                            )
                          })()}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-medium text-neutral-800">
                          {student.lastName}, {student.firstName}
                        </h3>
                        <div className="text-sm text-neutral-500 mt-1">ID: {student.studentId}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="mr-2">
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
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="text-sm font-medium text-neutral-700">Order Details</div>
                      <div className="text-sm text-neutral-600">
                        Type: {student.orderType}
                      </div>
                      <div className="text-sm text-neutral-600">
                        Order #: {student.orderNumber}
                      </div>
                      <div className="text-sm text-neutral-600">
                        Balance: ${parseFloat(student.balanceDue.toString()).toFixed(2)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-neutral-700">Package Options</div>
                      <div className="flex flex-col">
                        {student.yearbook && (
                          <div className="text-sm text-neutral-600">
                            <FontAwesomeIcon icon="check" className="text-green-500 mr-1" /> Yearbook
                          </div>
                        )}
                        {student.personalization && (
                          <div className="text-sm text-neutral-600">
                            <FontAwesomeIcon icon="check" className="text-green-500 mr-1" /> Personalization
                          </div>
                        )}
                        {student.signaturePackage && (
                          <div className="text-sm text-neutral-600">
                            <FontAwesomeIcon icon="check" className="text-green-500 mr-1" /> Signature Package
                          </div>
                        )}
                        {student.clearCover && (
                          <div className="text-sm text-neutral-600">
                            <FontAwesomeIcon icon="check" className="text-green-500 mr-1" /> Clear Cover
                          </div>
                        )}
                        {student.photoPockets && (
                          <div className="text-sm text-neutral-600">
                            <FontAwesomeIcon icon="check" className="text-green-500 mr-1" /> Photo Pockets
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={handleClear}
                      disabled={distributionMutation.isPending}
                    >
                      <FontAwesomeIcon icon="times" className="mr-2" />
                      Cancel
                    </Button>
                    
                    <Button
                      onClick={handleDistribute}
                      disabled={
                        distributionMutation.isPending || 
                        (student.paymentStatus === "Unpaid" && 
                        parseFloat(student.balanceDue.toString()) > 0)
                      }
                      className={
                        student.paymentStatus === "Unpaid" && 
                        parseFloat(student.balanceDue.toString()) > 0
                          ? "bg-red-500 hover:bg-red-600"
                          : ""
                      }
                    >
                      {distributionMutation.isPending ? (
                        <>
                          <FontAwesomeIcon icon="spinner" className="mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : student.paymentStatus === "Unpaid" && 
                         parseFloat(student.balanceDue.toString()) > 0 ? (
                        <>
                          <FontAwesomeIcon icon="exclamation-triangle" className="mr-2" />
                          Payment Required
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon="book" className="mr-2" />
                          Distribute Yearbook
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-neutral-50 rounded-lg">
                  <FontAwesomeIcon icon="barcode" className="text-3xl text-neutral-300 mb-4" />
                  <div className="text-neutral-500 text-center">
                    Scan a student ID to begin
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}