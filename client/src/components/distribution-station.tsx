import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { InsertDistribution, Student } from "@shared/schema";
import { handleScannerEnter } from "@/lib/utils";
import { StudentInfo } from "@/components/student-info";
import { RecentActivity } from "@/components/recent-activity";
import { socketProvider } from "@/lib/socket";

interface DistributionStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function DistributionStation({ operatorName, onLogout }: DistributionStationProps) {
  const [studentId, setStudentId] = useState("");
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch student data when scanned
  const { 
    data: student,
    isLoading,
    isError,
    error,
    refetch,
    remove
  } = useQuery<Student>({
    queryKey: ['/api/students', studentId],
    enabled: !!studentId && !scanning,
    retry: false,
    staleTime: 0
  });

  // Handle distribution confirmation
  const distributionMutation = useMutation({
    mutationFn: async (distribution: InsertDistribution) => {
      const res = await apiRequest('POST', '/api/distributions', distribution);
      return await res.json();
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      
      // Send WebSocket notification
      socketProvider.send({
        type: 'NEW_DISTRIBUTION',
        data
      });
      
      // Show success message
      toast({
        title: "Distribution Confirmed",
        description: `Yearbook successfully distributed to ${student?.firstName} ${student?.lastName}`,
      });
      
      // Reset form
      setStudentId("");
      setScanning(false);
      remove();
    },
    onError: (error: Error) => {
      toast({
        title: "Distribution Failed",
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
      refetch();
    }, 500);
  };

  // Handle distribution confirmation
  const confirmDistribution = () => {
    if (!student) return;
    
    distributionMutation.mutate({
      studentId: student.studentId,
      operatorName
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">Distribution Station</h2>
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
            <label htmlFor="student-id" className="block text-sm font-medium text-neutral-700 mb-1">
              Scan Student ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <span className="material-icons">qr_code_scanner</span>
              </span>
              <Input
                id="student-id"
                className="scanner-input pl-10"
                placeholder="Student ID"
                onKeyDown={(e) => handleScannerEnter(e, handleScan)}
                disabled={scanning || distributionMutation.isPending}
              />
            </div>
          </div>
          
          {scanning && (
            <div className="flex items-center justify-center py-2 text-neutral-600">
              <span className="material-icons animate-spin mr-2">sync</span>
              Scanning...
            </div>
          )}
          
          {isError && (
            <div className="bg-red-50 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="material-icons text-red-400">error</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Scan Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{(error as Error).message || "Student not found"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {student && !isLoading && !isError && (
        <>
          <StudentInfo 
            student={student} 
            showActions
            actionButton={
              <Button 
                onClick={confirmDistribution}
                disabled={distributionMutation.isPending}
                className="inline-flex items-center"
              >
                {distributionMutation.isPending ? (
                  <>
                    <span className="material-icons text-base mr-1 animate-spin">sync</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-base mr-1">check_circle</span>
                    Confirm Distribution
                  </>
                )}
              </Button>
            }
          />
          
          <RecentActivity stationType="distribution" />
        </>
      )}
    </div>
  );
}
