import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Distribution, Student } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { socketProvider } from "@/lib/socket";

interface CheckersTabProps {
  operatorName: string;
}

export function CheckersTab({ operatorName }: CheckersTabProps) {
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch distributions
  const { 
    data: distributions,
    isLoading: distributionsLoading,
    refetch: refetchDistributions
  } = useQuery<Distribution[]>({
    queryKey: ['/api/distributions'],
    refetchInterval: 5000 // Refresh every 5 seconds to check for new distributions
  });
  
  // Fetch students
  const { data: students } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 30000 // 30 seconds
  });
  
  // Split distributions into pending and confirmed
  const pendingDistributions = distributions?.filter(dist => !dist.verified) || [];
  const confirmedDistributions = distributions?.filter(dist => dist.verified) || [];
  
  // WebSocket handling
  useEffect(() => {
    // Connect to WebSocket
    socketProvider.connect();
    
    const handleNewDistribution = (message: any) => {
      if (message.type === 'NEW_DISTRIBUTION' || message.type === 'VERIFY_DISTRIBUTION') {
        refetchDistributions();
      }
    };
    
    // Subscribe to distribution events
    socketProvider.subscribe('NEW_DISTRIBUTION', handleNewDistribution);
    socketProvider.subscribe('VERIFY_DISTRIBUTION', handleNewDistribution);
    
    // Cleanup on unmount
    return () => {
      socketProvider.unsubscribe('NEW_DISTRIBUTION', handleNewDistribution);
      socketProvider.unsubscribe('VERIFY_DISTRIBUTION', handleNewDistribution);
    };
  }, [refetchDistributions]);
  
  // Confirm distribution mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ id, operatorName }: { id: number, operatorName: string }) => {
      const res = await apiRequest('PUT', `/api/distributions/${id}/verify`, { verifiedBy: operatorName });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Distribution Confirmed",
        description: "Successfully confirmed distribution.",
      });
      
      // Refresh distributions
      refetchDistributions();
    },
    onError: (error: Error) => {
      toast({
        title: "Confirmation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Get student name from ID
  const getStudentName = (studentId: string): string => {
    const student = students?.find(s => s.studentId === studentId);
    return student ? `${student.firstName} ${student.lastName}` : studentId;
  };
  
  // Handle confirm distribution
  const handleConfirm = (id: number) => {
    confirmMutation.mutate({ id, operatorName });
  };

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Checkers Station</h3>
          </div>
          
          <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <FontAwesomeIcon icon="clock" className="mr-2" />
                Pending
                {pendingDistributions.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingDistributions.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <FontAwesomeIcon icon="check-circle" className="mr-2" />
                Confirmed
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="pending">
              {distributionsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <FontAwesomeIcon icon="spinner" className="animate-spin text-2xl text-neutral-400" />
                </div>
              ) : pendingDistributions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                  <FontAwesomeIcon icon="inbox" className="text-3xl mb-4 text-neutral-300" />
                  <p>No pending distributions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Operator</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDistributions.map(distribution => (
                        <TableRow key={distribution.id}>
                          <TableCell className="font-medium">
                            {getStudentName(distribution.studentId)}
                          </TableCell>
                          <TableCell>
                            {new Date(distribution.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </TableCell>
                          <TableCell>{distribution.operatorName}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleConfirm(distribution.id)}
                              disabled={confirmMutation.isPending}
                            >
                              {confirmMutation.isPending ? (
                                <FontAwesomeIcon icon="spinner" className="animate-spin" />
                              ) : (
                                <FontAwesomeIcon icon="check" className="mr-2" />
                              )}
                              Confirm
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="confirmed">
              {distributionsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <FontAwesomeIcon icon="spinner" className="animate-spin text-2xl text-neutral-400" />
                </div>
              ) : confirmedDistributions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                  <FontAwesomeIcon icon="inbox" className="text-3xl mb-4 text-neutral-300" />
                  <p>No confirmed distributions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Distribution Time</TableHead>
                        <TableHead>Verification Time</TableHead>
                        <TableHead>Verified By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {confirmedDistributions.map(distribution => (
                        <TableRow key={distribution.id}>
                          <TableCell className="font-medium">
                            {getStudentName(distribution.studentId)}
                          </TableCell>
                          <TableCell>
                            {new Date(distribution.timestamp).toLocaleDateString()} {' '}
                            {new Date(distribution.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </TableCell>
                          <TableCell>
                            {distribution.verifiedAt && (
                              <>
                                {new Date(distribution.verifiedAt).toLocaleDateString()} {' '}
                                {new Date(distribution.verifiedAt).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center">
                              <FontAwesomeIcon icon="user-check" className="mr-2 text-green-500" />
                              {distribution.verifiedBy}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}