import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { revalidateWebsite } from "../../utils/revalidateWebsite";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { Admin } from "../../models/Admin.model";
import {
  getBlogPostsService,
  getBlogPostByIdOrSlugService,
  isBlogLive,
  createBlogPostService,
  updateBlogPostService,
  deleteBlogPostService,
} from "./blogPost.service";

/** A request carrying a valid admin token (the admin panel's editor and preview) */
const isAdminRequest = (req: Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  try {
    jwt.verify(header.slice(7), env.ACCESS_TOKEN_SECRET);
    return true;
  } catch {
    return false;
  }
};

export const getBlogPosts = asyncHandler(async (req: Request, res: Response) => {
  // Visitors always get live posts only; the admin panel (with its token) can list drafts too
  const filters = isAdminRequest(req) ? req.query : { ...req.query, status: "published" };
  const result = await getBlogPostsService(filters);
  return res.status(200).json(
    new ApiResponse(200, "Blog posts retrieved successfully", result)
  );
});

export const getBlogPostByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
  const idOrSlug = String(req.params.idOrSlug);
  const isPublicView = req.query.view === "true" || req.query.view === "1";
  const admin = isAdminRequest(req);
  // Visitors only read live posts; a draft or a not-yet-due scheduled post is admin-only.
  // Checked before counting the view, so a hidden post is never counted.
  const post = await getBlogPostByIdOrSlugService(idOrSlug, false);

  if (!post || (!admin && !isBlogLive(post))) {
    throw ApiError.notFound(`Blog post with identifier '${idOrSlug}' not found`);
  }
  if (isPublicView && !admin) {
    post.views = (post.views || 0) + 1;
    await post.save();
  }

  return res.status(200).json(
    new ApiResponse(200, "Blog post retrieved successfully", post)
  );
});

export const createBlogPost = asyncHandler(async (req: Request, res: Response) => {
  const { title, content } = req.body;
  if (!title || !title.trim()) {
    throw ApiError.badRequest("Blog title is required");
  }
  if (!content || !content.trim()) {
    throw ApiError.badRequest("Detailed blog description is required");
  }

  // Fetch logged-in admin name
  let updatedBy = req.body.updatedBy || "";
  if (!updatedBy && req.user?.id) {
    try {
      const adminDoc = await Admin.findById(req.user.id).select("name");
      if (adminDoc?.name) updatedBy = adminDoc.name;
    } catch {}
  }

  const post = await createBlogPostService({ ...req.body, updatedBy });
  revalidateWebsite();
  return res.status(201).json(
    new ApiResponse(201, "Blog post created successfully", post)
  );
});

export const updateBlogPost = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);

  // Fetch logged-in admin name
  let updatedBy = req.body.updatedBy || "";
  if (!updatedBy && req.user?.id) {
    try {
      const adminDoc = await Admin.findById(req.user.id).select("name");
      if (adminDoc?.name) updatedBy = adminDoc.name;
    } catch {}
  }

  const post = await updateBlogPostService(id, { ...req.body, updatedBy });
  revalidateWebsite();

  if (!post) {
    throw ApiError.notFound(`Blog post with ID '${id}' not found`);
  }

  return res.status(200).json(
    new ApiResponse(200, "Blog post updated successfully", post)
  );
});

export const deleteBlogPost = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const post = await deleteBlogPostService(id);
  revalidateWebsite();

  if (!post) {
    throw ApiError.notFound(`Blog post with ID '${id}' not found`);
  }

  return res.status(200).json(
    new ApiResponse(200, "Blog post deleted successfully", { deleted: true })
  );
});
