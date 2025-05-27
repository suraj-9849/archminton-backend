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
import approvalRoutes from "./routes/approval.routes";

import reportRoutes from "./routes/admin/report.routes";
import adminDashboardRoutes from "./routes/admin/dashboard.routes";
import adminUserRoutes from "./routes/admin/user.routes";
import adminVenueRoutes from "./routes/admin/venue.routes";
import adminSocietyRoutes from "./routes/admin/society.routes";
import adminCourtRoutes from "./routes/admin/court.routes";
import adminBookingRoutes from "./routes/admin/booking.routes";
import adminCourseRoutes from "./routes/admin/course.routes";
import approvalAdminRoutes from "./routes/admin/approval.routes";

const app = express();

const PORT = process.env.PORT || 5000;
const UPLOAD_PATH = path.join(__dirname, "../uploads");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use("/uploads", express.static(UPLOAD_PATH));
app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/societies", societyRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/users/approvals", approvalRoutes);

app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/venues", adminVenueRoutes);
app.use("/api/admin/societies", adminSocietyRoutes);
app.use("/api/admin/courts", adminCourtRoutes);
app.use("/api/admin/bookings", adminBookingRoutes);
app.use("/api/admin/courses", adminCourseRoutes);
app.use("/api/admin/reports", reportRoutes);
app.use("/api/admin/approvals", approvalAdminRoutes);

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Sports Booking API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
  });
});

export default app;
