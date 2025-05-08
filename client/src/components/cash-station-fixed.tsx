import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student, PaymentProcess } from "@shared/schema";
import { socketProvider } from "@/lib/socket";
import { formatCurrency, handleScannerEnter, calculateTotalFromBills } from "@/lib/utils";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PaymentForm } from "./payment-form-fixed";
import { PaymentResult } from "./payment-result-fixed";

interface CashStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function CashStation({ operatorName, onLogout }: CashStationProps) {
  // Flow state management
  enum FlowStep {
    SCAN_ID,
    ENTER_NAME,
    PAYMENT,
    RESULT
  }
  
  const [currentStep, setCurrentStep] = useState<FlowStep>(FlowStep.SCAN_ID);
  const [studentId, setStudentId] = useState("");
  const [scannedId, setScannedId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [payment, setPayment] = useState<any>(null);
  
  const studentIdInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { formattedLogs } = useWsLogs();
  
  // Focus student ID input on initial load
  useEffect(() => {
    if (currentStep === FlowStep.SCAN_ID && studentIdInputRef.current) {
      studentIdInputRef.current.focus();
    }
  }, [currentStep]);
  
  // Fetch student data by ID
  const { 
    data: student, 
    isLoading: isLoadingStudent,
    isError: isStudentError,
    error: studentError,
    refetch: refetchStudent
  } = useQuery<Student | undefined>({
    queryKey: ['/api/students', scannedId],
    queryFn: async () => {
      if (!scannedId) return undefined;
      
      try {
        const res = await fetch(`/api/students/${scannedId}`);
        if (!res.ok) {
          if (res.status === 404) {
            // This is a new student, need to enter their name manually
            setCurrentStep(FlowStep.ENTER_NAME);
            return undefined;
          }
          throw new Error(`Failed to fetch student: ${res.status}`);
        }
        
        const studentData = await res.json();
        
        // Set name for existing student and move to payment step
        setStudentName(`${studentData.firstName} ${studentData.lastName}`);
        setCurrentStep(FlowStep.PAYMENT);
        
        return studentData;
      } catch (error) {
        console.error("Error fetching student:", error);
        return undefined;
      }
    },
    enabled: !!scannedId,
    staleTime: 1000, // 1 second
    retry: false
  });
  
  // Process payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentProcess) => {
      const res = await apiRequest('POST', '/api/payments/process', paymentData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Processed",
        description: `Successfully processed payment for ${data.studentName}`,
      });
      
      // Update the local state
      setPayment(data);
      setCurrentStep(FlowStep.RESULT);
      
      // Log the action via WebSocket
      socketProvider.send({
        type: 'NEW_PAYMENT',
        data
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle student ID scan/entry
  const handleStudentIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentId.trim()) {
      toast({
        title: "Student ID Required",
        description: "Please enter or scan a student ID",
        variant: "destructive"
      });
      return;
    }
    
    setScannedId(studentId);
  };
  
