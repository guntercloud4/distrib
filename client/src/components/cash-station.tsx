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

  // Fetch student data when scanned
  const { data: student, isLoading, isError, error, remove } = useQuery<Student>({
    queryKey: ['/api/students', studentId],
    enabled: !!studentId,
    retry: false,
    staleTime: 0,
    onSuccess: (data) => {
      setStudentName(`${data.firstName} ${data.lastName}`);
    }
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
    remove();
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
            <RecentActivity stationType="cash" />
          )}
        </div>
      </div>
    </div>
  );
}
