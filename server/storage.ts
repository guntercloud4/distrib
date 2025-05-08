import {
  students,
  Student,
  InsertStudent,
  actionLogs,
  ActionLog,
  InsertActionLog,
  distributions,
  Distribution,
  InsertDistribution,
  payments,
  Payment,
  InsertPayment,
  PaymentProcess
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // Student operations
  getStudents(): Promise<Student[]>;
  getStudentById(id: number): Promise<Student | undefined>;
  getStudentByStudentId(studentId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(id: number): Promise<boolean>;
  
  // Action logs operations
  getLogs(limit?: number): Promise<ActionLog[]>;
  getLogsByStudentId(studentId: string): Promise<ActionLog[]>;
  createLog(log: InsertActionLog): Promise<ActionLog>;
  
  // Distribution operations
  getDistributions(limit?: number): Promise<Distribution[]>;
  getDistributionsByStudentId(studentId: string): Promise<Distribution[]>;
  createDistribution(distribution: InsertDistribution): Promise<Distribution>;
  verifyDistribution(id: number, verifiedBy: string): Promise<Distribution | undefined>;
  
  // Payment operations
  getPayments(limit?: number): Promise<Payment[]>;
  getPaymentsByStudentId(studentId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  
  // Processing functions
  processPayment(paymentData: PaymentProcess): Promise<Payment>;
  
  // CSV operations
  importStudents(students: InsertStudent[]): Promise<Student[]>;
}

export class MemStorage implements IStorage {
  private studentsList: Map<number, Student>;
  private actionLogsList: Map<number, ActionLog>;
  private distributionsList: Map<number, Distribution>;
  private paymentsList: Map<number, Payment>;
  
  private studentIdCounter: number;
  private logIdCounter: number;
  private distributionIdCounter: number;
  private paymentIdCounter: number;

  constructor() {
    this.studentsList = new Map();
    this.actionLogsList = new Map();
    this.distributionsList = new Map();
    this.paymentsList = new Map();
    
    this.studentIdCounter = 1;
    this.logIdCounter = 1;
    this.distributionIdCounter = 1;
    this.paymentIdCounter = 1;
  }

  // Student operations
  async getStudents(): Promise<Student[]> {
    return Array.from(this.studentsList.values());
  }

  async getStudentById(id: number): Promise<Student | undefined> {
    return this.studentsList.get(id);
  }

  async getStudentByStudentId(studentId: string): Promise<Student | undefined> {
    return Array.from(this.studentsList.values()).find(
      (student) => student.studentId === studentId
    );
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const id = this.studentIdCounter++;
    const now = new Date();
    const newStudent: Student = { ...student, id, orderEnteredDate: student.orderEnteredDate || now };
    this.studentsList.set(id, newStudent);
    return newStudent;
  }

  async updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined> {
    const existingStudent = this.studentsList.get(id);
    if (!existingStudent) return undefined;
    
    const updatedStudent = { ...existingStudent, ...student };
    this.studentsList.set(id, updatedStudent);
    return updatedStudent;
  }

  async deleteStudent(id: number): Promise<boolean> {
    return this.studentsList.delete(id);
  }
  
  // Action logs operations
  async getLogs(limit?: number): Promise<ActionLog[]> {
    const logs = Array.from(this.actionLogsList.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? logs.slice(0, limit) : logs;
  }

  async getLogsByStudentId(studentId: string): Promise<ActionLog[]> {
    return Array.from(this.actionLogsList.values())
      .filter((log) => log.studentId === studentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createLog(log: InsertActionLog): Promise<ActionLog> {
    const id = this.logIdCounter++;
    const now = new Date();
    const newLog: ActionLog = { ...log, id, timestamp: now };
    this.actionLogsList.set(id, newLog);
    return newLog;
  }
  
  // Distribution operations
  async getDistributions(limit?: number): Promise<Distribution[]> {
    const distributions = Array.from(this.distributionsList.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? distributions.slice(0, limit) : distributions;
  }

  async getDistributionsByStudentId(studentId: string): Promise<Distribution[]> {
    return Array.from(this.distributionsList.values())
      .filter((distribution) => distribution.studentId === studentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createDistribution(distribution: InsertDistribution): Promise<Distribution> {
    const id = this.distributionIdCounter++;
    const now = new Date();
    const newDistribution: Distribution = { 
      ...distribution, 
      id, 
      timestamp: now,
      verified: false,
      verifiedBy: null,
      verifiedAt: null
    };
    this.distributionsList.set(id, newDistribution);
    return newDistribution;
  }

  async verifyDistribution(id: number, verifiedBy: string): Promise<Distribution | undefined> {
    const distribution = this.distributionsList.get(id);
    if (!distribution) return undefined;
    
    const now = new Date();
    const verifiedDistribution: Distribution = {
      ...distribution,
      verified: true,
      verifiedBy,
      verifiedAt: now
    };
    
    this.distributionsList.set(id, verifiedDistribution);
    return verifiedDistribution;
  }
  
  // Payment operations
  async getPayments(limit?: number): Promise<Payment[]> {
    const payments = Array.from(this.paymentsList.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? payments.slice(0, limit) : payments;
  }

  async getPaymentsByStudentId(studentId: string): Promise<Payment[]> {
    return Array.from(this.paymentsList.values())
      .filter((payment) => payment.studentId === studentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = this.paymentIdCounter++;
    const now = new Date();
    const newPayment: Payment = { ...payment, id, timestamp: now };
    this.paymentsList.set(id, newPayment);
    
    // Update student balance
    const student = await this.getStudentByStudentId(payment.studentId);
    if (student) {
      const balance = parseFloat(student.balanceDue.toString());
      const paid = parseFloat(payment.amountPaid.toString());
      
      if (balance - paid <= 0) {
        await this.updateStudent(student.id, {
          balanceDue: 0,
          paymentStatus: "Paid"
        });
      } else {
        await this.updateStudent(student.id, {
          balanceDue: balance - paid,
        });
      }
    }
    
    return newPayment;
  }
  
  // Processing functions
  async processPayment(paymentData: PaymentProcess): Promise<Payment> {
    // Calculate total amount received
    const bills = paymentData.bills;
    const totalReceived = 
      bills.one * 1 +
      bills.five * 5 +
      bills.ten * 10 +
      bills.twenty * 20 +
      bills.fifty * 50 +
      bills.hundred * 100;
    
    // Calculate change due
    const changeDue = totalReceived - paymentData.amountDue;
    
    // Calculate change bills breakdown
    const changeBills = this.calculateChange(changeDue);
    
    // Create payment record
    const payment: InsertPayment = {
      studentId: paymentData.studentId,
      amountPaid: paymentData.amountDue,
      operatorName: paymentData.operatorName,
      bills: bills,
      changeDue,
      changeBills
    };
    
    return this.createPayment(payment);
  }
  
  // Calculate change bills breakdown
  private calculateChange(amount: number): Record<string, number> {
    let remaining = amount;
    const result: Record<string, number> = {
      hundred: 0,
      fifty: 0,
      twenty: 0,
      ten: 0,
      five: 0,
      one: 0
    };
    
    // Calculate number of each bill denomination needed
    if (remaining >= 100) {
      result.hundred = Math.floor(remaining / 100);
      remaining %= 100;
    }
    
    if (remaining >= 50) {
      result.fifty = Math.floor(remaining / 50);
      remaining %= 50;
    }
    
    if (remaining >= 20) {
      result.twenty = Math.floor(remaining / 20);
      remaining %= 20;
    }
    
    if (remaining >= 10) {
      result.ten = Math.floor(remaining / 10);
      remaining %= 10;
    }
    
    if (remaining >= 5) {
      result.five = Math.floor(remaining / 5);
      remaining %= 5;
    }
    
    result.one = Math.floor(remaining);
    
    return result;
  }
  
  // CSV operations
  async importStudents(students: InsertStudent[]): Promise<Student[]> {
    const imported: Student[] = [];
    
    for (const student of students) {
      // Check if student already exists
      const existing = await this.getStudentByStudentId(student.studentId);
      
      if (existing) {
        // Update existing student
        const updated = await this.updateStudent(existing.id, student);
        if (updated) imported.push(updated);
      } else {
        // Create new student
        const created = await this.createStudent(student);
        imported.push(created);
      }
    }
    
    return imported;
  }
}

export const storage = new MemStorage();
