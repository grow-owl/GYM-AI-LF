import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../modules/user/user.model';
import { Role } from '../common/constants/roles.enum';

async function seedSuperAdmin() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI is missing in environment variables');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@gymai.com').toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

    let user = await User.findOne({ email });

    if (user) {
      console.log(`User ${email} already exists. Updating credentials...`);
      user.fullName = 'Super Admin';
      user.password = password; // Will be auto-hashed by pre-save hook
      user.role = Role.SUPER_ADMIN;
      user.phone = '+919999999999';
      user.isActive = true;
      user.isEmailVerified = true;
      user.isDeleted = false;
      await user.save();
      console.log(`✅ Super Admin updated successfully! Email: ${email}, Password: ${password}`);
    } else {
      console.log(`Creating new Super Admin user ${email}...`);
      user = new User({
        fullName: 'Super Admin',
        email: email.toLowerCase(),
        password: password, // Will be auto-hashed by pre-save hook
        role: Role.SUPER_ADMIN,
        phone: '+919999999999',
        isActive: true,
        isEmailVerified: true,
        isDeleted: false,
      });
      await user.save();
      console.log(`✅ Super Admin created successfully! Email: ${email}, Password: ${password}`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Super Admin Error:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
