import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { log } from "./vite";
import { eq } from 'drizzle-orm';
import { actionLogs } from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  log('Connected to database', 'database');
});

export const db = drizzle(pool, { schema });

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function initializeDatabase() {
  let retries = 5;
  while (retries > 0) {
    try {
      // Simple connection test
      const testResult = await pool.query('SELECT NOW()');
      if (testResult.rows.length > 0) {
        log('Database connection successful', 'database');

        // Test student table
        const studentTest = await pool.query('SELECT COUNT(*) FROM students');
        log(`Found ${studentTest.rows[0].count} students in database`, 'database');
      }

      // Check if tables exist using direct SQL query
      try {
        const tableCheckResult = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'students'
          );
        `);

        const tablesExist = tableCheckResult.rows[0]?.exists || false;

        // If tables don't exist yet, create them
        if (!tablesExist) {
          log('Creating database tables using SQL...', 'database');

          await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
              id SERIAL PRIMARY KEY,
              student_id TEXT NOT NULL UNIQUE,
              last_name TEXT NOT NULL,
              first_name TEXT NOT NULL,
              order_entered_date TIMESTAMP DEFAULT NOW(),
              order_type TEXT NOT NULL,
              order_number TEXT NOT NULL,
              balance_due NUMERIC(10, 2) NOT NULL,
              payment_status TEXT NOT NULL,
              yearbook BOOLEAN NOT NULL DEFAULT FALSE,
              personalization BOOLEAN NOT NULL DEFAULT FALSE,
              signature_package BOOLEAN NOT NULL DEFAULT FALSE, 
              clear_cover BOOLEAN NOT NULL DEFAULT FALSE,
              photo_pockets BOOLEAN NOT NULL DEFAULT FALSE,
              photo_url TEXT
            );

            CREATE TABLE IF NOT EXISTS action_logs (
              id SERIAL PRIMARY KEY,
              timestamp TIMESTAMP DEFAULT NOW(),
              action TEXT NOT NULL,
              student_id TEXT,
              details JSONB,
              station_name TEXT NOT NULL,
              operator_name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS distributions (
              id SERIAL PRIMARY KEY,
              timestamp TIMESTAMP DEFAULT NOW(),
              student_id TEXT NOT NULL,
              operator_name TEXT NOT NULL,
              verified BOOLEAN NOT NULL DEFAULT FALSE,
              verified_by TEXT,
              verified_at TIMESTAMP
            );

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

            CREATE TABLE IF NOT EXISTS operators (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              created_at TIMESTAMP DEFAULT NOW(),
              active BOOLEAN NOT NULL DEFAULT TRUE,
              permissions JSONB NOT NULL DEFAULT '{"distribution": false, "checker": false, "cash": false}'
            );
          `);

          // After creating tables, add a system log
          log('Database initialized successfully', 'database');

          try {
            await pool.query(`
              INSERT INTO action_logs (action, station_name, operator_name, details) 
              VALUES ('SYSTEM', 'System', 'System', '{"message": "Database initialized successfully"}')
            `);
            return true;
          } catch (logError) {
            log(`Failed to add initialization log: ${logError}`, 'database');
            // Continue even if log entry fails
          }
        } else {
          log('Database tables already exist', 'database');
        }

        return true;  // Database is initialized and ready
      } catch (schemaError) {
        log(`Schema check error: ${schemaError}`, 'database');
        // Continue anyway - tables may exist already
      }

      // Default return if we get this far
      return true;
    } catch (error) {
      log(`Database initialization error: ${error}`, 'database');
      retries--;
      if (retries > 0) {
        log(`Database connection failed, retrying in 5 seconds... (${retries} attempts remaining)`, 'database');
        await sleep(5000);
      }
    }
  }
  return false;
}