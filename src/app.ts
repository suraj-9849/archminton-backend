import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import venueRoutes from './routes/venue.routes';
import courtRoutes from './routes/court.routes';
import bookingRoutes from './routes/booking.routes';
import societyRoutes from './routes/society.routes';
import courseRoutes from './routes/course.routes';

// Import admin routes
import reportRoutes from './routes/admin/report.routes';
import adminDashboardRoutes from './routes/admin/dashboard.routes';
import adminUserRoutes from './routes/admin/user.routes';
import adminVenueRoutes from './routes/admin/venue.routes';
import adminSocietyRoutes from './routes/admin/society.routes';
import adminCourtRoutes from './routes/admin/court.routes';
import adminBookingRoutes from './routes/admin/booking.routes';
import adminCourseRoutes from './routes/admin/course.routes';
import adminMembershipRoutes from './routes/admin/membership.routes';
import { membershipRoutes } from './routes/membership.routes';

// Add these route definitions to your existing app.ts after other admin routes
// Initialize Express app
const app = express();

// Define upload path
const UPLOAD_PATH = path.join(__dirname, '../uploads');

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Static file serving
app.use('/uploads', express.static(UPLOAD_PATH));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/societies', societyRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/membership', membershipRoutes);

// Admin Routes
app.use('/api/admin/membership', adminMembershipRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/venues', adminVenueRoutes);
app.use('/api/admin/societies', adminSocietyRoutes);
app.use('/api/admin/courts', adminCourtRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/courses', adminCourseRoutes);
app.use('/api/admin/reports', reportRoutes);

// Root route for API status
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Sports Booking API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      authentication: true,
      userManagement: true,
      venueManagement: true,
      courtManagement: true,
      bookingSystem: true,
      societyManagement: true,
      courseManagement: true,
      adminDashboard: true,
      roleBasedAccess: true
    }
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// API documentation endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    title: 'Sports Booking API',
    version: '1.0.0',
    description: 'Complete sports venue booking and management system',
    endpoints: {
      authentication: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        refreshToken: 'POST /api/auth/refresh-token',
        changePassword: 'POST /api/auth/change-password'
      },
      users: {
        profile: 'GET /api/users/profile',
        updateProfile: 'PUT /api/users/profile',
        societies: 'GET /api/users/societies',
        bookings: 'GET /api/users/bookings',
        courses: 'GET /api/users/courses'
      },
      venues: {
        list: 'GET /api/venues',
        details: 'GET /api/venues/:id',
        search: 'GET /api/venues/search',
        sports: 'GET /api/venues/:id/sports',
        courts: 'GET /api/venues/:id/courts'
      },
      courts: {
        list: 'GET /api/courts',
        details: 'GET /api/courts/:id',
        timeSlots: 'GET /api/courts/:id/timeslots'
      },
      bookings: {
        create: 'POST /api/bookings',
        details: 'GET /api/bookings/:id',
        availability: 'GET /api/bookings/availability',
        payment: 'POST /api/bookings/:id/payment',
        cancel: 'POST /api/bookings/:id/cancel'
      },
      courses: {
        list: 'GET /api/courses',
        details: 'GET /api/courses/:id',
        upcoming: 'GET /api/courses/upcoming',
        enroll: 'POST /api/courses/:id/enroll'
      },
      societies: {
        list: 'GET /api/societies',
        details: 'GET /api/societies/:id',
        members: 'GET /api/societies/:id/members'
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard/stats',
        users: 'GET /api/admin/users',
        venues: 'GET /api/admin/venues',
        societies: 'GET /api/admin/societies',
        courts: 'GET /api/admin/courts',
        bookings: 'GET /api/admin/bookings',
        courses: 'GET /api/admin/courses'
      }
    }
  });
});

// 404 Not Found middleware
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    suggestion: 'Check /api for available endpoints'
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

export default app;