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
import { db } from "./db";
import { eq, desc, and, asc } from "drizzle-orm";

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

export class DatabaseStorage implements IStorage {
  // Student operations
  async getStudents(): Promise<Student[]> {
    return db.select().from(students);
  }

  async getStudentById(id: number): Promise<Student | undefined> {
    const result = await db.select().from(students).where(eq(students.id, id));
    return result[0];
  }

  async getStudentByStudentId(studentId: string): Promise<Student | undefined> {
    const result = await db.select().from(students).where(eq(students.studentId, studentId));
    return result[0];
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const result = await db.insert(students).values(student).returning();
    return result[0];
  }

  async updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined> {
    const result = await db.update(students).set(student).where(eq(students.id, id)).returning();
    return result[0];
  }

  async deleteStudent(id: number): Promise<boolean> {
    const result = await db.delete(students).where(eq(students.id, id)).returning({ id: students.id });
    return result.length > 0;
  }
  
  // Action logs operations
  async getLogs(limit?: number): Promise<ActionLog[]> {
    if (limit) {
      return db.select().from(actionLogs).orderBy(desc(actionLogs.timestamp)).limit(limit);
    }
    return db.select().from(actionLogs).orderBy(desc(actionLogs.timestamp));
  }

  async getLogsByStudentId(studentId: string): Promise<ActionLog[]> {
    return db.select()
      .from(actionLogs)
      .where(eq(actionLogs.studentId, studentId))
      .orderBy(desc(actionLogs.timestamp));
  }

  async createLog(log: InsertActionLog): Promise<ActionLog> {
    const result = await db.insert(actionLogs).values(log).returning();
    return result[0];
  }
  
  // Distribution operations
  async getDistributions(limit?: number): Promise<Distribution[]> {
    if (limit) {
      return db.select().from(distributions).orderBy(desc(distributions.timestamp)).limit(limit);
    }
    return db.select().from(distributions).orderBy(desc(distributions.timestamp));
  }

  async getDistributionsByStudentId(studentId: string): Promise<Distribution[]> {
    return db.select()
      .from(distributions)
      .where(eq(distributions.studentId, studentId))
      .orderBy(desc(distributions.timestamp));
  }

  async createDistribution(distribution: InsertDistribution): Promise<Distribution> {
    const result = await db.insert(distributions).values({
      ...distribution,
      verified: false,
    }).returning();
    return result[0];
  }

  async verifyDistribution(id: number, verifiedBy: string): Promise<Distribution | undefined> {
    const now = new Date();
    const result = await db.update(distributions)
      .set({ 
        verified: true,
        verifiedBy,
        verifiedAt: now
      })
      .where(eq(distributions.id, id))
      .returning();
    
    return result[0];
  }
  
  // Payment operations
  async getPayments(limit?: number): Promise<Payment[]> {
    if (limit) {
      return db.select().from(payments).orderBy(desc(payments.timestamp)).limit(limit);
    }
    return db.select().from(payments).orderBy(desc(payments.timestamp));
  }

  async getPaymentsByStudentId(studentId: string): Promise<Payment[]> {
    return db.select()
      .from(payments)
      .where(eq(payments.studentId, studentId))
      .orderBy(desc(payments.timestamp));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    // Start a transaction
    return db.transaction(async (tx) => {
      // Insert the payment
      const [newPayment] = await tx.insert(payments).values(payment).returning();
      
      // Update student balance
      const [student] = await tx.select().from(students).where(eq(students.studentId, payment.studentId));
      
      if (student) {
        const balance = parseFloat(student.balanceDue.toString());
        const paid = parseFloat(payment.amountPaid.toString());
        
        if (balance - paid <= 0) {
          await tx.update(students)
            .set({
              balanceDue: 0,
              paymentStatus: "Paid"
            })
            .where(eq(students.id, student.id));
        } else {
          await tx.update(students)
            .set({
              balanceDue: balance - paid
            })
            .where(eq(students.id, student.id));
        }
      }
      
      return newPayment;
    });
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
    
    // Use transaction for batch processing
    await db.transaction(async (tx) => {
      for (const student of students) {
        // Check if student already exists
        const existingResult = await tx.select()
          .from(students)
          .where(eq(students.studentId, student.studentId));
        
        const existing = existingResult[0];
        
        if (existing) {
          // Update existing student
          const [updated] = await tx.update(students)
            .set(student)
            .where(eq(students.id, existing.id))
            .returning();
          
          if (updated) imported.push(updated);
        } else {
          // Create new student
          const [created] = await tx.insert(students)
            .values(student)
            .returning();
          
          imported.push(created);
        }
      }
    });
    
    return imported;
  }
}

export const storage = new DatabaseStorage();
