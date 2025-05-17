import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student, PaymentProcess } from "@shared/schema";
import { handleScannerEnter, formatCurrency } from "@/lib/utils";
import { PaymentForm } from "@/components/payment-form";
import { PaymentResult } from "@/components/payment-result";
import { RecentActivity } from "@/components/recent-activity";
import { socketProvider } from "@/lib/socket";
import { useWsLogs } from "@/hooks/use-ws-logs";

interface CashStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function CashStation({ operatorName, onLogout }: CashStationProps) {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [showPaymentResult, setShowPaymentResult] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formattedLogs } = useWsLogs();

  // Fetch student data when scanned
  const { 
    data: student, 
    isLoading, 
    isError, 
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/students', studentId],
    queryFn: async () => {
      if (!studentId) return undefined;
      try {
        const res = await fetch(`/api/students/${studentId}`);
        if (!res.ok) {
          if (res.status === 404) {
            return undefined;
          }
          throw new Error(`Failed to fetch student: ${res.status}`);
        }
        const data = await res.json();
        setStudentName(`${data.firstName} ${data.lastName}`);
        return data as Student;
      } catch (err) {
        console.error("Error fetching student:", err);
        throw err;
      }
    },
    enabled: !!studentId,
    retry: false,
    staleTime: 0
  });

  // Handle payment processing
  const paymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentProcess) => {
      const res = await apiRequest('POST', '/api/payments/process', paymentData);
      return await res.json();
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      
      // Send WebSocket notification
      socketProvider.send({
        type: 'NEW_PAYMENT',
        data
      });
      
      // Show payment result
      setPaymentResult(data);
      setShowPaymentResult(true);
      
      // Show success message
      toast({
        title: "Payment Processed",
        description: `Payment of ${formatCurrency(data.amountPaid)} processed successfully`,
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

  // Handle scanner input
  const handleScan = (value: string) => {
    setStudentId(value);
  };

  // Handle payment submission
  const handlePayment = (bills: Record<string, number>) => {
    if (!student) return;
    
    const paymentData: PaymentProcess = {
      studentId: student.studentId,
      studentName: studentName,
      amountDue: parseFloat(student.balanceDue.toString()),
      bills: {
        one: bills.one || 0,
        five: bills.five || 0,
        ten: bills.ten || 0,
        twenty: bills.twenty || 0,
        fifty: bills.fifty || 0,
        hundred: bills.hundred || 0
      },
      operatorName
    };
    
    paymentMutation.mutate(paymentData);
  };

  // Reset payment form
  const resetPayment = () => {
    setShowPaymentResult(false);
    setPaymentResult(null);
    setStudentId("");
    setStudentName("");
    refetch();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">Cash Station</h2>
        <Button 
          variant="outline" 
          onClick={onLogout}
          className="text-neutral-600 hover:text-neutral-800"
        >
          <span className="material-icons text-base mr-1">logout</span>
          Exit Station
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {!showPaymentResult && (
            <PaymentForm
              studentId={studentId}
              student={student}
              studentName={studentName}
              setStudentName={setStudentName}
              isLoading={isLoading}
              isError={isError}
              error={error as Error}
              onScan={handleScan}
              onSubmit={handlePayment}
              isPending={paymentMutation.isPending}
            />
          )}
        </div>
        
        <div className="lg:col-span-1">
          {showPaymentResult && paymentResult ? (
            <PaymentResult
              payment={paymentResult}
              student={student}
              onNewPayment={resetPayment}
            />
          ) : (
            <Card>
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
                            <span className="material-icons text-green-600 text-sm">payments</span>
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
                        <span className="material-icons text-neutral-400">info</span>
                      </div>
                      <p className="text-sm text-neutral-600">No payment activity yet.</p>
                      <p className="text-xs text-neutral-500 mt-1">Recent payments will appear here.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
