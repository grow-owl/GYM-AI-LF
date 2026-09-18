import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../modules/user/user.model';
import { Gym } from '../modules/gym/gym.model';
import { Branch } from '../modules/gym/branch.model';
import { Trainer } from '../modules/trainer/trainer.model';
import { Member } from '../modules/member/member.model';
import { Role } from '../common/constants/roles.enum';
import { GymPlan, GymStatus } from '../modules/gym/gym.types';
import { MembershipStatus } from '../modules/member/member.types';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI is missing in environment variables');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Super Admin
    const superAdminEmail = 'superadmin@superadmin.com';
    const superAdminPassword = 'Superadmin@123';

    let superAdmin = await User.findOne({ email: superAdminEmail });
    if (superAdmin) {
      superAdmin.password = superAdminPassword;
      superAdmin.role = Role.SUPER_ADMIN;
      superAdmin.fullName = 'Super Admin';
      superAdmin.isActive = true;
      superAdmin.isEmailVerified = true;
      superAdmin.isDeleted = false;
      await superAdmin.save();
      console.log(`✅ Super Admin updated: ${superAdminEmail}`);
    } else {
      superAdmin = new User({
        fullName: 'Super Admin',
        email: superAdminEmail,
        password: superAdminPassword,
        role: Role.SUPER_ADMIN,
        phone: '+919999900001',
        isActive: true,
        isEmailVerified: true,
        isDeleted: false,
      });
      await superAdmin.save();
      console.log(`✅ Super Admin created: ${superAdminEmail}`);
    }

    // 2. Admin / Gym Owner (Amar Fitness)
    const adminEmail = 'admin@amarfitness.com';
    const adminPassword = 'Admin@123';

    let admin = await User.findOne({ email: adminEmail });
    if (admin) {
      admin.fullName = 'Amar Admin';
      admin.password = adminPassword;
      admin.role = Role.GYM_OWNER;
      admin.isActive = true;
      admin.isEmailVerified = true;
      admin.isDeleted = false;
      await admin.save();
      console.log(`✅ Gym Owner (Admin) updated: ${adminEmail}`);
    } else {
      admin = new User({
        fullName: 'Amar Admin',
        email: adminEmail,
        password: adminPassword,
        role: Role.GYM_OWNER,
        phone: '+919999900002',
        isActive: true,
        isEmailVerified: true,
        isDeleted: false,
      });
      await admin.save();
      console.log(`✅ Gym Owner (Admin) created: ${adminEmail}`);
    }

    // 2b. Gym: Amar Fitness
    let gym = await Gym.findOne({ ownerId: admin._id });
    if (!gym) {
      gym = await Gym.findOne({ name: 'Amar Fitness' });
    }

    if (gym) {
      gym.name = 'Amar Fitness';
      gym.ownerId = admin._id;
      gym.billingEmail = adminEmail;
      gym.status = GymStatus.ACTIVE;
      gym.plan = GymPlan.PRO;
      gym.trialEndsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      gym.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await gym.save();
      console.log(`✅ Gym "Amar Fitness" updated`);
    } else {
      gym = new Gym({
        name: 'Amar Fitness',
        ownerId: admin._id,
        billingEmail: adminEmail,
        status: GymStatus.ACTIVE,
        plan: GymPlan.PRO,
        isMultiBranch: false,
        trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      await gym.save();
      console.log(`✅ Gym "Amar Fitness" created`);
    }

    // 2c. Primary Branch
    let branch = await Branch.findOne({ gymId: gym._id });
    if (branch) {
      branch.name = 'Amar Fitness - Pune Main Branch';
      branch.contactPhone = '+919999900002';
      branch.isActive = true;
      branch.isDeleted = false;
      await branch.save();
      console.log(`✅ Branch updated: ${branch.name}`);
    } else {
      branch = new Branch({
        gymId: gym._id,
        name: 'Amar Fitness - Pune Main Branch',
        contactPhone: '+919999900002',
        address: {
          line1: 'FC Road, Shivaji Nagar',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411004',
          country: 'India',
        },
        timezone: 'Asia/Kolkata',
        isPrimary: true,
        isActive: true,
        isDeleted: false,
      });
      await branch.save();
      console.log(`✅ Branch created: ${branch.name}`);
    }

    // Attach gym and branch to admin
    admin.gymId = gym._id;
    admin.branchId = branch._id;
    await admin.save();

    // 3. Manager (Branch Manager)
    const managerEmail = 'manager@amarfitness.com';
    const managerPassword = 'Manager@123';

    let manager = await User.findOne({ email: managerEmail });
    if (manager) {
      manager.fullName = 'Amar Manager';
      manager.password = managerPassword;
      manager.role = Role.BRANCH_MANAGER;
      manager.gymId = gym._id;
      manager.branchId = branch._id;
      manager.isActive = true;
      manager.isDeleted = false;
      await manager.save();
      console.log(`✅ Manager updated: ${managerEmail}`);
    } else {
      manager = new User({
        fullName: 'Amar Manager',
        email: managerEmail,
        password: managerPassword,
        role: Role.BRANCH_MANAGER,
        phone: '+919999900003',
        gymId: gym._id,
        branchId: branch._id,
        isActive: true,
        isEmailVerified: true,
        isDeleted: false,
      });
      await manager.save();
      console.log(`✅ Manager created: ${managerEmail}`);
    }

    branch.managerId = manager._id;
    await branch.save();

    // 4. Staff (Reception / Kiosk)
    const staffEmail = 'staff@amarfitness.com';
    const staffPassword = 'Staff@123';

    let staff = await User.findOne({ email: staffEmail });
    if (staff) {
      staff.fullName = 'Amar Staff';
      staff.password = staffPassword;
      staff.role = Role.KIOSK;
      staff.gymId = gym._id;
      staff.branchId = branch._id;
      staff.isActive = true;
      staff.isDeleted = false;
      await staff.save();
      console.log(`✅ Staff updated: ${staffEmail}`);
    } else {
      staff = new User({
        fullName: 'Amar Staff',
        email: staffEmail,
        password: staffPassword,
        role: Role.KIOSK,
        phone: '+919999900004',
        gymId: gym._id,
        branchId: branch._id,
        isActive: true,
        isEmailVerified: true,
        isDeleted: false,
      });
      await staff.save();
      console.log(`✅ Staff created: ${staffEmail}`);
    }

    // 5. Trainer
    const trainerEmail = 'trainer@amarfitness.com';
    const trainerPassword = 'Trainer@123';

    let trainerUser = await User.findOne({ email: trainerEmail });
    if (trainerUser) {
      trainerUser.fullName = 'Amar Trainer';
      trainerUser.password = trainerPassword;
      trainerUser.role = Role.TRAINER;
      trainerUser.gymId = gym._id;
      trainerUser.branchId = branch._id;
      trainerUser.isActive = true;
      trainerUser.isDeleted = false;
      await trainerUser.save();
      console.log(`✅ Trainer user updated: ${trainerEmail}`);
    } else {
      trainerUser = new User({
        fullName: 'Amar Trainer',
        email: trainerEmail,
        password: trainerPassword,
        role: Role.TRAINER,
        phone: '+919999900005',
        gymId: gym._id,
        branchId: branch._id,
        isActive: true,
        isEmailVerified: true,
        isDeleted: false,
      });
      await trainerUser.save();
      console.log(`✅ Trainer user created: ${trainerEmail}`);
    }

    let trainerDoc = await Trainer.findOne({ userId: trainerUser._id });
    if (trainerDoc) {
      trainerDoc.gymId = gym._id;
      trainerDoc.branchId = branch._id;
      trainerDoc.specializations = ['Strength Training', 'Bodybuilding', 'HIIT'];
      trainerDoc.bio = 'Senior Certified Fitness & Performance Coach at Amar Fitness.';
      trainerDoc.isDeleted = false;
      await trainerDoc.save();
      console.log(`✅ Trainer profile updated`);
    } else {
      trainerDoc = new Trainer({
        userId: trainerUser._id,
        gymId: gym._id,
        branchId: branch._id,
        specializations: ['Strength Training', 'Bodybuilding', 'HIIT'],
        bio: 'Senior Certified Fitness & Performance Coach at Amar Fitness.',
        certifications: [
          { name: 'ACE Certified Personal Trainer', issuedBy: 'ACE', year: 2021 },
          { name: 'Certified Sports Nutritionist', issuedBy: 'ISSA', year: 2022 },
        ],
        maxMemberCapacity: 25,
        isDeleted: false,
      });
      await trainerDoc.save();
      console.log(`✅ Trainer profile created`);
    }

    // 6. 4 Members with different weights
    const memberData = [
      {
        fullName: 'Vikram Malhotra',
        email: 'vikram@amarfitness.com',
        phone: '+919999900011',
        weight: 68,
        targetWeight: 64,
        height: 174,
        goals: ['Lean Muscle', 'Agility'],
        planName: 'Gold Annual Pro Membership',
      },
      {
        fullName: 'Ananya Sharma',
        email: 'ananya@amarfitness.com',
        phone: '+919999900012',
        weight: 56,
        targetWeight: 52,
        height: 164,
        goals: ['Core Strength', 'Fat Loss'],
        planName: 'Standard 6-Month Membership',
      },
      {
        fullName: 'Rohan Kulkarni',
        email: 'rohan@amarfitness.com',
        phone: '+919999900013',
        weight: 84,
        targetWeight: 78,
        height: 182,
        goals: ['Hypertrophy', 'Bench 100kg'],
        planName: 'Strength & Conditioning Pro',
      },
      {
        fullName: 'Deepak Verma',
        email: 'deepak@amarfitness.com',
        phone: '+919999900014',
        weight: 98,
        targetWeight: 82,
        height: 178,
        goals: ['Weight Loss', 'Cardiovascular Health'],
        planName: 'Fat Loss Transformation Pack',
      },
    ];

    const defaultMemberPassword = 'Member@123';

    for (const data of memberData) {
      let mUser = await User.findOne({ email: data.email });
      if (mUser) {
        mUser.fullName = data.fullName;
        mUser.password = defaultMemberPassword;
        mUser.role = Role.MEMBER;
        mUser.gymId = gym._id;
        mUser.branchId = branch._id;
        mUser.isActive = true;
        mUser.isDeleted = false;
        await mUser.save();
        console.log(`✅ Member user updated: ${data.email}`);
      } else {
        mUser = new User({
          fullName: data.fullName,
          email: data.email,
          password: defaultMemberPassword,
          role: Role.MEMBER,
          phone: data.phone,
          gymId: gym._id,
          branchId: branch._id,
          isActive: true,
          isEmailVerified: true,
          isDeleted: false,
        });
        await mUser.save();
        console.log(`✅ Member user created: ${data.email}`);
      }

      let mDoc = await Member.findOne({ userId: mUser._id });
      if (mDoc) {
        mDoc.gymId = gym._id;
        mDoc.branchId = branch._id;
        mDoc.assignedTrainerId = trainerDoc._id;
        mDoc.membershipStatus = MembershipStatus.ACTIVE;
        mDoc.planName = data.planName;
        mDoc.healthInfo = {
          height_cm: data.height,
          currentWeight_kg: data.weight,
          targetWeight_kg: data.targetWeight,
          medicalConditions: [],
          injuries: [],
        };
        mDoc.fitnessGoals = data.goals;
        mDoc.isDeleted = false;
        await mDoc.save();
        console.log(`✅ Member profile updated: ${data.fullName} (Weight: ${data.weight} kg)`);
      } else {
        mDoc = new Member({
          userId: mUser._id,
          gymId: gym._id,
          branchId: branch._id,
          assignedTrainerId: trainerDoc._id,
          membershipStatus: MembershipStatus.ACTIVE,
          membershipStartDate: new Date(),
          membershipEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          planName: data.planName,
          healthInfo: {
            height_cm: data.height,
            currentWeight_kg: data.weight,
            targetWeight_kg: data.targetWeight,
            medicalConditions: [],
            injuries: [],
          },
          fitnessGoals: data.goals,
          qrCode: `QR-${uuidv4().substring(0, 8).toUpperCase()}`,
          referralCode: `REF-${data.fullName.split(' ')[0].toUpperCase()}${Math.floor(100 + Math.random() * 900)}`,
          isDeleted: false,
        });
        await mDoc.save();
        console.log(`✅ Member profile created: ${data.fullName} (Weight: ${data.weight} kg)`);
      }
    }

    console.log('\n========================================');
    console.log('🎉 ALL USERS SEEDED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`Super Admin:  ${superAdminEmail} / ${superAdminPassword}`);
    console.log(`Gym Admin:    ${adminEmail} / ${adminPassword} (Gym: Amar Fitness)`);
    console.log(`Manager:      ${managerEmail} / ${managerPassword}`);
    console.log(`Staff:        ${staffEmail} / ${staffPassword}`);
    console.log(`Trainer:      ${trainerEmail} / ${trainerPassword}`);
    console.log('Members (Password: Member@123 for all):');
    memberData.forEach((m) => {
      console.log(`  - ${m.fullName}: ${m.email} | Weight: ${m.weight} kg (Target: ${m.targetWeight} kg)`);
    });
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
}

seed();
