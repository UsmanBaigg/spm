#!/usr/bin/env node

/**
 * Automated Backup System for Trust & Rating Module
 * Supports MongoDB, Supabase, and file system backups
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

class BackupSystem {
  constructor() {
    this.config = {
      backupDir: process.env.BACKUP_DIR || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
      mongodbUri: process.env.MONGODB_URI,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      compressionEnabled: process.env.COMPRESSION_ENABLED !== 'false',
      s3Bucket: process.env.S3_BACKUP_BUCKET,
      s3Region: process.env.S3_REGION,
      slackWebhook: process.env.SLACK_BACKUP_WEBHOOK,
    };

    this.supabase = null;
    this.init();
  }

  async init() {
    try {
      // Create backup directory
      await fs.mkdir(this.config.backupDir, { recursive: true });
      
      // Initialize Supabase client
      if (this.config.supabaseUrl && this.config.supabaseKey) {
        this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
      }

      console.log('✅ Backup system initialized');
    } catch (error) {
      console.error('❌ Failed to initialize backup system:', error);
    }
  }

  /**
   * Create timestamped backup directory
   */
  createBackupDir() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.config.backupDir, `backup-${timestamp}`);
  }

  /**
   * Backup MongoDB database
   */
  async backupMongoDB(backupDir) {
    if (!this.config.mongodbUri) {
      console.log('⚠️ MongoDB URI not configured, skipping MongoDB backup');
      return null;
    }

    try {
      console.log('🔄 Starting MongoDB backup...');
      
      const mongoBackupDir = path.join(backupDir, 'mongodb');
      await fs.mkdir(mongoBackupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(mongoBackupDir, `mongodb-${timestamp}.archive`);

      // Use mongodump for backup
      const command = `mongodump --uri="${this.config.mongodbUri}" --archive="${backupFile}" --gzip`;
      
      await execAsync(command);
      
      console.log('✅ MongoDB backup completed');
      return backupFile;
    } catch (error) {
      console.error('❌ MongoDB backup failed:', error);
      throw error;
    }
  }

  /**
   * Backup Supabase data
   */
  async backupSupabase(backupDir) {
    if (!this.supabase) {
      console.log('⚠️ Supabase not configured, skipping Supabase backup');
      return null;
    }

    try {
      console.log('🔄 Starting Supabase backup...');
      
      const supabaseBackupDir = path.join(backupDir, 'supabase');
      await fs.mkdir(supabaseBackupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Backup all tables
      const tables = ['ratings', 'reviews', 'trust_scores', 'users', 'profiles'];
      const backupData = {};

      for (const table of tables) {
        try {
          const { data, error } = await this.supabase
            .from(table)
            .select('*');

          if (error) {
            console.warn(`⚠️ Warning: Could not backup table ${table}:`, error.message);
            continue;
          }

          backupData[table] = data;
          console.log(`✅ Backed up table: ${table} (${data.length} records)`);
        } catch (error) {
          console.error(`❌ Error backing up table ${table}:`, error);
        }
      }

      // Save backup data
      const backupFile = path.join(supabaseBackupDir, `supabase-${timestamp}.json`);
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));

      console.log('✅ Supabase backup completed');
      return backupFile;
    } catch (error) {
      console.error('❌ Supabase backup failed:', error);
      throw error;
    }
  }

  /**
   * Backup application files
   */
  async backupFiles(backupDir) {
    try {
      console.log('🔄 Starting file backup...');
      
      const filesBackupDir = path.join(backupDir, 'files');
      await fs.mkdir(filesBackupDir, { recursive: true });

      // Files to backup
      const filesToBackup = [
        'package.json',
        'server.js',
        'README.md',
        '.env.example',
        'frontend/package.json',
        'frontend/src',
        'config',
        'scripts',
        'docs'
      ];

      for (const file of filesToBackup) {
        try {
          const sourcePath = path.join(process.cwd(), file);
          const destPath = path.join(filesBackupDir, file);
          
          await this.copyRecursive(sourcePath, destPath);
          console.log(`✅ Backed up: ${file}`);
        } catch (error) {
          console.warn(`⚠️ Warning: Could not backup ${file}:`, error.message);
        }
      }

      console.log('✅ File backup completed');
      return filesBackupDir;
    } catch (error) {
      console.error('❌ File backup failed:', error);
      throw error;
    }
  }

  /**
   * Recursively copy files and directories
   */
  async copyRecursive(source, dest) {
    const stat = await fs.stat(source);
    
    if (stat.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const items = await fs.readdir(source);
      
      for (const item of items) {
        await this.copyRecursive(
          path.join(source, item),
          path.join(dest, item)
        );
      }
    } else {
      await fs.copyFile(source, dest);
    }
  }

  /**
   * Compress backup directory
   */
  async compressBackup(backupDir) {
    if (!this.config.compressionEnabled) {
      return backupDir;
    }

    try {
      console.log('🔄 Compressing backup...');
      
      const compressedFile = `${backupDir}.tar.gz`;
      
      // Create tar.gz archive
      await execAsync(`tar -czf "${compressedFile}" -C "${path.dirname(backupDir)}" "${path.basename(backupDir)}"`);
      
      // Remove uncompressed directory
      await fs.rm(backupDir, { recursive: true });
      
      console.log('✅ Backup compressed');
      return compressedFile;
    } catch (error) {
      console.error('❌ Compression failed:', error);
      return backupDir; // Return uncompressed if compression fails
    }
  }

  /**
   * Upload backup to S3
   */
  async uploadToS3(backupFile) {
    if (!this.config.s3Bucket) {
      console.log('⚠️ S3 not configured, skipping S3 upload');
      return null;
    }

    try {
      console.log('🔄 Uploading to S3...');
      
      const fileName = path.basename(backupFile);
      const s3Key = `backups/${fileName}`;
      
      // Use AWS CLI for upload
      const command = `aws s3 cp "${backupFile}" "s3://${this.config.s3Bucket}/${s3Key}" --region ${this.config.s3Region}`;
      
      await execAsync(command);
      
      console.log('✅ Uploaded to S3');
      return `s3://${this.config.s3Bucket}/${s3Key}`;
    } catch (error) {
      console.error('❌ S3 upload failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups() {
    try {
      console.log('🔄 Cleaning up old backups...');
      
      const files = await fs.readdir(this.config.backupDir);
      const now = Date.now();
      const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.config.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > retentionMs) {
          await fs.rm(filePath, { recursive: true });
          deletedCount++;
          console.log(`🗑️ Deleted old backup: ${file}`);
        }
      }
      
      console.log(`✅ Cleaned up ${deletedCount} old backups`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Send notification about backup status
   */
  async sendNotification(status, details) {
    if (!this.config.slackWebhook) {
      console.log('⚠️ Slack webhook not configured, skipping notification');
      return;
    }

    try {
      const message = {
        text: `Backup ${status}`,
        attachments: [{
          color: status === 'success' ? 'good' : 'danger',
          fields: [
            { title: 'Status', value: status, short: true },
            { title: 'Timestamp', value: new Date().toISOString(), short: true },
            { title: 'Details', value: details, short: false }
          ]
        }]
      };

      await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      console.log('✅ Notification sent');
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
    }
  }

  /**
   * Perform complete backup
   */
  async performBackup() {
    const startTime = Date.now();
    let backupFile = null;
    let s3Location = null;

    try {
      console.log('🚀 Starting backup process...');
      
      const backupDir = this.createBackupDir();
      await fs.mkdir(backupDir, { recursive: true });

      // Perform all backups
      await this.backupMongoDB(backupDir);
      await this.backupSupabase(backupDir);
      await this.backupFiles(backupDir);

      // Compress backup
      backupFile = await this.compressBackup(backupDir);

      // Upload to S3
      s3Location = await this.uploadToS3(backupFile);

      // Cleanup old backups
      await this.cleanupOldBackups();

      const duration = Math.round((Date.now() - startTime) / 1000);
      const details = `Duration: ${duration}s | File: ${path.basename(backupFile)} | S3: ${s3Location || 'Not uploaded'}`;
      
      await this.sendNotification('success', details);
      
      console.log(`✅ Backup completed successfully in ${duration}s`);
      return { success: true, backupFile, s3Location, duration };
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const details = `Duration: ${duration}s | Error: ${error.message}`;
      
      await this.sendNotification('failure', details);
      
      console.error('❌ Backup failed:', error);
      return { success: false, error, duration };
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupFile) {
    try {
      console.log('🔄 Starting restore process...');
      
      // Extract backup if compressed
      if (backupFile.endsWith('.tar.gz')) {
        const extractDir = backupFile.replace('.tar.gz', '');
        await execAsync(`tar -xzf "${backupFile}" -C "${path.dirname(backupFile)}"`);
        backupFile = extractDir;
      }

      // Restore MongoDB
      const mongoBackup = path.join(backupFile, 'mongodb');
      if (await fs.access(mongoBackup).then(() => true).catch(() => false)) {
        const archives = await fs.readdir(mongoBackup);
        for (const archive of archives) {
          if (archive.endsWith('.archive')) {
            const archivePath = path.join(mongoBackup, archive);
            await execAsync(`mongorestore --uri="${this.config.mongodbUri}" --archive="${archivePath}" --gzip`);
            console.log(`✅ Restored MongoDB from ${archive}`);
          }
        }
      }

      // Restore Supabase
      const supabaseBackup = path.join(backupFile, 'supabase');
      if (await fs.access(supabaseBackup).then(() => true).catch(() => false)) {
        const backups = await fs.readdir(supabaseBackup);
        for (const backup of backups) {
          if (backup.endsWith('.json')) {
            const backupPath = path.join(supabaseBackup, backup);
            const data = JSON.parse(await fs.readFile(backupPath, 'utf8'));
            
            for (const [table, records] of Object.entries(data)) {
              if (records.length > 0) {
                await this.supabase.from(table).upsert(records);
                console.log(`✅ Restored Supabase table ${table} (${records.length} records)`);
              }
            }
          }
        }
      }

      console.log('✅ Restore completed successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Restore failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Start scheduled backups
   */
  startScheduledBackups() {
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🕐 Starting scheduled daily backup...');
      await this.performBackup();
    });

    // Weekly backup on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      console.log('🕐 Starting scheduled weekly backup...');
      // Additional weekly backup logic if needed
      await this.performBackup();
    });

    console.log('✅ Scheduled backups started');
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const backupSystem = new BackupSystem();
  const command = process.argv[2];

  switch (command) {
    case 'backup':
      backupSystem.performBackup();
      break;
    case 'restore':
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.error('❌ Please provide backup file path');
        process.exit(1);
      }
      backupSystem.restoreBackup(backupFile);
      break;
    case 'schedule':
      backupSystem.startScheduledBackups();
      console.log('🕐 Backup scheduler started. Press Ctrl+C to stop.');
      break;
    default:
      console.log('Usage: node backup.js [backup|restore|schedule] [backup-file]');
      process.exit(1);
  }
}

export default BackupSystem;
