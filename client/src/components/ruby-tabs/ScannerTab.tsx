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
  DialogFooter,
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
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    focusInput(); // Initial focus

    // Re-focus when modal closes or after distribution
    if (!showModal) {
      focusInput();
    }

    // Re-focus on component mount and after any state changes
    const timeoutId = setTimeout(focusInput, 100);
    return () => clearTimeout(timeoutId);
  }, [showModal, distributionSuccess]);

  // Fetch student by ID
  const {
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    error: studentErrorData,
    refetch,
  } = useQuery<Student>({
    queryKey: ["/api/students", studentId],
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
    retry: false,
  });

  const {
    data: distribution,
    isError: distributionError,
    refetch: refetchDistributions,
  } = useQuery({
    queryKey: ["/api/distributions/student", studentId],
    queryFn: async () => {
      if (!studentId.trim()) {
        return [];
      }
      try {
        // Use correct API endpoint for student-specific distributions
        const response = await fetch(`/api/distributions/student/${studentId}`);
        console.log(
          "Distribution API response:",
          response.status,
          response.statusText,
        );

        if (!response.ok) {
          console.error(
            "Failed to fetch distributions:",
            response.status,
            response.statusText,
          );
          return [];
        }

        const data = await response.json();
        console.log("Student distributions data:", data);
        return data;
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
      const res = await apiRequest("POST", "/api/distributions", {
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

      // Server already broadcasts the WebSocket message
      // No need to send from client side - removing to avoid duplicate logs

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/distributions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Distribution failed",
        description: error.message,
        variant: "destructive",
      });
      setShowModal(false);
    },
  });

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId.trim()) {
      toast({
        title: "Empty ID",
        description: "Please enter a student ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Fetch student data
      const studentResult = await refetch();

      if (studentResult.isError || !studentResult.data) {
        setIsLoading(false);
        toast({
          title: "Student not found",
          description: `No student found with ID "${studentId}"`,
          variant: "destructive",
        });
        return;
      }

      console.log("Student found:", studentResult.data);

      // Now fetch distribution data
      const distributionResult = await refetchDistributions();
      console.log("Distribution fetch result:", distributionResult);

      // Continue regardless of distribution result (empty array is valid)
      setIsLoading(false);
      setShowModal(true);
    } catch (error) {
      console.error("Error in lookup process:", error);
      setIsLoading(false);
      toast({
        title: "Lookup Error",
        description: "An error occurred during the student lookup",
        variant: "destructive",
      });
    }
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
            <h3 className="text-lg font-medium text-neutral-800 mb-1">
              Scanner Station
            </h3>
            <p className="text-neutral-600 text-sm">
              Scan student IDs to record book distributions
            </p>
          </div>

          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="scanner-input"
                  className="block text-sm font-medium text-neutral-700 mb-1"
                >
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
                    <FontAwesomeIcon
                      icon="spinner"
                      className="animate-spin mr-2"
                    />
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
              {distributionSuccess
                ? "Yearbook Distributed"
                : "Student Information"}
            </DialogTitle>
          </DialogHeader>

          {distributionSuccess ? (
            <div className="py-6">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon="check"
                    className="text-2xl text-green-600"
                  />
                </div>
              </div>

              <div className="text-center mt-4">
                <h3 className="text-lg font-medium">
                  Success! The yearbook has been distributed to{" "}
                  {student?.firstName} {student?.lastName}
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

                  {/* Distribution Status */}
                  <div className="mt-4">
                    {/* Show current distribution status as explicit indicator */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center">
                        <FontAwesomeIcon
                          icon="info-circle"
                          className="text-gray-500 mr-3"
                        />
                        <div>
                          <h4 className="font-medium text-gray-800">
                            Current Status
                          </h4>
                          <p className="text-sm text-gray-700 flex items-center mt-1">
                            {(() => {
                              // Clear distributions check
                              const isDistributionArray =
                                Array.isArray(distribution);
                              const hasNoDistributions =
                                !isDistributionArray ||
                                distribution.length === 0;

                              // Determine status
                              if (hasNoDistributions) {
                                return (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-yellow-400 mr-2"></span>
                                    <span>Pending Distribution</span>
                                  </>
                                );
                              } else if (distribution.some((d) => d.verified)) {
                                return (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                                    <span>Confirmed</span>
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
                                    <span>Distributed</span>
                                  </>
                                );
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons or messages based on explicit status strings */}
                    {(() => {
                      const isDistributionArray = Array.isArray(distribution);
                      const hasNoDistributions =
                        !isDistributionArray || distribution.length === 0;

                      console.log(
                        "Distribution data type:",
                        typeof distribution,
                      );
                      console.log("Is array:", isDistributionArray);
                      console.log(
                        "Length:",
                        isDistributionArray ? distribution.length : "N/A",
                      );
                      console.log("Has no distributions:", hasNoDistributions);

                      // Explicit "Pending Distribution" status - show distribute button
                      if (hasNoDistributions) {
                        console.log("STATUS: Pending Distribution");
                        return (
                          <Button
                            onClick={handleDistribute}
                            disabled={distributeMutation.isPending}
                            className="w-full"
                          >
                            {distributeMutation.isPending ? (
                              <>
                                <FontAwesomeIcon
                                  icon="spinner"
                                  className="animate-spin mr-2"
                                />
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
                      }

                      // Check for "Confirmed" - any verified distributions
                      if (distribution.some((d) => d.verified)) {
                        console.log("STATUS: Confirmed");
                        return (
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div className="flex items-center">
                              <FontAwesomeIcon
                                icon="exclamation-triangle"
                                className="text-yellow-500 mr-3"
                              />
                              <div>
                                <h4 className="font-medium text-yellow-800">
                                  Already Confirmed
                                </h4>
                                <p className="text-sm text-yellow-700">
                                  This student has already received and
                                  confirmed their yearbook. Please direct them
                                  to the Ruby Station desk for assistance.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Otherwise "Distributed" - unverified distributions exist
                      console.log("STATUS: Distributed");
                      return (
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center">
                            <FontAwesomeIcon
                              icon="exclamation-triangle"
                              className="text-yellow-500 mr-3"
                            />
                            <div>
                              <h4 className="font-medium text-yellow-800">
                                Distribution Pending
                              </h4>
                              <p className="text-sm text-yellow-700">
                                This student's yearbook distribution is pending
                                verification. Please direct them to the Ruby
                                Station desk for assistance.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
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
