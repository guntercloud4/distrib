import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tab, Tabs, TabList, TabPanel } from "@/components/ui/simple-tabs";
import { useToast } from "@/hooks/use-toast";
import { socketProvider } from "@/lib/socket";
import { apiRequest } from "@/lib/queryClient";
import { Student, Distribution } from "@shared/schema";
import { StudentInfo } from "./student-info";
import { RecentActivity } from "./recent-activity";

interface CheckerStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function CheckerStation({ operatorName, onLogout }: CheckerStationProps) {
  const [studentId, setStudentId] = useState("");
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showFreeBookDialog, setShowFreeBookDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-focus the input field when the component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Re-focus the input field after operations complete
  useEffect(() => {
    if (!isScanning && !showSuccessDialog && !showCashDialog && !showFreeBookDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isScanning, showSuccessDialog, showCashDialog, showFreeBookDialog]);

  // Listen for WebSocket messages (This will update when a new distribution is made)
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'NEW_DISTRIBUTION') {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socketProvider.subscribe('message', handleWebSocketMessage);
    
    return () => {
      socketProvider.unsubscribe('message', handleWebSocketMessage);
    };
  }, [queryClient]);

  // Fetch student by ID
  const { 
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    error: studentErrorData
  } = useQuery<Student>({
    queryKey: ['/api/students', scannedId],
    enabled: !!scannedId,
    staleTime: 10000,
    retry: false
  });

  // Fetch distribution for the student
  const { 
    data: distribution,
    isLoading: distributionLoading,
    isError: distributionError
  } = useQuery<Distribution>({
    queryKey: ['/api/distributions/student', scannedId],
    enabled: !!scannedId && !!student,
    staleTime: 5000,
    retry: false
  });

  // Verify distribution mutation
  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/distributions/${id}/verify`, { 
        verifiedBy: operatorName 
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Reset state
      setShowSuccessDialog(true);
      setIsScanning(false);
      
      // Show success message
      toast({
        title: "Distribution verified",
        description: `Verification for ${student?.firstName} ${student?.lastName} complete`,
      });
      
      // Log the action via WebSocket
      socketProvider.send({
        type: 'VERIFY_DISTRIBUTION',
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
        title: "Verification failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Free book mutation
  const freeBookMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await apiRequest('POST', `/api/students/${studentId}/free-book`, {
        operatorName
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Reset state
      setShowFreeBookDialog(false);
      setIsScanning(false);
      
      // Show success message
      toast({
        title: "Free book provided",
        description: `Free yearbook assigned to ${student?.firstName} ${student?.lastName}`,
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
    },
    onError: (error: Error) => {
      setIsScanning(false);
      toast({
        title: "Free book assignment failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Cash payment mutation
  const cashPaymentMutation = useMutation({
    mutationFn: async (data: { studentId: string, amount: number }) => {
      const res = await apiRequest('POST', `/api/payments/process`, {
        studentId: data.studentId,
        amountPaid: data.amount,
        paymentMethod: "CASH",
        operatorName
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Reset state
      setShowCashDialog(false);
      setIsScanning(false);
      
      // Show success message
      toast({
        title: "Payment processed",
        description: `Payment recorded for ${student?.firstName} ${student?.lastName}`,
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
    },
    onError: (error: Error) => {
      setIsScanning(false);
      toast({
        title: "Payment processing failed",
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

  // Handle verification
  const handleVerify = () => {
    if (!distribution || !distribution.id) return;
    verifyMutation.mutate(distribution.id);
  };

  // Handle showing free book dialog
  const handleShowFreeBook = () => {
    setShowFreeBookDialog(true);
  };

  // Handle assigning free book
  const handleFreeBook = () => {
    if (!student) return;
    freeBookMutation.mutate(student.studentId);
  };

  // Handle showing cash payment dialog
  const handleShowCashPayment = () => {
    setShowCashDialog(true);
  };

  // Handle processing cash payment
  const handleCashPayment = () => {
    if (!student) return;
    
    // Make sure balanceDue is a number
    const balanceDue = typeof student.balanceDue === 'string' 
      ? parseFloat(student.balanceDue) 
      : (student.balanceDue || 0);
      
    cashPaymentMutation.mutate({
      studentId: student.studentId,
      amount: balanceDue
    });
  };

  // Start a new verification
  const handleNewVerification = () => {
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
                <h2 className="text-2xl font-bold text-neutral-800">Checkers Station</h2>
                <p className="text-neutral-500">Verify yearbook deliveries and process payments</p>
              </div>
              
              <Button variant="outline" onClick={onLogout} className="mt-4 md:mt-0">
                <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
                Logout
              </Button>
            </div>
            
            <Tabs selectedIndex={activeTab} onChange={setActiveTab}>
              <TabList className="mb-6">
                <Tab>Verification</Tab>
                <Tab>Payments</Tab>
              </TabList>
              
              <TabPanel>
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
                                disabled={isScanning || verifyMutation.isPending}
                              />
                            </div>
                          </div>
                          
                          <Button 
                            type="button" 
                            onClick={() => handleScan(studentId)}
                            disabled={!studentId.trim() || isScanning || verifyMutation.isPending}
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
                    
                    <RecentActivity stationType="checker" />
                  </div>
                  
                  <div className="lg:col-span-2">
                    {studentLoading || distributionLoading ? (
                      <div className="flex items-center justify-center h-64 bg-white border border-neutral-200 rounded-lg">
                        <div className="text-center">
                          <FontAwesomeIcon icon="spinner" className="animate-spin text-3xl text-neutral-400 mb-2" />
                          <p className="text-neutral-600">Loading information...</p>
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
                          <Button variant="outline" onClick={handleNewVerification}>
                            Try Again
                          </Button>
                        </div>
                      </div>
                    ) : student ? (
                      <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="p-6">
                          <h3 className="text-lg font-medium text-neutral-800 mb-4">Verification Details</h3>
                          
                          <StudentInfo 
                            student={student} 
                            distributionInfo={distribution}
                            showActions={true}
                            showVerificationStatus={true}
                            actionButton={
                              distribution && !distribution.verified ? (
                                <Button 
                                  onClick={handleVerify} 
                                  disabled={verifyMutation.isPending}
                                  className="mt-4 w-full"
                                >
                                  {verifyMutation.isPending ? (
                                    <>
                                      <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <FontAwesomeIcon icon="check-double" className="mr-2" />
                                      Verify Distribution
                                    </>
                                  )}
                                </Button>
                              ) : distribution && distribution.verified ? (
                                <div className="mt-4 flex flex-col gap-2">
                                  <div className="flex items-center text-green-600 bg-green-50 p-3 rounded-md">
                                    <FontAwesomeIcon icon="check-circle" className="mr-2" />
                                    <span>Already verified by {distribution.verifiedBy}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                      variant="outline" 
                                      onClick={handleShowFreeBook}
                                      disabled={freeBookMutation.isPending}
                                    >
                                      <FontAwesomeIcon icon="gift" className="mr-2" />
                                      Free Book
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      onClick={handleShowCashPayment}
                                      disabled={cashPaymentMutation.isPending || student.balanceDue <= 0}
                                    >
                                      <FontAwesomeIcon icon="cash-register" className="mr-2" />
                                      Cash Payment
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-4 p-3 bg-yellow-50 text-yellow-700 rounded-md flex items-center">
                                  <FontAwesomeIcon icon="exclamation-triangle" className="mr-2" />
                                  <span>No distribution record found for this student</span>
                                </div>
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 bg-white border border-neutral-200 rounded-lg">
                        <div className="text-center p-6">
                          <FontAwesomeIcon icon="file-alt" className="text-5xl text-neutral-300 mb-3" />
                          <h3 className="text-lg font-medium text-neutral-800 mb-1">No Student Selected</h3>
                          <p className="text-neutral-600">
                            Scan a student ID barcode or enter an ID number to verify distribution.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabPanel>
              
              <TabPanel>
                <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-neutral-800 mb-4">Payment Options</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-neutral-200 rounded-lg p-4">
                      <div className="flex flex-col items-center p-4">
                        <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-3">
                          <FontAwesomeIcon icon="cash-register" />
                        </div>
                        <h4 className="text-md font-medium mb-2">Cash Payment</h4>
                        <p className="text-center text-neutral-600 text-sm mb-4">
                          Process cash payments for students with outstanding balances.
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (student) {
                              handleShowCashPayment();
                            } else {
                              toast({
                                title: "No student selected",
                                description: "Please scan a student ID first",
                                variant: "destructive"
                              });
                            }
                          }}
                          disabled={!student || cashPaymentMutation.isPending}
                        >
                          <FontAwesomeIcon icon="dollar-sign" className="mr-2" />
                          Process Cash Payment
                        </Button>
                      </div>
                    </div>
                    
                    <div className="border border-neutral-200 rounded-lg p-4">
                      <div className="flex flex-col items-center p-4">
                        <div className="h-12 w-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                          <FontAwesomeIcon icon="gift" />
                        </div>
                        <h4 className="text-md font-medium mb-2">Free Book</h4>
                        <p className="text-center text-neutral-600 text-sm mb-4">
                          Assign a free yearbook to a student based on eligibility.
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (student) {
                              handleShowFreeBook();
                            } else {
                              toast({
                                title: "No student selected",
                                description: "Please scan a student ID first",
                                variant: "destructive"
                              });
                            }
                          }}
                          disabled={!student || freeBookMutation.isPending}
                        >
                          <FontAwesomeIcon icon="gift" className="mr-2" />
                          Assign Free Book
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribution Verified</DialogTitle>
          </DialogHeader>
          
          <div className="py-6">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <FontAwesomeIcon icon="check-double" className="text-2xl text-green-600" />
              </div>
            </div>
            
            <div className="text-center mt-4">
              <h3 className="text-lg font-medium">
                Distribution verified for {student?.firstName} {student?.lastName}
              </h3>
              <p className="text-neutral-600 mt-2">
                Student ID: {student?.studentId}
              </p>
              <p className="text-neutral-600">
                Verified by: {operatorName}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleNewVerification}>
              <FontAwesomeIcon icon="barcode" className="mr-2" />
              Scan Next Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free Book Dialog */}
      <Dialog open={showFreeBookDialog} onOpenChange={setShowFreeBookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Free Book</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="mb-4">
              Are you sure you want to assign a free yearbook to:
            </p>
            
            <div className="bg-neutral-50 p-3 rounded-md mb-4">
              <p className="font-medium">{student?.firstName} {student?.lastName}</p>
              <p className="text-sm text-neutral-600">Student ID: {student?.studentId}</p>
              {student?.balanceDue > 0 && (
                <p className="text-sm text-red-600 mt-1">
                  This student has a balance due of ${student?.balanceDue.toFixed(2)}
                </p>
              )}
            </div>
            
            <p className="text-sm text-neutral-600">
              This will mark the student as eligible for a free yearbook and clear any balance due.
            </p>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFreeBookDialog(false)}
              disabled={freeBookMutation.isPending}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFreeBook}
              disabled={freeBookMutation.isPending}
            >
              {freeBookMutation.isPending ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="gift" className="mr-2" />
                  Assign Free Book
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Cash Payment</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="mb-4">
              Process a cash payment for:
            </p>
            
            <div className="bg-neutral-50 p-3 rounded-md mb-4">
              <p className="font-medium">{student?.firstName} {student?.lastName}</p>
              <p className="text-sm text-neutral-600">Student ID: {student?.studentId}</p>
              <p className="text-sm font-medium text-neutral-800 mt-1">
                Balance Due: ${student?.balanceDue.toFixed(2)}
              </p>
            </div>
            
            <p className="text-sm text-neutral-600 mb-2">
              This will record a cash payment for the full balance amount and update the student's record.
            </p>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCashDialog(false)}
              disabled={cashPaymentMutation.isPending}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCashPayment}
              disabled={cashPaymentMutation.isPending || (student?.balanceDue || 0) <= 0}
            >
              {cashPaymentMutation.isPending ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="cash-register" className="mr-2" />
                  Process Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}