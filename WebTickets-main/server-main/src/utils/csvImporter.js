import fs from 'fs';
import csv from 'csv-parser';
import { db } from '../db/database.js';

export async function importCSV() {
  try {
    const exists = await db.get('SELECT COUNT(*) as c FROM tickets');
    if (exists.c > 0) return;

    await db.exec('BEGIN TRANSACTION');

    return new Promise((resolve, reject) => {
      const stream = fs
        .createReadStream('./ITSM_data.csv')
        .pipe(csv());

      stream.on('data', (row) => {
        stream.pause();

        db.run(
          `INSERT OR IGNORE INTO tickets VALUES (null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.CI_Name,
            row.CI_Cat,
            row.CI_Subcat,
            row.Status,
            row.Impact,
            row.Urgency,
            row.Priority,
            row.Category,
            row.Open_Time,
            row.Resolved_Time,
            row.Close_Time,
            row.Closure_Code
          ]
        ).then(() => stream.resume())
         .catch(reject);
      });

      stream.on('end', async () => {
        try {
          await db.exec('COMMIT');
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', reject);
    });
  } catch (error) {
    console.error('Failed to import CSV:', error);
    throw error;
  }
}
