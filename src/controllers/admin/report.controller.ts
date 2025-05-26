// controllers/admin/report.controller.ts
import { Request, Response } from 'express';
import { reportsService, ReportFilters } from '../../services/reports.service';

export class AdminReportController {
  // Bind all methods to maintain 'this' context
  getHandlers = async (req: Request, res: Response): Promise<void> => {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const handlers = await reportsService.getHandlers(venueId);
      
      res.status(200).json({
        success: true,
        data: handlers,
        message: 'Handlers retrieved successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error retrieving handlers'
      });
    }
  }

  getReportStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const stats = await reportsService.getReportStats(venueId);
      
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Report statistics retrieved successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error retrieving report statistics'
      });
    }
  }

  getMasterReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const report = await reportsService.getMasterReport(filters);
      
      res.status(200).json({
        success: true,
        data: report,
        message: 'Master report generated successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating master report'
      });
    }
  }

  downloadMasterReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const downloadFilters = { ...filters, page: undefined, limit: undefined };
      const report = await reportsService.getMasterReport(downloadFilters);
      
      const csvData = reportsService.generateCSV(report.data, 'master');
      const filename = `master_report_${filters.fromDate}_to_${filters.toDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error downloading master report'
      });
    }
  }

  getBookingReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      console.log('Booking report filters:', filters);
      
      const report = await reportsService.getBookingReport(filters);
      
      res.status(200).json({
        success: true,
        data: report,
        message: 'Booking report generated successfully'
      });
    } catch (error: any) {
      console.error('Error generating booking report:', error);
      console.error('Error stack:', error.stack);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating booking report',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  downloadBookingReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const downloadFilters = { ...filters, page: undefined, limit: undefined };
      const report = await reportsService.getBookingReport(downloadFilters);
      
      const csvData = reportsService.generateCSV(report.data, 'booking');
      const filename = `booking_report_${filters.fromDate}_to_${filters.toDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error downloading booking report'
      });
    }
  }

  getBalanceReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const report = await reportsService.getBalanceReport(filters);
      
      res.status(200).json({
        success: true,
        data: report,
        message: 'Balance report generated successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating balance report'
      });
    }
  }

  downloadBalanceReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const downloadFilters = { ...filters, page: undefined, limit: undefined };
      const report = await reportsService.getBalanceReport(downloadFilters);
      
      const csvData = reportsService.generateCSV(report.data, 'balance');
      const filename = `balance_report_${filters.fromDate}_to_${filters.toDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error downloading balance report'
      });
    }
  }

  getCancellationReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const report = await reportsService.getCancellationReport(filters);
      
      res.status(200).json({
        success: true,
        data: report,
        message: 'Cancellation report generated successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating cancellation report'
      });
    }
  }

  downloadCancellationReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const downloadFilters = { ...filters, page: undefined, limit: undefined };
      const report = await reportsService.getCancellationReport(downloadFilters);
      
      const csvData = reportsService.generateCSV(report.data, 'cancellation');
      const filename = `cancellation_report_${filters.fromDate}_to_${filters.toDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error downloading cancellation report'
      });
    }
  }

  getRechargeReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const report = await reportsService.getRechargeReport(filters);
      
      res.status(200).json({
        success: true,
        data: report,
        message: 'Recharge report generated successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating recharge report'
      });
    }
  }

  downloadRechargeReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const downloadFilters = { ...filters, page: undefined, limit: undefined };
      const report = await reportsService.getRechargeReport(downloadFilters);
      
      const csvData = reportsService.generateCSV(report.data, 'recharge');
      const filename = `recharge_report_${filters.fromDate}_to_${filters.toDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error downloading recharge report'
      });
    }
  }

  getCreditsReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const report = await reportsService.getCreditsReport(filters);
      
      res.status(200).json({
        success: true,
        data: report,
        message: 'Credits report generated successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating credits report'
      });
    }
  }

  downloadCreditsReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const downloadFilters = { ...filters, page: undefined, limit: undefined };
      const report = await reportsService.getCreditsReport(downloadFilters);
      
      const csvData = reportsService.generateCSV(report.data, 'credits');
      const filename = `credits_report_${filters.fromDate}_to_${filters.toDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error downloading credits report'
      });
    }
  }

  getAddonReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const report = await reportsService.getAddonReport(filters);
      
      res.status(200).json({
        success: true,
        data: report,
        message: 'Add-on report generated successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating addon report'
      });
    }
  }

  downloadAddonReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = this.extractFilters(req);
      const downloadFilters = { ...filters, page: undefined, limit: undefined };
      const report = await reportsService.getAddonReport(downloadFilters);
      
      const csvData = reportsService.generateCSV(report.data, 'addon');
      const filename = `addon_report_${filters.fromDate}_to_${filters.toDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error downloading addon report'
      });
    }
  }

  // Also make extractFilters an arrow function to maintain context
  private extractFilters = (req: Request): ReportFilters => {
    const {
      fromDate,
      toDate,
      venueId,
      period,
      dateRangeFor,
      handler,
      show,
      page,
      limit
    } = req.query;

    return {
      fromDate: fromDate as string,
      toDate: toDate as string,
      venueId: venueId ? Number(venueId) : undefined,
      period: period as ReportFilters['period'],
      dateRangeFor: dateRangeFor as ReportFilters['dateRangeFor'],
      handler: handler as string,
      show: show as ReportFilters['show'],
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
  }
}

export default new AdminReportController();