import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student, Distribution } from "@shared/schema";
import { handleScannerEnter, formatTime, formatDate } from "@/lib/utils";
import { StudentInfo } from "@/components/student-info";
import { RecentActivity } from "@/components/recent-activity";
import { socketProvider } from "@/lib/socket";

interface CheckerStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function CheckerStation({ operatorName, onLogout }: CheckerStationProps) {
  const [studentId, setStudentId] = useState("");
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch student data when scanned
  const { 
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    error: studentErrorData,
    refetch: refetchStudent,
    remove: removeStudent
  } = useQuery<Student>({
    queryKey: ['/api/students', studentId],
    enabled: !!studentId && !scanning,
    retry: false,
    staleTime: 0
  });

  // Fetch distribution data when student is loaded
  const { 
    data: distribution,
    isLoading: distributionLoading,
    isError: distributionError,
  } = useQuery<Distribution[]>({
    queryKey: ['/api/distributions/student', studentId],
    enabled: !!student?.studentId,
    retry: false,
    staleTime: 0,
    select: (data) => data.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  });

  const latestDistribution = distribution?.[0];

  // Handle verification confirmation
  const verifyMutation = useMutation({
    mutationFn: async ({ id, verifiedBy }: { id: number, verifiedBy: string }) => {
      const res = await apiRequest('PUT', `/api/distributions/${id}/verify`, { verifiedBy });
      return await res.json();
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      
      // Send WebSocket notification
      socketProvider.send({
        type: 'VERIFY_DISTRIBUTION',
        data
      });
      
      // Show success message
      toast({
        title: "Verification Confirmed",
        description: `Yearbook delivery verified for ${student?.firstName} ${student?.lastName}`,
      });
      
      // Reset form
      setStudentId("");
      setScanning(false);
      removeStudent();
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle scanner input
  const handleScan = (value: string) => {
    setScanning(true);
    setStudentId(value);
    
    // Small delay to simulate scanning
    setTimeout(() => {
      setScanning(false);
      refetchStudent();
    }, 500);
  };

  // Handle verification confirmation
  const confirmVerification = () => {
    if (!latestDistribution || !student) return;
    
    verifyMutation.mutate({
      id: latestDistribution.id,
      verifiedBy: operatorName
    });
  };

  const isVerified = latestDistribution?.verified;
  const canVerify = !!latestDistribution && !isVerified;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">Checkers Station</h2>
        <Button 
          variant="outline" 
          onClick={onLogout}
          className="text-neutral-600 hover:text-neutral-800"
        >
          <span className="material-icons text-base mr-1">logout</span>
          Exit Station
        </Button>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-4">
            <label htmlFor="checker-student-id" className="block text-sm font-medium text-neutral-700 mb-1">
              Scan Student ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <span className="material-icons">qr_code_scanner</span>
              </span>
              <Input
                id="checker-student-id"
                className="scanner-input pl-10"
                placeholder="Student ID"
                onKeyDown={(e) => handleScannerEnter(e, handleScan)}
                disabled={scanning || verifyMutation.isPending}
              />
            </div>
          </div>
          
          {scanning && (
            <div className="flex items-center justify-center py-2 text-neutral-600">
              <span className="material-icons animate-spin mr-2">sync</span>
              Scanning...
            </div>
          )}
          
          {studentError && (
            <div className="bg-red-50 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="material-icons text-red-400">error</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Scan Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{(studentErrorData as Error).message || "Student not found"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!latestDistribution && student && (
            <div className="bg-yellow-50 p-4 rounded-md mt-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="material-icons text-yellow-400">warning</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">No Distribution Found</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>This student has not received a yearbook distribution yet.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {student && latestDistribution && !studentLoading && !distributionLoading && !studentError && !distributionError && (
        <>
          <StudentInfo 
            student={student}
            distributionInfo={latestDistribution}
            showVerificationStatus
            actionButton={
              canVerify ? (
                <Button 
                  onClick={confirmVerification}
                  disabled={verifyMutation.isPending}
                  className="inline-flex items-center"
                  variant="default"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <span className="material-icons text-base mr-1 animate-spin">sync</span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-base mr-1">verified</span>
                      Confirm Verification
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  disabled
                  variant="outline"
                  className="inline-flex items-center"
                >
                  <span className="material-icons text-base mr-1">check_circle</span>
                  Already Verified
                </Button>
              )
            }
          />
          
          <RecentActivity stationType="checker" />
        </>
      )}
    </div>
  );
}
