import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SecurePassword123!';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPassword, salt);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'System Administrator',
      password: hashedPassword,
      role: Role.SUPERADMIN,
    },
  });

  console.log(`Admin user created/updated: ${admin.email}`);

  // Create venue manager user
  const managerEmail = 'manager@example.com';
  const managerPassword = await bcrypt.hash('Manager123!', salt);

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {},
    create: {
      email: managerEmail,
      name: 'Venue Manager',
      password: managerPassword,
      role: Role.VENUE_MANAGER,
    },
  });

  console.log(`Venue manager created/updated: ${manager.email}`);

  // Create regular user
  const userEmail = 'user@example.com';
  const userPassword = await bcrypt.hash('User123!', salt);

  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: {},
    create: {
      email: userEmail,
      name: 'Regular User',
      password: userPassword,
      role: Role.USER,
    },
  });

  console.log(`Regular user created/updated: ${user.email}`);

  // Create a sample society
  const society = await prisma.society.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Green Valley Society',
      location: 'Green Valley, Park Street',
      description: 'A premium residential society with sports facilities',
      contactPerson: 'John Doe',
      contactPhone: '+1234567890',
    },
  });

  console.log(`Society created/updated: ${society.name}`);

  // Add user as society member
  const membership = await prisma.societyMember.upsert({
    where: { 
      userId_societyId: {
        userId: user.id,
        societyId: society.id
      }
    },
    update: {},
    create: {
      userId: user.id,
      societyId: society.id,
    },
  });

  console.log(`Society membership created for user: ${user.email}`);

  // Create sample venue (public)
  const publicVenue = await prisma.venue.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'City Sports Complex',
      location: 'Downtown, Main Street',
      description: 'Public sports facility with multiple courts',
      contactPhone: '+9876543210',
      contactEmail: 'info@citysports.com',
      venueType: 'PUBLIC',
      latitude: 18.5204,
      longitude: 73.8567,
    },
  });

  console.log(`Public venue created/updated: ${publicVenue.name}`);

  // Create sample venue image
  await prisma.venueImage.upsert({
    where: { id: 1 },
    update: {},
    create: {
      venueId: publicVenue.id,
      imageUrl: 'default-venue-image.jpg',
      isDefault: true
    }
  });

  // Create sample venue (private, society-linked)
  const privateVenue = await prisma.venue.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Green Valley Sports Club',
      location: 'Green Valley, Park Street',
      description: 'Private sports facility for society members',
      contactPhone: '+1234567890',
      contactEmail: 'sports@greenvalley.com',
      venueType: 'PRIVATE',
      societyId: society.id,
      latitude: 18.5304,
      longitude: 73.8467,
    },
  });

  console.log(`Private venue created/updated: ${privateVenue.name}`);
  
  // Create venue image for private venue
  await prisma.venueImage.upsert({
    where: { id: 2 },
    update: {},
    create: {
      venueId: privateVenue.id,
      imageUrl: 'private-venue-image.jpg',
      isDefault: true
    }
  });

  // Create venue access for manager
  await prisma.venueUserAccess.upsert({
    where: { 
      venueId_userId: {
        venueId: publicVenue.id,
        userId: manager.id
      }
    },
    update: {},
    create: {
      venueId: publicVenue.id,
      userId: manager.id,
    },
  });

  console.log(`Venue access granted to manager for: ${publicVenue.name}`);

  // Create sample courts for public venue
  const courts = [
    {
      name: 'Badminton Court 1',
      sportType: 'BADMINTON',
      pricePerHour: 500,
      venueId: publicVenue.id
    },
    {
      name: 'Tennis Court 1',
      sportType: 'TENNIS',
      pricePerHour: 800,
      venueId: publicVenue.id
    },
    {
      name: 'Basketball Court',
      sportType: 'BASKETBALL',
      pricePerHour: 700,
      venueId: publicVenue.id
    }
  ];

  for (const court of courts) {
    const createdCourt = await prisma.court.upsert({
      where: { 
        id: courts.indexOf(court) + 1
      },
      update: {},
      create: {
        name: court.name,
        sportType: court.sportType as any,
        pricePerHour: court.pricePerHour,
        venueId: court.venueId,
      },
    });
    
    console.log(`Court created/updated: ${createdCourt.name}`);
    
    // Create time slots for each court
    const timeSlots = [
      { startTime: '06:00', endTime: '07:00', dayOfWeek: 1 },
      { startTime: '07:00', endTime: '08:00', dayOfWeek: 1 },
      { startTime: '08:00', endTime: '09:00', dayOfWeek: 1 },
      { startTime: '06:00', endTime: '07:00', dayOfWeek: 2 },
      { startTime: '07:00', endTime: '08:00', dayOfWeek: 2 },
      { startTime: '08:00', endTime: '09:00', dayOfWeek: 2 },
    ];
    
    for (const slot of timeSlots) {
      await prisma.timeSlot.upsert({
        where: { 
          courtId_dayOfWeek_startTime_endTime: {
            courtId: createdCourt.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime
          }
        },
        update: {},
        create: {
          courtId: createdCourt.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });
    }
    
    console.log(`Time slots created for court: ${createdCourt.name}`);
  }

  // Create sample course
  const course = await prisma.course.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Badminton Beginner Course',
      description: 'Learn badminton basics with our experts',
      sportType: 'BADMINTON',
      venueId: publicVenue.id,
      price: 5000,
      duration: 30,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`Course created/updated: ${course.name}`);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });