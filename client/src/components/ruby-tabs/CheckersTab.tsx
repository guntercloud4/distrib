import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student, Distribution } from "@shared/schema";
import { formatDateTime } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { socketProvider } from "@/lib/socket";

interface CheckersTabProps {
  operatorName: string;
}

export function CheckersTab({ operatorName }: CheckersTabProps) {
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();
  
  // Fetch distributions
  const { 
    data: distributions,
    isLoading: distributionsLoading,
    refetch: refetchDistributions
  } = useQuery<Distribution[]>({
    queryKey: ['/api/distributions'],
    refetchInterval: 5000 // Refresh every 5 seconds to check for new distributions
  });
  
  // Split distributions into pending and confirmed
  const pendingDistributions = distributions?.filter(dist => !dist.verifiedDate) || [];
  const confirmedDistributions = distributions?.filter(dist => dist.verifiedDate) || [];
  
  // WebSocket handling
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // If the message is about a new distribution, refetch distributions
        if (message.type === 'NEW_DISTRIBUTION' || message.type === 'VERIFY_DISTRIBUTION') {
          refetchDistributions();
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
    
    // Register WebSocket event handler
    window.addEventListener("message", (event) => {
      if (event.data.type === "ws-message") {
        handleWebSocketMessage(event.data.data);
      }
    });
    
    // Cleanup event handler on unmount
    return () => {
      window.removeEventListener("message", (event) => {
        if (event.data.type === "ws-message") {
          handleWebSocketMessage(event.data.data);
        }
      });
    };
  }, [refetchDistributions]);
  
  // Verify distribution mutation
  const verifyDistributionMutation = useMutation({
    mutationFn: async ({ id, operatorName }: { id: number, operatorName: string }) => {
      const res = await apiRequest('PUT', `/api/distributions/${id}/verify`, { verifiedBy: operatorName });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Distribution Verified",
        description: "The yearbook distribution has been verified.",
      });
      
      // Log the verification via WebSocket
      socketProvider.send({
        type: 'LOG_ACTION',
        data: {
          id: Date.now(),
          timestamp: new Date(),
          studentId: data.studentId,
          action: 'VERIFY_DISTRIBUTION',
          details: { },
          stationName: 'Ruby Station',
          operatorName
        }
      });
      
      // Broadcast the verification via WebSocket
      socketProvider.send({
        type: 'VERIFY_DISTRIBUTION',
        data: data
      });
      
      refetchDistributions();
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Student information map for quicker lookup
  const [studentMap, setStudentMap] = useState<Record<string, Student>>({});
  
  // Fetch all students to build the map
  const { data: students } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    onSuccess: (data) => {
      const map: Record<string, Student> = {};
      data.forEach(student => {
        map[student.studentId] = student;
      });
      setStudentMap(map);
    }
  });
  
  // Handle verification
  const handleVerify = (id: number) => {
    verifyDistributionMutation.mutate({ id, operatorName });
  };

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Distribution Verification</h3>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="relative">
                Pending
                {pendingDistributions.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                    {pendingDistributions.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pending">
              {distributionsLoading ? (
                <div className="text-center py-12">
                  <FontAwesomeIcon icon="sync" className="animate-spin text-primary mb-3" size="2x" />
                  <p>Loading distributions...</p>
                </div>
              ) : pendingDistributions.length === 0 ? (
                <div className="text-center py-12 bg-neutral-50 rounded-lg border border-neutral-200">
                  <FontAwesomeIcon icon="check" className="text-green-500 mb-3" size="2x" />
                  <h3 className="text-lg font-medium mb-1">You're all caught up!</h3>
                  <p className="text-neutral-600">No pending distributions to verify.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingDistributions.map((distribution) => {
                    const student = studentMap[distribution.studentId];
                    return (
                      <div 
                        key={distribution.id} 
                        className="flex items-center justify-between p-4 bg-white rounded-lg border border-neutral-200 hover:border-primary transition-colors"
                      >
                        <div>
                          <div className="font-medium">
                            {student ? `${student.firstName} ${student.lastName}` : distribution.studentId}
                          </div>
                          <div className="text-sm text-neutral-500">
                            Distributed {formatDateTime(distribution.distributionDate)}
                          </div>
                          <div className="text-sm text-neutral-500">
                            By {distribution.distributedBy}
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleVerify(distribution.id)}
                          disabled={verifyDistributionMutation.isPending}
                          className="bg-primary hover:bg-primary-dark"
                        >
                          {verifyDistributionMutation.isPending && verifyDistributionMutation.variables?.id === distribution.id ? (
                            <>
                              <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon="check" className="mr-2" />
                              Confirm
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="confirmed">
              {distributionsLoading ? (
                <div className="text-center py-12">
                  <FontAwesomeIcon icon="sync" className="animate-spin text-primary mb-3" size="2x" />
                  <p>Loading verified distributions...</p>
                </div>
              ) : confirmedDistributions.length === 0 ? (
                <div className="text-center py-12 bg-neutral-50 rounded-lg border border-neutral-200">
                  <FontAwesomeIcon icon="info-circle" className="text-blue-500 mb-3" size="2x" />
                  <h3 className="text-lg font-medium mb-1">No Verified Distributions</h3>
                  <p className="text-neutral-600">Confirmed distributions will appear here.</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Distributed By</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Distribution Date</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Verified By</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Verification Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {confirmedDistributions.map((distribution) => {
                        const student = studentMap[distribution.studentId];
                        return (
                          <tr key={distribution.id} className="hover:bg-neutral-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium">
                                {student ? `${student.firstName} ${student.lastName}` : distribution.studentId}
                              </div>
                              <div className="text-xs text-neutral-500">
                                ID: {distribution.studentId}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {distribution.distributedBy}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {formatDateTime(distribution.distributionDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {distribution.verifiedBy}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {formatDateTime(distribution.verifiedDate || "")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}