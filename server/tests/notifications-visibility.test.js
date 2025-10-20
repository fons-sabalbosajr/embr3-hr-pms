import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Notification.deleteMany({});
});

describe('Dev notification visibility permissions', () => {
  it('allows developer to toggle dataVisible and forbids guest', async () => {
    // Create a developer user
    const dev = await User.create({
      name: 'Dev User',
      username: 'devuser',
      email: 'dev@example.com',
      password: 'hashed',
      userType: 'developer',
      isAdmin: false,
      canAccessDeveloper: true,
    });

    // Create a guest user
    const guest = await User.create({
      name: 'Guest User',
      username: 'guestuser',
      email: 'guest@example.com',
      password: 'hashed',
      userType: 'guest',
    });

    // Create a notification
    const notif = await Notification.create({ title: 'Test', body: 'Secret', dataVisible: true });

    // Generate tokens
    const devToken = jwt.sign({ id: dev._id }, process.env.JWT_SECRET);
    const guestToken = jwt.sign({ id: guest._id }, process.env.JWT_SECRET);

    // Developer should be able to toggle
    const devRes = await request(app)
      .put(`/api/dev/notifications/${notif._id}`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ dataVisible: false });

    expect(devRes.statusCode).toBe(200);
    expect(devRes.body.success).toBe(true);
    expect(devRes.body.data.dataVisible).toBe(false);

    // Guest should be forbidden
    const guestRes = await request(app)
      .put(`/api/dev/notifications/${notif._id}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ dataVisible: true });

    expect(guestRes.statusCode).toBe(403);
  });
});
