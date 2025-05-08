import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student, Distribution } from "@shared/schema";
import { socketProvider } from "@/lib/socket";
import { formatDateTime } from "@/lib/utils";
import { useWsLogs } from "@/hooks/use-ws-logs";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface CheckerStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function CheckerStation({ operatorName, onLogout }: CheckerStationProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { formattedLogs } = useWsLogs();
  
  // Fetch active distributions that need verification
  const { 
    data: distributions, 
    isLoading: isLoadingDistributions,
    refetch: refetchDistributions
  } = useQuery<Distribution[]>({
    queryKey: ['/api/distributions'],
    refetchInterval: 5000 // Refresh every 5 seconds to catch new distributions
  });
  
  // Filter to only get unverified distributions
  const unverifiedDistributions = distributions?.filter(d => !d.verified) || [];
  
  // Filter distributions based on search term
  const filteredDistributions = unverifiedDistributions.filter(dist => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    return (
      dist.studentId.toLowerCase().includes(term) ||
      dist.studentName.toLowerCase().includes(term)
    );
  });
  
  // Fetch student data for each distribution
  const { data: students } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 30000 // 30 seconds
  });
  
  // Verification mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ id, verifiedBy }: { id: number, verifiedBy: string }) => {
      const res = await apiRequest('PUT', `/api/distributions/${id}/verify`, { verifiedBy });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Distribution Verified",
        description: `Successfully verified distribution for ${data.studentName}`,
      });
      
      // Log the action via WebSocket
      socketProvider.send({
        type: 'VERIFY_DISTRIBUTION',
        data: {
          id: Date.now(),
          timestamp: new Date(),
          studentId: data.studentId,
          action: 'VERIFY_DISTRIBUTION',
          details: { distributionId: data.id },
          stationName: 'Checker Station',
          operatorName,
          studentName: data.studentName
        }
      });
      
      // Refetch distributions to update the list
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
  
  // Handle verification
  const handleVerify = (id: number) => {
    verifyMutation.mutate({ id, verifiedBy: operatorName });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">Checker Station</h2>
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-neutral-800">Verification Queue</h3>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <FontAwesomeIcon icon="search" className="text-sm" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 py-1 h-9 text-sm"
                  />
                </div>
              </div>
              
              {isLoadingDistributions ? (
                <div className="text-center py-12">
                  <FontAwesomeIcon icon="sync" className="animate-spin text-2xl text-neutral-400 mb-3" />
                  <p className="text-sm text-neutral-600">Loading verification queue...</p>
                </div>
              ) : filteredDistributions.length > 0 ? (
                <div className="overflow-hidden overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead>
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Student Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Distributed At</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {filteredDistributions.map((distribution) => (
                        <tr key={distribution.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800">
                            {distribution.studentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                            {distribution.studentId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                            {formatDateTime(distribution.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className="bg-yellow-100 text-yellow-800 border-yellow-200"
                            >
                              Needs Verification
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <Button 
                              variant="secondary"
                              size="sm"
                              onClick={() => handleVerify(distribution.id)}
                              disabled={verifyMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <FontAwesomeIcon icon="check" className="mr-2" />
                              Verify
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 bg-neutral-50 rounded-lg">
                  <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <FontAwesomeIcon icon="check-circle" className="text-2xl text-green-600" />
                  </div>
                  <h4 className="text-lg font-medium text-neutral-700 mb-2">You're all caught up!</h4>
                  <p className="text-sm text-neutral-500 max-w-md mx-auto">
                    Wait for names to pop up here when books are distributed and need verification.
                  </p>
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
                {formattedLogs.filter(log => log.data.action === 'VERIFY_DISTRIBUTION').length > 0 ? (
                  formattedLogs
                    .filter(log => log.data.action === 'VERIFY_DISTRIBUTION')
                    .slice(0, 10)
                    .map((log, index) => (
                      <div key={index} className="flex items-start space-x-3 pb-3 border-b border-neutral-100">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <FontAwesomeIcon icon="check" className="text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-neutral-800">
                            <span className="font-medium">Verified:</span> {log.data.studentName || log.data.studentId}
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
                    <p className="text-sm text-neutral-600">No verification activity yet.</p>
                    <p className="text-xs text-neutral-500 mt-1">Recent verifications will appear here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Checker Guide</h3>
              <div className="space-y-4 text-sm text-neutral-600">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Check student ID and verify they have received the correct yearbook</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Ensure all accessories (if ordered) are included in the package</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Verify student name is correctly printed on personalized books</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <FontAwesomeIcon icon="info" className="text-blue-600 text-xs" />
                  </div>
                  <p>Direct students with payment issues to the Cash Station</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}