import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { revalidateWebsite } from "../../utils/revalidateWebsite";
import {
  createBlogReportService,
  deleteBlogReportService,
  downloadBlogReportService,
  listBlogReportsService,
  listPublicBlogReportsService,
  updateBlogReportService,
} from "./blogReport.service";

// GET /api/blog-reports — website: published reports in order
export const getPublicBlogReports = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog reports", await listPublicBlogReportsService()));
});

// GET /api/blog-reports/admin — every report, for the admin panel
export const getBlogReports = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog reports", await listBlogReportsService()));
});

// GET /api/blog-reports/:id/download — counts the download and sends the browser to the PDF
export const downloadBlogReport = asyncHandler(async (req: Request, res: Response) => {
  res.redirect(302, await downloadBlogReportService(String(req.params.id)));
});

export const createBlogReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await createBlogReportService(req.body);
  revalidateWebsite();
  res.status(201).json(new ApiResponse(201, "Report added", report));
});

export const updateBlogReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await updateBlogReportService(String(req.params.id), req.body);
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Report saved", report));
});

export const deleteBlogReport = asyncHandler(async (req: Request, res: Response) => {
  await deleteBlogReportService(String(req.params.id));
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Report deleted", { deleted: true }));
});
