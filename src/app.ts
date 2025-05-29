import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import venueRoutes from "./routes/venue.routes";
import courtRoutes from "./routes/court.routes";
import bookingRoutes from "./routes/booking.routes";
import societyRoutes from "./routes/society.routes";
import courseRoutes from "./routes/course.routes";
import membershipRequestRoutes from "./routes/membershipRequest.routes";


import reportRoutes from "./routes/admin/report.routes";
import adminDashboardRoutes from "./routes/admin/dashboard.routes";
import adminUserRoutes from "./routes/admin/user.routes";
import adminVenueRoutes from "./routes/admin/venue.routes";
import adminHolidayRoutes from "./routes/admin/holiday.routes";
import adminSocietyRoutes from "./routes/admin/society.routes";
import adminCourtRoutes from "./routes/admin/court.routes";
import adminBookingRoutes from "./routes/admin/booking.routes";
import adminCourseRoutes from "./routes/admin/course.routes";
import adminMembershipRoutes from "./routes/admin/membership.routes";
import adminMembershipRequestRoutes from "./routes/admin/membershipRequest.routes";
import { membershipRoutes } from "./routes/membership.routes";
import adminStaffRoutes from "./routes/admin/staff.routes";

const app = express();

const UPLOAD_PATH = path.join(__dirname, "../uploads");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use("/uploads", express.static(UPLOAD_PATH));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/societies", societyRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/membership-requests", membershipRequestRoutes);

// Admin Routes
app.use("/api/admin/membership", adminMembershipRoutes);
app.use("/api/admin/membership-requests", adminMembershipRequestRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/venues", adminVenueRoutes);
app.use("/api/admin/societies", adminSocietyRoutes);
app.use("/api/admin/holidays", adminHolidayRoutes);
app.use("/api/admin/staff", adminStaffRoutes);
app.use("/api/admin/courts", adminCourtRoutes);
app.use("/api/admin/bookings", adminBookingRoutes);
app.use("/api/admin/courses", adminCourseRoutes);
app.use("/api/admin/reports", reportRoutes);

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Archminton is running",
    version: "1.0.0",
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
      roleBasedAccess: true,
      membershipRequests: true,
    },
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: process.version,
  });
});

app.get("/api", (req: Request, res: Response) => {
  res.json({
    title: "Sports Booking API",
    version: "1.0.0",
    description: "Complete sports venue booking and management system",
    endpoints: {
      authentication: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        refreshToken: "POST /api/auth/refresh-token",
        changePassword: "POST /api/auth/change-password",
      },
      users: {
        profile: "GET /api/users/profile",
        updateProfile: "PUT /api/users/profile",
        societies: "GET /api/users/societies",
        bookings: "GET /api/users/bookings",
        courses: "GET /api/users/courses",
      },
      venues: {
        list: "GET /api/venues",
        details: "GET /api/venues/:id",
        search: "GET /api/venues/search",
        sports: "GET /api/venues/:id/sports",
        courts: "GET /api/venues/:id/courts",
      },
      courts: {
        list: "GET /api/courts",
        details: "GET /api/courts/:id",
        timeSlots: "GET /api/courts/:id/timeslots",
      },
      bookings: {
        create: "POST /api/bookings",
        details: "GET /api/bookings/:id",
        availability: "GET /api/bookings/availability",
        payment: "POST /api/bookings/:id/payment",
        cancel: "POST /api/bookings/:id/cancel",
      },
      courses: {
        list: "GET /api/courses",
        details: "GET /api/courses/:id",
        upcoming: "GET /api/courses/upcoming",
        enroll: "POST /api/courses/:id/enroll",
      },
      societies: {
        list: "GET /api/societies",
        details: "GET /api/societies/:id",
        members: "GET /api/societies/:id/members",
      },
      membershipRequests: {
        create: "POST /api/membership-requests",
        my: "GET /api/membership-requests",
        cancel: "DELETE /api/membership-requests/:id",
      },
      membership: {
        packages: "GET /api/membership/packages",
        details: "GET /api/membership/packages/:id",
        purchase: "POST /api/membership/purchase",
        status: "GET /api/membership/status",
        history: "GET /api/membership/history",
      },
      admin: {
        dashboard: "GET /api/admin/dashboard/stats",
        users: "GET /api/admin/users",
        venues: "GET /api/admin/venues",
        societies: "GET /api/admin/societies",
        courts: "GET /api/admin/courts",
        bookings: "GET /api/admin/bookings",
        courses: "GET /api/admin/courses",
        membership: "GET /api/admin/membership",
        membershipRequests: "GET /api/admin/membership-requests",
        holidays: "GET /api/admin/holidays",
        staff: "GET /api/admin/staff",
        reports: "GET /api/admin/reports",
      },
    },
  });
});

// 404 Not Found middleware
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    suggestion: "Check /api for available endpoints",
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

export default app;