  // Handle barcode scanner input (auto-submits on scanner Enter)
  const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleScannerEnter(e, handleStudentIdSubmit);
  };
  
  // Handle name submission for new student
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentName.trim()) {
      toast({
        title: "Student Name Required",
        description: "Please enter the student's name",
        variant: "destructive"
      });
      return;
    }
    
    setCurrentStep(FlowStep.PAYMENT);
  };
  
  // Handle payment submission
  const handlePaymentSubmit = (bills: Record<string, number>) => {
    const totalReceived = calculateTotalFromBills(bills);
    
    const amountDue = student?.balanceDue 
      ? parseFloat(student.balanceDue.toString()) 
      : 0;
    
    if (totalReceived < amountDue) {
      toast({
        title: "Insufficient Payment",
        description: `Payment of ${formatCurrency(totalReceived)} is less than amount due: ${formatCurrency(amountDue)}`,
        variant: "destructive"
      });
      return;
    }
    
    const paymentData: PaymentProcess = {
      studentId: scannedId,
      studentName,
      amountPaid: totalReceived,
      amountDue,
      billsProvided: bills,
      operatorName
    };
    
    paymentMutation.mutate(paymentData);
  };
  
  // Start a new payment process
  const handleNewPayment = () => {
    setStudentId("");
    setScannedId("");
    setStudentName("");
    setPayment(null);
    setCurrentStep(FlowStep.SCAN_ID);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">Cash Station</h2>
        <div className="flex items-center">
          <div className="text-sm text-neutral-600 mr-4">
            <span className="font-medium">Operator:</span> {operatorName}
          </div>
          <Button
            variant="outline"
            onClick={onLogout}
            className="text-neutral-600 hover:text-neutral-800"
          >
            <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
            Exit Station
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Process Payment</h3>
              
              {currentStep === FlowStep.SCAN_ID && (
                <div className="bg-white p-6 rounded-lg border border-neutral-200">
                  <h4 className="text-md font-medium text-neutral-700 mb-4">Scan or Enter Student ID</h4>
                  <form onSubmit={handleStudentIdSubmit} className="mb-6">
                    <div className="flex space-x-2">
                      <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                          <FontAwesomeIcon icon="id-card" className="text-sm" />
                        </div>
                        <Input
                          ref={studentIdInputRef}
                          type="text"
                          placeholder="Scan or type student ID..."
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          onKeyDown={handleScanInput}
                          className="pl-10"
                          autoComplete="off"
                          disabled={isLoadingStudent}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        disabled={!studentId || isLoadingStudent}
                      >
                        {isLoadingStudent ? (
                          <>
                            <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon="arrow-right" className="mr-2" />
                            Next
                          </>
                        )}
                      </Button>
                    </div>
                    {isStudentError && (
                      <p className="text-sm text-red-600 mt-2">
                        <FontAwesomeIcon icon="exclamation-triangle" className="mr-1" />
                        {studentError instanceof Error ? studentError.message : 'Error finding student'}
                      </p>
                    )}
                  </form>
                  <div className="flex items-start space-x-4 bg-blue-50 p-4 rounded-lg">
                    <div className="flex-shrink-0">
                      <FontAwesomeIcon icon="info-circle" className="text-blue-500 text-xl mt-0.5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-blue-800 mb-1">How to Process a Payment</h5>
                      <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Scan or enter the student's ID number</li>
                        <li>Enter the student's name if not already in system</li>
                        <li>Enter the bill amounts received from the student</li>
                        <li>Verify the change due and give exact bills back</li>
                        <li>Direct student to the Distribution Station</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
              
              {currentStep === FlowStep.ENTER_NAME && (
                <div className="bg-white p-6 rounded-lg border border-neutral-200">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-md font-medium text-neutral-700">Enter Student Name</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleNewPayment}
                    >
                      <FontAwesomeIcon icon="arrow-left" className="mr-2" />
                      Back
                    </Button>
                  </div>
                  
                  <form onSubmit={handleNameSubmit} className="mb-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Student ID
                        </label>
                        <Input
                          type="text"
                          value={scannedId}
                          disabled
                          className="bg-neutral-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Student Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="text"
                          placeholder="Enter full name..."
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          className="w-full"
                          autoFocus
                        />
                        <p className="text-xs text-neutral-500 mt-1">
                          This student is not in the system. Please enter their full name.
                        </p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Button 
                        type="submit"
                        className="w-full"
                        disabled={!studentName.trim()}
                      >
                        <FontAwesomeIcon icon="arrow-right" className="mr-2" />
                        Continue to Payment
                      </Button>
                    </div>
                  </form>
                </div>
              )}
              
              {currentStep === FlowStep.PAYMENT && (
                <PaymentForm
                  studentId={scannedId}
                  student={student}
                  studentName={studentName}
                  setStudentName={setStudentName}
                  isLoading={isLoadingStudent}
                  isError={isStudentError}
                  error={studentError instanceof Error ? studentError : null}
                  onScan={(id) => {
                    setStudentId(id);
                    setScannedId(id);
                  }}
                  onSubmit={handlePaymentSubmit}
                  isPending={paymentMutation.isPending}
                />
              )}
              
              {currentStep === FlowStep.RESULT && payment && (
                <PaymentResult
                  payment={payment}
                  student={student}
                  onNewPayment={handleNewPayment}
                />
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-1">
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Recent Payments</h3>
              <div className="space-y-4 max-h-[350px] overflow-y-auto">
                {formattedLogs.filter(log => log.data.action === 'NEW_PAYMENT').length > 0 ? (
                  formattedLogs
                    .filter(log => log.data.action === 'NEW_PAYMENT')
                    .slice(0, 10)
                    .map((log, index) => (
                      <div key={index} className="flex items-start space-x-3 pb-3 border-b border-neutral-100">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <FontAwesomeIcon icon="money-bill-alt" className="text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-neutral-800">
                            <span className="font-medium">Received:</span> {formatCurrency(log.data.amountPaid)}
                          </p>
                          <p className="text-xs text-neutral-700">
                            From: {log.data.studentName || log.data.studentId}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {new Date(log.timestamp).toLocaleTimeString()} by {log.data.operatorName}
                          </p>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-neutral-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                      <FontAwesomeIcon icon="info-circle" className="text-neutral-400" />
                    </div>
                    <p className="text-sm text-neutral-600">No payment activity yet.</p>
                    <p className="text-xs text-neutral-500 mt-1">Recent payments will appear here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Cash Guide</h3>
              <div className="space-y-4 text-sm text-neutral-600">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Always verify student ID before processing payment</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Count received money carefully and enter exact bills</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Always provide exact change as specified by system</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Direct students to Distribution Station after payment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}