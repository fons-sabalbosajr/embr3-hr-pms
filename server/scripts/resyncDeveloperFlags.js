#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const ensureFlags = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const devUsers = await User.find({ $or: [{ userType: 'developer' }, { isAdmin: true }] });
    console.log(`Found ${devUsers.length} developer/admin users`);

    const devFlags = {
      isAdmin: true,
      canManageUsers: true,
      canViewDashboard: true,
      canViewEmployees: true,
      canEditEmployees: true,
      canViewDTR: true,
      canProcessDTR: true,
      canViewPayroll: true,
      canProcessPayroll: true,
      canViewTrainings: true,
      canEditTrainings: true,
      canAccessSettings: true,
      canChangeDeductions: true,
      canPerformBackup: true,
      canAccessNotifications: true,
      canManageNotifications: true,
      canViewNotifications: true,
      canViewMessages: true,
      canManageMessages: true,
      canAccessConfigSettings: true,
      canAccessDeveloper: true,
    };

    let updated = 0;
    for (const u of devUsers) {
      let dirty = false;
      Object.keys(devFlags).forEach((k) => {
        if (!u[k]) { u[k] = devFlags[k]; dirty = true; }
      });
      if (dirty) { await u.save(); updated++; }
    }

    console.log(`Updated ${updated} users`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
};

ensureFlags();
