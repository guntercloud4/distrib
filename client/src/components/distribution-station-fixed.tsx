import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student, Distribution } from "@shared/schema";
import { socketProvider } from "@/lib/socket";
import { StudentInfo } from "@/components/student-info";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { handleScannerEnter } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface DistributionStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function DistributionStation({ operatorName, onLogout }: DistributionStationProps) {
  const [studentId, setStudentId] = useState("");
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [distributionInfo, setDistributionInfo] = useState<Distribution | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const studentIdInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { formattedLogs } = useWsLogs();
  
  // Focus input on load
  useEffect(() => {
    if (studentIdInputRef.current) {
      studentIdInputRef.current.focus();
    }
  }, []);
  
  // Fetch student data by ID
  const { 
    data: student, 
    isLoading: isLoadingStudent,
    isError: isStudentError,
    error: studentError,
    refetch: refetchStudent
  } = useQuery<Student | undefined>({
    queryKey: ['/api/students', studentId],
    queryFn: async () => {
      if (!studentId) return undefined;
      
      try {
        const res = await fetch(`/api/students/${studentId}`);
        if (!res.ok) {
          if (res.status === 404) {
            toast({
              title: "Student Not Found",
              description: `No student found with ID: ${studentId}`,
              variant: "destructive"
            });
            return undefined;
          }
          throw new Error(`Failed to fetch student: ${res.status}`);
        }
        return await res.json();
      } catch (error) {
        console.error("Error fetching student:", error);
        return undefined;
      }
    },
    enabled: !!studentId,
    staleTime: 1000, // 1 second
    retry: false
  });
  
  // Fetch distribution data by student ID
  const { 
    data: distribution,
    refetch: refetchDistribution
  } = useQuery<Distribution | undefined>({
    queryKey: ['/api/distributions', studentId],
    queryFn: async () => {
      if (!studentId) return undefined;
      
      try {
        const res = await fetch(`/api/distributions/student/${studentId}`);
        if (!res.ok) {
          if (res.status !== 404) {
            throw new Error(`Failed to fetch distribution: ${res.status}`);
          }
          return undefined;
        }
        
        const distributions = await res.json();
        return distributions[0]; // Return the most recent distribution
      } catch (error) {
        console.error("Error fetching distribution:", error);
        return undefined;
      }
    },
    enabled: !!studentId,
    staleTime: 1000, // 1 second
    retry: false
  });
  
  // Create distribution mutation
  const distributionMutation = useMutation({
    mutationFn: async (distribution: { studentId: string; studentName: string; operatorName: string }) => {
      const res = await apiRequest('POST', '/api/distributions', distribution);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Distribution Recorded",
        description: `Successfully recorded distribution for ${data.studentName}`,
      });
      
      // Update the local state
      setDistributionInfo(data);
      setIsProcessing(false);
      
      // Log the action via WebSocket
      socketProvider.send({
        type: 'NEW_DISTRIBUTION',
        data
      });
      
      // Refetch distribution data
      refetchDistribution();
    },
    onError: (error: Error) => {
      toast({
        title: "Distribution Failed",
        description: error.message,
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  });
  
  // Handle student ID scan/entry
  const handleStudentIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentId.trim()) {
      toast({
        title: "Student ID Required",
        description: "Please enter or scan a student ID",
        variant: "destructive"
      });
      return;
    }
    
    await refetchStudent();
  };
  
  // Update local state when student data changes
  useEffect(() => {
    setStudentData(student || null);
  }, [student]);
  
  // Update local state when distribution data changes
  useEffect(() => {
    setDistributionInfo(distribution || null);
  }, [distribution]);
  
  // Handle distribution process
  const handleDistribute = () => {
    if (!studentData) return;
    
    setIsProcessing(true);
    
    const studentName = `${studentData.firstName} ${studentData.lastName}`;
    
    distributionMutation.mutate({
      studentId: studentData.studentId,
      studentName,
      operatorName
    });
  };
  
  // Reset the form
  const handleReset = () => {
    setStudentId("");
    setStudentData(null);
    setDistributionInfo(null);
    
    if (studentIdInputRef.current) {
      studentIdInputRef.current.focus();
    }
  };
  
  // Handle barcode scanner input (auto-submits on scanner Enter)
  const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleScannerEnter(e, handleStudentIdSubmit);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">Distribution Station</h2>
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
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Process Distribution</h3>
              
              {!studentData ? (
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
                            <FontAwesomeIcon icon="search" className="mr-2" />
                            Find
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
                      <h5 className="text-sm font-medium text-blue-800 mb-1">How to Process a Distribution</h5>
                      <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Scan or enter the student's ID number</li>
                        <li>Verify student information and payment status</li>
                        <li>Locate and hand over the correct yearbook package</li>
                        <li>Click "Record Distribution" to complete the process</li>
                        <li>Direct student to the Checker Station for verification</li>
                      </ol>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-neutral-200">
                  <div className="p-6 border-b border-neutral-200">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-md font-medium text-neutral-700">Student Information</h4>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleReset}
                      >
                        <FontAwesomeIcon icon="times" className="mr-2" />
                        Reset
                      </Button>
                    </div>
                    
                    {studentData && (
                      <StudentInfo 
                        student={studentData} 
                        distributionInfo={distributionInfo || undefined}
                        showActions={true}
                        showVerificationStatus={true}
                      />
                    )}
                  </div>
                  
                  <div className="p-6">
                    <div className="flex flex-col">
                      {distributionInfo ? (
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <FontAwesomeIcon icon="check-circle" className="text-green-600 text-xl" />
                          </div>
                          <h5 className="text-md font-medium text-green-800 mb-1">Distribution Completed</h5>
                          <p className="text-sm text-green-700 mb-3">
                            Yearbook was successfully distributed to {studentData.firstName} {studentData.lastName}
                          </p>
                          <div className="flex justify-center space-x-4">
                            <div className="text-sm text-green-800">
                              <div className="flex items-center">
                                <FontAwesomeIcon icon="user" className="mr-2" />
                                <span>Distributed by: {distributionInfo.operatorName}</span>
                              </div>
                            </div>
                            <div className="text-sm text-green-800">
                              <div className="flex items-center">
                                <FontAwesomeIcon icon="clock" className="mr-2" />
                                <span>Time: {new Date(distributionInfo.timestamp).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            className="mt-4" 
                            onClick={handleReset}
                          >
                            <FontAwesomeIcon icon="redo" className="mr-2" />
                            Process Another Student
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          {studentData.paymentStatus.toLowerCase() === 'unpaid' && (
                            <div className="bg-yellow-50 rounded-lg p-4 mb-4 w-full text-center">
                              <FontAwesomeIcon icon="exclamation-triangle" className="text-yellow-600 text-xl mb-2" />
                              <h5 className="text-md font-medium text-yellow-800 mb-1">Payment Required</h5>
                              <p className="text-sm text-yellow-700 mb-2">
                                This student has not paid for their yearbook.
                              </p>
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                Balance Due: ${parseFloat(studentData.balanceDue.toString()).toFixed(2)}
                              </Badge>
                              <p className="text-sm text-yellow-700 mt-2">
                                Please direct them to the Cash Station for payment.
                              </p>
                            </div>
                          )}
                          
                          <Button
                            className="w-full max-w-md py-6"
                            variant="default"
                            size="lg"
                            onClick={handleDistribute}
                            disabled={isProcessing || distributionMutation.isPending || studentData.paymentStatus.toLowerCase() === 'unpaid'}
                          >
                            {isProcessing || distributionMutation.isPending ? (
                              <>
                                <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <FontAwesomeIcon icon="box" className="mr-2" />
                                Record Distribution
                              </>
                            )}
                          </Button>
                          
                          {studentData.paymentStatus.toLowerCase() === 'unpaid' && (
                            <p className="text-sm text-red-600 mt-3">
                              <FontAwesomeIcon icon="lock" className="mr-1" />
                              Distribution locked until payment is complete
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-1">
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Recent Activity</h3>
              <div className="space-y-4 max-h-[350px] overflow-y-auto">
                {formattedLogs.filter(log => log.data.action === 'NEW_DISTRIBUTION').length > 0 ? (
                  formattedLogs
                    .filter(log => log.data.action === 'NEW_DISTRIBUTION')
                    .slice(0, 10)
                    .map((log, index) => (
                      <div key={index} className="flex items-start space-x-3 pb-3 border-b border-neutral-100">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <FontAwesomeIcon icon="box" className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-neutral-800">
                            <span className="font-medium">Distributed:</span> {log.data.studentName || log.data.studentId}
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
                    <p className="text-sm text-neutral-600">No distribution activity yet.</p>
                    <p className="text-xs text-neutral-500 mt-1">Recent distributions will appear here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Distribution Guide</h3>
              <div className="space-y-4 text-sm text-neutral-600">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Check student ID before distributing any materials</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Verify student has paid before distributing yearbook</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>If student's status shows "Unpaid", direct to Cash Station</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Remind students to have their yearbook verified at the Checker Station</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}