import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupWebSocketServer, broadcastMessage } from "./ws";
import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  insertStudentSchema,
  insertActionLogSchema,
  insertDistributionSchema,
  insertPaymentSchema,
  paymentProcessSchema,
  csvMappingSchema,
  Distribution,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  setupWebSocketServer(httpServer);

  // Database status check route
  app.get("/api/database/status", async (_req: Request, res: Response) => {
    try {
      // Check if database is connected and initialized
      const result = await pool.query("SELECT NOW()");

      // Check if tables exist
      const studentTableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'students'
        );
      `);

      const tablesExist = studentTableResult.rows[0]?.exists || false;
      const serverTime = result.rows[0]?.now || new Date().toISOString();

      let message = "Database connection established.";
      if (tablesExist) {
        message += " All required tables are present.";
      } else {
        message += " Database structure is being initialized.";
      }

      res.json({
        status: "ok",
        message,
        serverTime,
        tablesInitialized: tablesExist,
      });
    } catch (error) {
      console.error("Database status check failed:", error);
      res.status(500).json({
        status: "error",
        message: "Database connection failed.",
      });
    }
  });

  // Get all students
  app.get("/api/students", async (req: Request, res: Response) => {
    try {
      const students = await storage.getStudents();
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Get student by ID
  app.get("/api/students/:studentId", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const student = await storage.getStudentByStudentId(studentId);

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      res.json(student);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch student" });
    }
  });

  // Create a new student
  app.post("/api/students", async (req: Request, res: Response) => {
    try {
      // Keep balance as string since that's what the schema expects
      const studentData = {
        ...req.body,
      };

      const validatedData = insertStudentSchema.parse(studentData);
      const student = await storage.createStudent(validatedData);

      // Log the action
      await storage.createLog({
        studentId: student.studentId,
        action: "CREATE_STUDENT",
        details: { student },
        stationName: "Ruby Station",
        operatorName: req.body.operatorName || "System",
      });

      res.status(201).json(student);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res
          .status(400)
          .json({ error: "Invalid student data", details: error.errors });
      }
      console.error("Error creating student:", error);
      res
        .status(500)
        .json({
          error: "Failed to create student",
          message: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Update a student
  app.put("/api/students/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const existingStudent = await storage.getStudentById(id);

      if (!existingStudent) {
        return res.status(404).json({ error: "Student not found" });
      }

      const studentData = insertStudentSchema.partial().parse(req.body);
      const student = await storage.updateStudent(id, studentData);

      if (!student) {
        return res
          .status(404)
          .json({ error: "Failed to update student - not found" });
      }

      // Log the action
      await storage.createLog({
        studentId: existingStudent.studentId,
        action: "UPDATE_STUDENT",
        details: { student },
        stationName: "Ruby Station",
        operatorName: req.body.operatorName || "System",
      });

      res.json(student);
    } catch (error) {
      console.error("Error updating student:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid student data", details: error.errors });
      }
      res.status(500).json({
        error: "Failed to update student",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Delete a student
  app.delete("/api/students/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const student = await storage.getStudentById(id);

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const deleted = await storage.deleteStudent(id);

      if (deleted) {
        // Log the action
        await storage.createLog({
          studentId: student.studentId,
          action: "DELETE_STUDENT",
          details: { student },
          stationName: "Ruby Station",
          operatorName: req.body.operatorName,
        });

        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to delete student" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  // Get logs
  app.get("/api/logs", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const logs = await storage.getLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Get logs by student ID
  app.get(
    "/api/logs/student/:studentId",
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const logs = await storage.getLogsByStudentId(studentId);
        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch logs" });
      }
    },
  );

  // Create a log
  app.post("/api/logs", async (req: Request, res: Response) => {
    try {
      const logData = insertActionLogSchema.parse(req.body);
      const log = await storage.createLog(logData);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid log data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create log" });
    }
  });

  // Get distributions
  app.get("/api/distributions", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const distributions = await storage.getDistributions(limit);
      res.json(distributions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch distributions" });
    }
  });

  // Get distributions by student ID
  app.get(
    "/api/distributions/student/:studentId",
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const distributions =
          await storage.getDistributionsByStudentId(studentId);
        res.json(distributions);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch distributions" });
      }
    },
  );

  // Create a distribution
  app.post("/api/distributions", async (req: Request, res: Response) => {
    try {
      const distributionData = insertDistributionSchema.parse(req.body);

      // Check if student exists
      const student = await storage.getStudentByStudentId(
        distributionData.studentId.toString(),
      );
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const distribution = await storage.createDistribution(distributionData);

      // Log the action
      const actionLog = await storage.createLog({
        studentId: distribution.studentId,
        action: "CREATE_DISTRIBUTION",
        details: { distribution },
        stationName: "Distribution Station",
        operatorName: distribution.operatorName,
      });

      // Broadcast distribution event
      broadcastMessage({
        type: "NEW_DISTRIBUTION",
        data: distribution,
      });

      // Also broadcast log event
      broadcastMessage({
        type: "LOG_ACTION",
        data: actionLog,
      });

      res.status(201).json(distribution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid distribution data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create distribution" });
    }
  });

  // Verify a distribution
  app.put(
    "/api/distributions/:id/verify",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const { verifiedBy } = req.body;

        if (!verifiedBy) {
          return res.status(400).json({ error: "Verified by is required" });
        }

        const distribution = await storage.verifyDistribution(id, verifiedBy);

        if (!distribution) {
          return res.status(404).json({ error: "Distribution not found" });
        }

        // Log the action
        const actionLog = await storage.createLog({
          studentId: distribution.studentId,
          action: "VERIFY_DISTRIBUTION",
          details: { distribution },
          stationName: "Checkers Station",
          operatorName: verifiedBy,
        });

        // Broadcast verification event
        broadcastMessage({
          type: "VERIFY_DISTRIBUTION",
          data: distribution,
        });

        // Also broadcast log event
        broadcastMessage({
          type: "LOG_ACTION",
          data: actionLog,
        });

        res.json(distribution);
      } catch (error) {
        res.status(500).json({ error: "Failed to verify distribution" });
      }
    },
  );

  // Get payments
  app.get("/api/payments", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const payments = await storage.getPayments(limit);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Get payments by student ID
  app.get(
    "/api/payments/student/:studentId",
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const payments = await storage.getPaymentsByStudentId(studentId);
        res.json(payments);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch payments" });
      }
    },
  );

  // Process a payment
  app.post("/api/payments/process", async (req: Request, res: Response) => {
    try {
      const paymentData = paymentProcessSchema.parse(req.body);

      // Check if student exists, if not create one
      let student = await storage.getStudentByStudentId(paymentData.studentId);

      if (!student) {
        // Extract first and last name from studentName
        const nameParts = paymentData.studentName.split(" ");
        const lastName = nameParts.length > 1 ? nameParts.pop() || "" : "";
        const firstName = nameParts.join(" ");

        // Create a new student
        student = await storage.createStudent({
          studentId: paymentData.studentId,
          firstName,
          lastName,
          orderEnteredDate: new Date(),
          orderType: "Cash Payment",
          orderNumber: `POS-${Date.now().toString().slice(-6)}`,
          balanceDue: "0", // Will be updated after payment
          paymentStatus: "Unpaid", // Will be updated after payment
          yearbook: true,
          personalization: false,
          signaturePackage: false,
          clearCover: false,
          photoPockets: false,
          photoUrl: null,
        });

        // Log new student creation
        const actionLog = await storage.createLog({
          studentId: student.studentId,
          action: "CREATE_STUDENT",
          details: { student },
          stationName: "Cash Station",
          operatorName: paymentData.operatorName,
        });

        // Broadcast student creation
        broadcastMessage({
          type: "LOG_ACTION",
          data: actionLog,
        });
      }

      const payment = await storage.processPayment(paymentData);

      // Log the action
      const actionLog = await storage.createLog({
        studentId: payment.studentId,
        action: "PROCESS_PAYMENT",
        details: { payment },
        stationName: "Cash Station",
        operatorName: payment.operatorName,
      });

      // Broadcast payment event
      broadcastMessage({
        type: "NEW_PAYMENT",
        data: payment,
      });

      // Also broadcast log event
      broadcastMessage({
        type: "LOG_ACTION",
        data: actionLog,
      });

      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid payment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // Import students from CSV
  app.post("/api/students/import", async (req: Request, res: Response) => {
    try {
      // Check if this is an array or an object with mappings & csvData
      let studentsToImport = [];
      let operatorName = "Ruby Station";
      
      if (Array.isArray(req.body)) {
        // Direct array of student data
        studentsToImport = req.body;
      } else if (req.body && req.body.csvData && Array.isArray(req.body.csvData)) {
        // Format with mappings and csvData
        studentsToImport = req.body.csvData;
        if (req.body.operatorName) {
          operatorName = req.body.operatorName;
        }
      } else {
        return res.status(400).json({ error: "Invalid import data format" });
      }
      
      if (studentsToImport.length === 0) {
        return res.status(400).json({ error: "No students to import" });
      }

      // Import students
      const importedStudents = await storage.importStudents(studentsToImport);

      // Log the action
      await storage.createLog({
        studentId: null,
        action: "IMPORT_STUDENTS",
        details: { 
          count: importedStudents.length,
          total: studentsToImport.length 
        },
        stationName: "Ruby Station",
        operatorName: operatorName,
      });

      res.json({
        success: importedStudents.length,
        total: studentsToImport.length,
        errors: studentsToImport.length - importedStudents.length,
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Failed to import students" });
    }
  });

  // Issue a free book
  app.post(
    "/api/students/:studentId/free-book",
    async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const { operatorName } = req.body;

        if (!operatorName) {
          return res.status(400).json({ error: "Operator name is required" });
        }

        // Check if student exists
        const student = await storage.getStudentByStudentId(studentId);
        if (!student) {
          return res.status(404).json({ error: "Student not found" });
        }

        // Update student
        const updatedStudent = await storage.updateStudent(student.id, {
          balanceDue: "0",
          paymentStatus: "PAID",
          yearbook: true,
        });

        // Create a distribution
        const distribution = await storage.createDistribution({
          studentId,
          operatorName,
        });

        // Immediately verify the distribution to mark as "Confirmed"
        const verifiedDistribution = await storage.verifyDistribution(
          distribution.id,
          operatorName,
        );

        // Log the action
        const actionLog = await storage.createLog({
          studentId,
          action: "FREE_BOOK",
          details: {
            student: updatedStudent,
            distribution: verifiedDistribution,
          },
          stationName: "Ruby Station",
          operatorName,
        });

        // Only broadcast if verification succeeded
        if (verifiedDistribution) {
          // Broadcast as verified distribution event
          broadcastMessage({
            type: "VERIFY_DISTRIBUTION",
            data: verifiedDistribution,
          });
        } else {
          // Fallback to broadcast as regular distribution if verification failed
          broadcastMessage({
            type: "NEW_DISTRIBUTION",
            data: distribution,
          });
        }

        // Also broadcast log event
        broadcastMessage({
          type: "LOG_ACTION",
          data: actionLog,
        });

        res.json({
          student: updatedStudent,
          distribution: verifiedDistribution,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to issue free book" });
      }
    },
  );

  // Wipe all students from the database
  app.delete("/api/database/wipe", async (req: Request, res: Response) => {
    try {
      const { operatorName } = req.body;
      
      if (!operatorName) {
        return res.status(400).json({ error: "Operator name is required" });
      }
      
      // Get all students first to record in log
      const students = await storage.getStudents();
      
      if (!students || students.length === 0) {
        return res.status(404).json({ error: "No students found to delete" });
      }
      
      // Track success/failure
      let successCount = 0;
      let errors = [];
      
      // Delete each student
      for (const student of students) {
        try {
          const deleted = await storage.deleteStudent(student.id);
          if (deleted) {
            successCount++;
          } else {
            errors.push(`Failed to delete student ID: ${student.id}`);
          }
        } catch (err) {
          errors.push(`Error deleting student ID ${student.id}: ${err}`);
        }
      }
      
      // Log the mass deletion
      await storage.createLog({
        action: "WIPE_DATABASE",
        details: { 
          totalStudents: students.length,
          successfullyDeleted: successCount,
          errors: errors.length > 0 ? errors : undefined
        },
        stationName: "Ruby Station",
        operatorName: operatorName,
      });
      
      res.json({ 
        success: true,
        totalStudents: students.length,
        deleted: successCount,
        errors: errors.length
      });
    } catch (error) {
      console.error("Error wiping database:", error);
      res.status(500).json({ error: "Failed to wipe database" });
    }
  });

  // Wipe checkers data (all distributions) 
  app.delete("/api/database/wipe-checkers", async (req: Request, res: Response) => {
    try {
      const { operatorName } = req.body;
      if (!operatorName) {
        return res.status(400).json({ error: "Operator name is required" });
      }
      
      // Get all distributions before deletion
      const allDistributions = await storage.getDistributions();
      
      // Delete all distributions
      const { pool } = await import("./db");
      const result = await pool.query("DELETE FROM distributions");
      
      // Log the action
      await storage.createLog({
        studentId: "SYSTEM",
        action: "WIPE_CHECKERS",
        details: { 
          count: allDistributions.length,
          success: result.rowCount,
          operator: operatorName
        },
        stationName: "Ruby Station",
        operatorName
      });
      
      res.json({ 
        success: true,
        totalDistributions: allDistributions.length,
        wiped: result.rowCount,
        errors: 0
      });
    } catch (error) {
      console.error("Error wiping checkers data:", error);
      res.status(500).json({ error: "Failed to wipe checkers data" });
    }
  });
  
  // Wipe system logs
  app.delete("/api/database/wipe-logs", async (req: Request, res: Response) => {
    try {
      const { operatorName } = req.body;
      if (!operatorName) {
        return res.status(400).json({ error: "Operator name is required" });
      }
      
      // Get all logs count before deletion
      const allLogs = await storage.getLogs();
      
      // Use direct database query to delete logs except system logs
      const { pool } = await import("./db");
      const result = await pool.query(
        "DELETE FROM action_logs WHERE student_id <> 'SYSTEM'"
      );
      
      // Log the action (this log will remain after wiping)
      await storage.createLog({
        studentId: "SYSTEM",
        action: "WIPE_LOGS",
        details: { 
          count: allLogs.length,
          success: result.rowCount,
          operator: operatorName
        },
        stationName: "Ruby Station",
        operatorName
      });
      
      res.json({ 
        success: true,
        totalLogs: allLogs.length,
        wiped: result.rowCount,
        errors: 0
      });
    } catch (error) {
      console.error("Error wiping system logs:", error);
      res.status(500).json({ error: "Failed to wipe system logs" });
    }
  });

  return httpServer;
}
