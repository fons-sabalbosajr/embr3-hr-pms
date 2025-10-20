import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import User from '../models/User.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('POST /api/users/signup', () => {
  it('creates a new user with guest defaults and no elevated access', async () => {
    const payload = {
      name: 'Test Guest',
      username: 'guestuser',
      email: 'guest@example.com',
      password: 'Password123!'
    };

    const res = await request(app).post('/api/users/signup').send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/Signup successful/i);

    const user = await User.findOne({ email: payload.email }).lean();
    expect(user).toBeTruthy();
    expect(user.userType).toBe('guest');
    // All elevated flags should be falsy/false
    const elevatedFlags = [
      'isAdmin', 'canManageUsers', 'canViewDashboard', 'canViewEmployees', 'canEditEmployees',
      'canViewDTR', 'canProcessDTR', 'canViewPayroll', 'canProcessPayroll', 'canViewTrainings',
      'canEditTrainings', 'canAccessSettings', 'canChangeDeductions', 'canPerformBackup',
      'canAccessNotifications', 'canManageNotifications', 'canViewNotifications',
      'canViewMessages', 'canManageMessages', 'canAccessConfigSettings', 'canAccessDeveloper'
    ];

    elevatedFlags.forEach(flag => {
      expect(user[flag]).toBeFalsy();
    });

    // isVerified should be false until email verification
    expect(user.isVerified).toBe(false);
  });
});
