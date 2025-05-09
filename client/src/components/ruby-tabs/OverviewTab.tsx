import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Student, Distribution, Payment } from "@shared/schema";

export function OverviewTab() {
  // Fetch all required data
  const { 
    data: students,
    isLoading: studentsLoading,
    isError: studentsError
  } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 10000,
  });
  
  const {
    data: distributions,
    isLoading: distributionsLoading,
    isError: distributionsError
  } = useQuery<Distribution[]>({
    queryKey: ['/api/distributions'],
    staleTime: 10000,
  });
  
  const {
    data: payments,
    isLoading: paymentsLoading,
    isError: paymentsError
  } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
    staleTime: 10000,
  });
  
  // Calculate statistics
  const getStats = () => {
    if (!students || !distributions) {
      return {
        totalStudents: 0,
        studentsWithYearbooks: 0,
        distributedYearbooks: 0,
        verifiedYearbooks: 0,
        distributionProgress: 0,
        verificationProgress: 0,
        totalPayments: 0,
        totalAmount: 0,
        uniquePaidStudents: 0
      };
    }
    
    // Total students and those who ordered yearbooks
    const totalStudents = students.length;
    const studentsWithYearbooks = students.filter(s => s.yearbook).length;
    
    // Distributed and verified yearbooks
    const distributedYearbooks = new Set(distributions.map(d => d.studentId)).size;
    const verifiedDistributions = distributions.filter(d => d.verified);
    const verifiedYearbooks = new Set(verifiedDistributions.map(d => d.studentId)).size;
    
    // Progress percentages
    const distributionProgress = studentsWithYearbooks > 0 
      ? Math.round((distributedYearbooks / studentsWithYearbooks) * 100) 
      : 0;
    
    const verificationProgress = distributedYearbooks > 0 
      ? Math.round((verifiedYearbooks / distributedYearbooks) * 100) 
      : 0;
    
    // Payment statistics
    let totalPayments = 0;
    let totalAmount = 0;
    let uniquePaidStudents = 0;
    
    if (payments) {
      totalPayments = payments.length;
      totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      uniquePaidStudents = new Set(payments.map(p => p.studentId)).size;
    }
    
    return {
      totalStudents,
      studentsWithYearbooks,
      distributedYearbooks,
      verifiedYearbooks,
      distributionProgress,
      verificationProgress,
      totalPayments,
      totalAmount,
      uniquePaidStudents
    };
  };
  
  const stats = getStats();
  const isLoading = studentsLoading || distributionsLoading || paymentsLoading;
  const isError = studentsError || distributionsError || paymentsError;
  
  // Display loading or error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FontAwesomeIcon icon="spinner" className="animate-spin text-3xl text-neutral-400 mb-2" />
          <p className="text-neutral-600">Loading statistics...</p>
        </div>
      </div>
    );
  }
  
  if (isError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          Failed to load system statistics. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Student Statistics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Student Statistics</CardTitle>
            <CardDescription>
              Overall student enrollment and yearbook orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-600">Total Students</span>
                  <span className="text-lg font-semibold">{stats.totalStudents}</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-600">Students with Yearbooks</span>
                  <span className="text-lg font-semibold">{stats.studentsWithYearbooks}</span>
                </div>
                <Progress 
                  value={stats.totalStudents ? (stats.studentsWithYearbooks / stats.totalStudents) * 100 : 0} 
                  className="h-2" 
                />
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm text-neutral-500 mb-2">Yearbook Order Percentage</div>
                <div className="text-2xl font-bold">
                  {stats.totalStudents ? 
                    Math.round((stats.studentsWithYearbooks / stats.totalStudents) * 100) : 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Distribution Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribution Progress</CardTitle>
            <CardDescription>
              Status of yearbook distribution and verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-600">Yearbooks To Distribute</span>
                  <span className="text-lg font-semibold">{stats.studentsWithYearbooks}</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-600">Distributed</span>
                  <span className="text-lg font-semibold">
                    {stats.distributedYearbooks} / {stats.studentsWithYearbooks}
                  </span>
                </div>
                <Progress value={stats.distributionProgress} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-600">Verified</span>
                  <span className="text-lg font-semibold">
                    {stats.verifiedYearbooks} / {stats.distributedYearbooks}
                  </span>
                </div>
                <Progress value={stats.verificationProgress} className="h-2" />
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm text-neutral-500 mb-2">Distribution Complete</div>
                <div className="text-2xl font-bold">{stats.distributionProgress}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Payment Statistics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Payment Statistics</CardTitle>
            <CardDescription>
              Financial summary of yearbook payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-600">Total Transactions</span>
                  <span className="text-lg font-semibold">{stats.totalPayments}</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-600">Students Paid</span>
                  <span className="text-lg font-semibold">
                    {stats.uniquePaidStudents} / {stats.studentsWithYearbooks}
                  </span>
                </div>
                <Progress 
                  value={stats.studentsWithYearbooks ? 
                    (stats.uniquePaidStudents / stats.studentsWithYearbooks) * 100 : 0} 
                  className="h-2" 
                />
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm text-neutral-500 mb-2">Total Revenue</div>
                <div className="text-2xl font-bold">${stats.totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Yearbook Distribution Status</CardTitle>
          <CardDescription>
            Detailed breakdown of distribution and verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center justify-center p-6 bg-neutral-50 rounded-lg">
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <FontAwesomeIcon icon="book" className="text-4xl text-blue-600" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-neutral-900">
                  {stats.studentsWithYearbooks - stats.distributedYearbooks}
                </h3>
                <p className="text-neutral-600">Yearbooks Not Distributed</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-6 bg-neutral-50 rounded-lg">
              <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                <FontAwesomeIcon icon="clock" className="text-4xl text-yellow-600" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-neutral-900">
                  {stats.distributedYearbooks - stats.verifiedYearbooks}
                </h3>
                <p className="text-neutral-600">Awaiting Verification</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-6 bg-neutral-50 rounded-lg">
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <FontAwesomeIcon icon="check-circle" className="text-4xl text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-neutral-900">
                  {stats.verifiedYearbooks}
                </h3>
                <p className="text-neutral-600">Fully Processed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}