import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student } from "@shared/schema";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { socketProvider } from "@/lib/socket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

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
  
  // Focus the first name input when the component mounts
  useEffect(() => {
    if (firstNameInputRef.current) {
      firstNameInputRef.current.focus();
    }
  }, []);
  
  // Free book mutation
  const freeBookMutation = useMutation({
    mutationFn: async (data: { firstName: string, lastName: string, operatorName: string }) => {
      // First, we'll create a student with the specified name
      const studentRes = await apiRequest('POST', '/api/students', {
        studentId: "0000000",
        firstName: data.firstName,
        lastName: data.lastName,
        orderType: "FREE",
        orderNumber: `FREE-${Date.now().toString().slice(-6)}`,
        balanceDue: "0",
        paymentStatus: "Free"
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
      
      // Log the action via WebSocket
      socketProvider.send({
        type: 'LOG_ACTION',
        data: {
          id: Date.now(),
          timestamp: new Date(),
          studentId: data.student.studentId,
          action: 'ISSUE_FREE_BOOK',
          details: { 
            firstName: data.student.firstName,
            lastName: data.student.lastName
          },
          stationName: 'Ruby Station',
          operatorName
        }
      });
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName || !lastName) {
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
  
  // Reset the form
  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setShowSuccessDialog(false);
    setProcessedStudent(null);
    
    // Focus the first name input
    setTimeout(() => {
      if (firstNameInputRef.current) {
        firstNameInputRef.current.focus();
      }
    }, 100);
  };

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Free Book Management</h3>
          </div>
          
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
            <div className="text-center mb-6">
              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 mx-auto mb-4">
                <FontAwesomeIcon icon="gift" size="2x" />
              </div>
              <h4 className="text-xl font-medium mb-2">Free Book Management</h4>
              <p className="text-neutral-600 mb-4">
                Issue a complimentary book to someone without requiring payment.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    ref={firstNameInputRef}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    className="w-full"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    className="w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && firstName && lastName) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-0.5">
                    <FontAwesomeIcon icon="info-circle" className="text-blue-500" />
                  </div>
                  <div className="ml-3">
                    <h5 className="text-sm font-medium text-blue-800">Free Book Information</h5>
                    <ul className="mt-1 text-sm text-blue-700 list-disc list-inside">
                      <li>Student ID will be set to 0000000</li>
                      <li>A unique order number will be generated</li>
                      <li>Payment status will be marked as "Free"</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={!firstName || !lastName || freeBookMutation.isPending}
              >
                {freeBookMutation.isPending ? (
                  <>
                    <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="gift" className="mr-2" />
                    Issue Free Book
                  </>
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl text-green-600">
              <FontAwesomeIcon icon="check-circle" className="mr-2" />
              Free Book Issued
            </DialogTitle>
            <DialogDescription className="text-center">
              A complimentary yearbook has been issued successfully
            </DialogDescription>
          </DialogHeader>
          
          {processedStudent && (
            <div className="py-4">
              <div className="bg-neutral-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="text-neutral-600">Student ID:</div>
                  <div className="font-medium">{processedStudent.studentId}</div>
                  <div className="text-neutral-600">Name:</div>
                  <div className="font-medium">{processedStudent.firstName} {processedStudent.lastName}</div>
                  <div className="text-neutral-600">Order Type:</div>
                  <div className="font-medium">{processedStudent.orderType}</div>
                  <div className="text-neutral-600">Order Number:</div>
                  <div className="font-medium">{processedStudent.orderNumber}</div>
                  <div className="text-neutral-600">Status:</div>
                  <div className="font-medium">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {processedStudent.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={resetForm} 
              className="w-full"
            >
              <FontAwesomeIcon icon="plus" className="mr-2" />
              Issue Another Free Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}