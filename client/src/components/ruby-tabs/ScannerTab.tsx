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

interface ScannerTabProps {
  operatorName: string;
}

export function ScannerTab({ operatorName }: ScannerTabProps) {
  const [studentId, setStudentId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [distributionSuccess, setDistributionSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-focus the input field
  useEffect(() => {
    if (inputRef.current && !showModal) {
      inputRef.current.focus();
    }
  }, [showModal]);

  // Fetch student by ID
  const { 
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    error: studentErrorData,
    refetch
  } = useQuery<Student>({
    queryKey: ['/api/students', studentId],
    queryFn: async () => {
      if (!studentId.trim()) {
        throw new Error("Student ID is required");
      }
      const response = await fetch(`/api/students/${studentId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No student found with ID "${studentId}"`);
        }
        throw new Error("Failed to fetch student");
      }

      return response.json();
    },
    enabled: false, // Don't fetch automatically
    staleTime: 10000,
    retry: false
  });

    const { 
    data: distribution,
    isError: distributionError,
    refetch: refetchDistributions
  } = useQuery({
    queryKey: ['/api/distributions', studentId],
    queryFn: async () => {
      if (!studentId.trim()) {
        return [];
      }
      try {
        const response = await fetch(`/api/distributions?studentId=${studentId}`);
        if (!response.ok) {
          return [];
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching distributions:", error);
        return [];
      }
    },
    enabled: false,
    staleTime: 10000,
  });

  // Distribute mutation
  const distributeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await apiRequest('POST', '/api/distributions', {
        studentId: studentId.toString(),
        operatorName: operatorName,
        timestamp: new Date(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Show success state
      setDistributionSuccess(true);

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
      toast({
        title: "Distribution failed",
        description: error.message,
        variant: "destructive"
      });
      setShowModal(false);
    }
  });

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId.trim()) {
      toast({
        title: "Empty ID",
        description: "Please enter a student ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    // Fetch student data
    refetch().then((result) => {
      setIsLoading(false);
      if (result.isError) {
        toast({
          title: "Student not found",
          description: `No student found with ID "${studentId}"`,
          variant: "destructive"
        });
        return;
      }

      if (result.data) {
        // If student found, also fetch their distribution data
        refetchDistributions();
        setShowModal(true);
      }
    });
  };

  // Handle distribution
  const handleDistribute = () => {
    if (!student) return;
    distributeMutation.mutate(student.studentId);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
    setDistributionSuccess(false);
    setStudentId("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-neutral-800 mb-1">Scanner Station</h3>
            <p className="text-neutral-600 text-sm">Scan student IDs to record book distributions</p>
          </div>

          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
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
                    disabled={isLoading}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={!studentId.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                    Searching...
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
        </CardContent>
      </Card>

      {/* Student Modal */}
      <Dialog open={showModal} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>
              {distributionSuccess ? "Yearbook Distributed" : "Student Information"}
            </DialogTitle>
          </DialogHeader>

          {distributionSuccess ? (
            <div className="py-6">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <FontAwesomeIcon icon="check" className="text-2xl text-green-600" />
                </div>
              </div>

              <div className="text-center mt-4">
                <h3 className="text-lg font-medium">
                  Success! The yearbook has been distributed to {student?.firstName} {student?.lastName}
                </h3>
                <p className="text-neutral-600 mt-2">
                  The distribution has been recorded and sent to Verification.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-2">
              {student && (
                <div className="mt-6">
                  <StudentInfo student={student} showActions={true} />

                  {/* Get exact distribution status */}
                  {(() => {
                    console.log("Distribution data:", distribution);
                    
                    // Helper function to get distribution status as exact string
                    const getDistributionStatus = (): "Pending Distribution" | "Distributed" | "Confirmed" => {
                      // Check for valid distribution data
                      if (!distribution || !Array.isArray(distribution)) {
                        return "Pending Distribution";
                      }
                      
                      // No distributions at all
                      if (distribution.length === 0) {
                        return "Pending Distribution";
                      }
                      
                      // Check if any are verified (confirmed)
                      if (distribution.some(d => d.verified)) {
                        return "Confirmed";
                      }
                      
                      // Has unverified distributions
                      return "Distributed";
                    };

                    // Get the actual status
                    const status = getDistributionStatus();
                    console.log("Student status:", status);
                    
                    // Return the appropriate UI based on exact status string
                    if (status === "Pending Distribution") {
                      return (
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
                      );
                    } else if (status === "Confirmed") {
                      return (
                        <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center">
                            <FontAwesomeIcon icon="exclamation-triangle" className="text-yellow-500 mr-3" />
                            <div>
                              <h4 className="font-medium text-yellow-800">Already Confirmed</h4>
                              <p className="text-sm text-yellow-700">
                                This student has already received and confirmed their yearbook. Please direct them to the Ruby Station desk for assistance.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (status === "Distributed") {
                      return (
                        <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center">
                            <FontAwesomeIcon icon="exclamation-triangle" className="text-yellow-500 mr-3" />
                            <div>
                              <h4 className="font-medium text-yellow-800">Distribution Pending</h4>
                              <p className="text-sm text-yellow-700">
                                This student's yearbook distribution is pending verification. Please direct them to the Checkers Station for verification.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleModalClose}>
              {distributionSuccess ? "Scan Another ID" : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}