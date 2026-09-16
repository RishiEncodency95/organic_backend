import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { Admin } from "../../models/Admin.model";
import {
  getBlogPostsService,
  getBlogPostByIdOrSlugService,
  createBlogPostService,
  updateBlogPostService,
  deleteBlogPostService,
} from "./blogPost.service";

export const getBlogPosts = asyncHandler(async (req: Request, res: Response) => {
  const result = await getBlogPostsService(req.query);
  return res.status(200).json(
    new ApiResponse(200, "Blog posts retrieved successfully", result)
  );
});

export const getBlogPostByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
  const idOrSlug = String(req.params.idOrSlug);
  const isPublicView = req.query.view === "true" || req.query.view === "1";
  const post = await getBlogPostByIdOrSlugService(idOrSlug, isPublicView);

  if (!post) {
    throw ApiError.notFound(`Blog post with identifier '${idOrSlug}' not found`);
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

  if (!post) {
    throw ApiError.notFound(`Blog post with ID '${id}' not found`);
  }

  return res.status(200).json(
    new ApiResponse(200, "Blog post deleted successfully", { deleted: true })
  );
});
