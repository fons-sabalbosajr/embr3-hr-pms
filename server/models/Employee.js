// models/Employee.js
import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  employeeId: String,
  name: String,
  position: String,
  department: String,
  salary: Number,
  dailyRate: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Employee', employeeSchema);
