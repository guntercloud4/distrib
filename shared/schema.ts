import { pgTable, text, serial, integer, boolean, timestamp, varchar, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Student table with yearbook details
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").notNull().unique(),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  orderEnteredDate: timestamp("order_entered_date").notNull().defaultNow(),
  orderType: text("order_type").notNull(),
  orderNumber: text("order_number").notNull(),
  balanceDue: numeric("balance_due", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").notNull(),
  yearbook: boolean("yearbook").notNull().default(false),
  personalization: boolean("personalization").notNull().default(false),
  signaturePackage: boolean("signature_package").notNull().default(false),
  clearCover: boolean("clear_cover").notNull().default(false),
  photoPockets: boolean("photo_pockets").notNull().default(false),
  photoUrl: text("photo_url"),
});

// Action logs table
export const actionLogs = pgTable("action_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  studentId: text("student_id"),
  action: text("action").notNull(),
  details: jsonb("details"),
  stationName: text("station_name").notNull(),
  operatorName: text("operator_name").notNull(),
});

// Distribution logs table
export const distributions = pgTable("distributions", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  studentId: text("student_id").notNull(),
  operatorName: text("operator_name").notNull(),
  verified: boolean("verified").notNull().default(false),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at"),
});

// Payments table
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  studentId: text("student_id").notNull(),
  amountPaid: numeric("amount_paid").notNull(),
  operatorName: text("operator_name").notNull(),
  bills: jsonb("bills").notNull(),
  changeDue: numeric("change_due").notNull(),
  changeBills: jsonb("change_bills").notNull(),
});

// Operators table
// Define a default permissions object
const defaultPermissions = {
  distribution: false,
  checker: false,
  cash: false,
  ruby: false
};

export const operators = pgTable("operators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  permissions: jsonb("permissions").$type<OperatorPermissions>().notNull().default(defaultPermissions),
});

// Insert schema types
export const insertStudentSchema = createInsertSchema(students)
  .omit({
    id: true,
  })
  .extend({
    balanceDue: z.union([z.string(), z.number()]).transform(val => 
      typeof val === 'string' ? val : val.toString()
    ),
  });

export const insertActionLogSchema = createInsertSchema(actionLogs).omit({
  id: true,
  timestamp: true,
});

export const insertDistributionSchema = createInsertSchema(distributions).omit({
  id: true,
  timestamp: true,
  verified: true,
  verifiedBy: true,
  verifiedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  timestamp: true,
});

// Define operator permissions schema
export const operatorPermissionsSchema = z.object({
  distribution: z.boolean().default(false),
  checker: z.boolean().default(false),
  cash: z.boolean().default(false),
  ruby: z.boolean().default(false)
});

export type OperatorPermissions = z.infer<typeof operatorPermissionsSchema>;

export const insertOperatorSchema = createInsertSchema(operators).omit({
  id: true,
  createdAt: true,
}).extend({
  permissions: operatorPermissionsSchema
});

// Custom schema for payment processing
export const paymentProcessSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  amountDue: z.number(),
  bills: z.object({
    one: z.number().min(0),
    five: z.number().min(0),
    ten: z.number().min(0),
    twenty: z.number().min(0),
    fifty: z.number().min(0),
    hundred: z.number().min(0),
  }),
  operatorName: z.string(),
});

// CSV upload schema
export const csvMappingSchema = z.object({
  studentIdField: z.string(),
  lastNameField: z.string(),
  firstNameField: z.string(),
  orderTypeField: z.string(),
  orderNumberField: z.string(),
  balanceDueField: z.string(),
  paymentStatusField: z.string(),
  yearbookField: z.string().optional(),
  personalizationField: z.string().optional(),
  signaturePackageField: z.string().optional(),
  clearCoverField: z.string().optional(),
  photoPocketsField: z.string().optional(),
});

// Export types
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type ActionLog = typeof actionLogs.$inferSelect;
export type InsertActionLog = z.infer<typeof insertActionLogSchema>;
export type Distribution = typeof distributions.$inferSelect;
export type InsertDistribution = z.infer<typeof insertDistributionSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Operator = typeof operators.$inferSelect;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type PaymentProcess = z.infer<typeof paymentProcessSchema>;
export type CsvMapping = z.infer<typeof csvMappingSchema>;

// Types for WebSocket events
export type WebSocketMessage = {
  type: 'LOG_ACTION' | 'NEW_DISTRIBUTION' | 'VERIFY_DISTRIBUTION' | 'NEW_PAYMENT';
  data: ActionLog | Distribution | Payment;
};
