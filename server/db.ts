import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Initialize database tables if they don't exist
export async function initializeDatabase() {
  try {
    // Simple connection test
    const testResult = await pool.query('SELECT NOW()');
    if (testResult.rows.length > 0) {
      log('Database connection successful', 'database');
    }
    
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL UNIQUE,
        last_name TEXT NOT NULL,
        first_name TEXT NOT NULL,
        order_entered_date TIMESTAMP DEFAULT NOW(),
        order_type TEXT,
        order_number TEXT,
        balance_due NUMERIC DEFAULT 0,
        payment_status TEXT DEFAULT 'Unpaid',
        yearbook BOOLEAN DEFAULT FALSE,
        personalization BOOLEAN DEFAULT FALSE,
        signature_package BOOLEAN DEFAULT FALSE, 
        clear_cover BOOLEAN DEFAULT FALSE,
        photo_pockets BOOLEAN DEFAULT FALSE,
        photo_url TEXT
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        action TEXT NOT NULL,
        student_id TEXT,
        details JSONB,
        station_name TEXT NOT NULL,
        operator_name TEXT NOT NULL
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS distributions (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        student_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        verified_by TEXT,
        verified_at TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        student_id TEXT NOT NULL,
        amount_paid NUMERIC NOT NULL,
        operator_name TEXT NOT NULL,
        bills JSONB NOT NULL,
        change_due NUMERIC NOT NULL,
        change_bills JSONB NOT NULL
      );
    `);
    
    // Check if students table is empty - this suggests it's a new database
    const studentCount = await pool.query('SELECT COUNT(*) FROM students');
    const isNewDb = parseInt(studentCount.rows[0].count) === 0;
    
    // Add system log only if it seems to be a new setup
    if (isNewDb) {
      log('Database initialized successfully', 'database');
      
      try {
        await pool.query(`
          INSERT INTO action_logs (action, operator_name, details) 
          VALUES ('SYSTEM', 'System', '{"message": "Database initialized successfully"}')
        `);
        return true;
      } catch (logError) {
        log(`Failed to add initialization log: ${logError}`, 'database');
        // Continue even if log entry fails
      }
    }
    
    return isNewDb;
  } catch (error) {
    log(`Database initialization error: ${error}`, 'database');
    // Don't rethrow - allow the application to continue
    return false;
  }
}
