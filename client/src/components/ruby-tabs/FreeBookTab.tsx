import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Student } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FreeBookTabProps {
  operatorName: string;
}

export function FreeBookTab({ operatorName }: FreeBookTabProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [processedStudent, setProcessedStudent] = useState<Student | null>(null);
  
  // Refs for auto-focus
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Focus the first name input when the component mounts
  useEffect(() => {
    if (firstNameInputRef.current) {
      firstNameInputRef.current.focus();
    }
  }, []);
  
  // Free book mutation
  const freeBookMutation = useMutation({
    mutationFn: async (data: { firstName: string, lastName: string, operatorName: string }) => {
      // Generate a unique free student ID with a timestamp to avoid conflicts
      const uniqueId = `FREE${Date.now().toString().slice(-7)}`;
      
      // First, we'll create a student with the specified name
      const studentRes = await apiRequest('POST', '/api/students', {
        studentId: uniqueId,
        firstName: data.firstName,
        lastName: data.lastName,
        orderType: "FREE",
        orderNumber: `FREE-${Date.now().toString().slice(-6)}`,
        balanceDue: "0",
        paymentStatus: "Free",
        yearbook: true,
        operatorName: data.operatorName
      });
      
      const student = await studentRes.json();
      
      // Then, we'll issue a free book
      const res = await apiRequest('POST', `/api/students/${student.studentId}/free-book`, {
        operatorName: data.operatorName
      });
      
      return {
        freeBookResult: await res.json(),
        student
      };
    },
    onSuccess: (data) => {
      setProcessedStudent(data.student);
      setShowSuccessDialog(true);
      
      // Reset form
      setFirstName("");
      setLastName("");
      
      // Refetch any relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
      
      // Refocus the first name input
      setTimeout(() => {
        if (firstNameInputRef.current) {
          firstNameInputRef.current.focus();
        }
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Free Book Issue Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle form submit
  const handleSubmit = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both first and last name.",
        variant: "destructive"
      });
      return;
    }
    
    freeBookMutation.mutate({
      firstName,
      lastName,
      operatorName
    });
  };
  
  // Handle close success dialog
  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    setProcessedStudent(null);
  };
  
  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Free Book Management</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-neutral-800 mb-4">Issue a Complimentary Book</h4>
                <p className="text-sm text-neutral-600 mb-4">
                  Issue a complimentary book to someone without requiring payment.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-neutral-700 mb-1">
                      First Name
                    </label>
                    <Input
                      id="first-name"
                      ref={firstNameInputRef}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={freeBookMutation.isPending}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-neutral-700 mb-1">
                      Last Name
                    </label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={freeBookMutation.isPending}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleSubmit}
                    disabled={freeBookMutation.isPending || !firstName.trim() || !lastName.trim()}
                    className="w-full"
                  >
                    {freeBookMutation.isPending ? (
                      <>
                        <FontAwesomeIcon icon="spinner" className="mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon="gift" className="mr-2" />
                        Issue Free Book
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-neutral-50 p-6 rounded-lg flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-6xl text-neutral-300 mb-4">
                  <FontAwesomeIcon icon="book-open" />
                </div>
                <div className="text-xl font-medium text-neutral-600 mb-2">Free Book System</div>
                <div className="text-neutral-500 text-center max-w-md">
                  Provide complimentary books to VIPs, administrators, staff, or other special recipients without requiring payment.
                </div>
                <div className="mt-6 text-sm text-neutral-500 border-t border-neutral-200 pt-4 w-full text-center">
                  <ul className="text-left list-disc list-inside">
                    <li>Student ID is auto-generated with FREE prefix</li>
                    <li>Order type will be set to FREE</li>
                    <li>Sale number is auto-generated</li>
                    <li>Payment status will be Free</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center text-xl">
              <FontAwesomeIcon icon="check-circle" className="mr-2 text-green-500" />
              Free Book Processed
            </DialogTitle>
          </DialogHeader>
          
          {processedStudent && (
            <div className="py-4">
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <div className="text-center mb-3">
                  <div className="text-lg font-bold text-green-800">
                    {processedStudent.firstName} {processedStudent.lastName}
                  </div>
                  <div className="text-sm text-green-600">
                    ID: {processedStudent.studentId}
                  </div>
                </div>
                
                <div className="text-green-700 text-sm">
                  <div className="flex justify-between mb-1">
                    <span>Order Type:</span>
                    <span className="font-medium">{processedStudent.orderType}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Order Number:</span>
                    <span className="font-medium">{processedStudent.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Status:</span>
                    <span className="font-medium">{processedStudent.paymentStatus}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-center text-neutral-600 text-sm">
                A free book has been successfully processed and ready for distribution.
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              className="w-full" 
              onClick={handleCloseSuccessDialog}
            >
              <FontAwesomeIcon icon="plus" className="mr-2" />
              Process Another Free Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}