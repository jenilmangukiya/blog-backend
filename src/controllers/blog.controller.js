import mongoose from "mongoose";
import { Blog } from "../models/blog.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  removeFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

export const getAllBlogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const aggregation = [];

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    aggregation.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  if (query) {
    aggregation.push({
      $match: {
        $or: [
          { title: { $regex: new RegExp(query, "i") } },
          { description: { $regex: new RegExp(query, "i") } },
        ],
      },
    });
  }

  if (sortBy && ["title", "desc", "createdAt"].includes(sortBy)) {
    const sortOrder = sortType.toLowerCase() === "desc" ? -1 : 1;
    aggregation.push({
      $sort: {
        [sortBy]: sortOrder,
      },
    });
  }

  const options = {
    page: +page,
    limit: +limit,
  };

  const pipeline = Blog.aggregate(aggregation);

  const blogPaginated = await Blog.aggregatePaginate(pipeline, options);

  res.status(200).json(new ApiResponse(200, blogPaginated));
});

export const publishBlog = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    throw new ApiError(400, "title and description is required");
  }

  const thumbnailLocal = req.file?.path;
  if (!thumbnailLocal) {
    throw new ApiError(400, "Thumbnail is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocal);
  if (!thumbnail) {
    throw new ApiError(500, "something went wrong while uploading Thumbnail");
  }

  const blog = await Blog.create({
    thumbnail: thumbnail?.url || "",
    owner: req.user?._id,
    title: title,
    description: description,
    isPublished: true,
  });

  res
    .status(201)
    .json(new ApiResponse(201, blog, "Blog uploaded successfully"));
});

export const getBlogById = asyncHandler(async (req, res) => {
  const { blogId } = req.params;

  // check if the Blog Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(blogId))
    throw new ApiError(404, "Invalid Blog");

  const blog = await Blog.findById(blogId);

  if (!blog) {
    throw new ApiError(404, null, "No Blog found");
  }
  res.status(200).json(new ApiResponse(200, blog, "success"));
});

export const updateBlog = asyncHandler(async (req, res) => {
  const { blogId } = req.params;

  // check if the Blog Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(blogId))
    throw new ApiError(404, "Invalid Blog");

  const oldBlog = await Blog.findById(blogId);

  if (req.user?.role !== "superadmin" && oldBlog?.owner !== req.user._id) {
    throw new ApiError(401, "unAuthorized to Update Blog");
  }

  const allowedFields = ["title", "description"];

  // Filter the update payload to include only allowed fields
  const filteredUpdate = Object.keys(req.body)
    .filter((key) => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = req.body[key];
      return obj;
    }, {});

  if (req.file?.path) {
    const thumbnail = await uploadOnCloudinary(req.file?.path);
    if (thumbnail) {
      filteredUpdate["thumbnail"] = thumbnail?.url;
      await removeFromCloudinary(oldBlog?.thumbnail);
    }
  }

  if (!Object.keys(filteredUpdate).length) {
    throw new ApiError(404, "Nothing to update");
  }

  const blog = await Blog.findByIdAndUpdate(
    blogId,
    { $set: filteredUpdate },
    { new: true }
  );

  res.status(200).json(new ApiResponse(200, blog, "Updated successfully"));
});

export const deleteBlog = asyncHandler(async (req, res) => {
  const { blogId } = req.params;

  // check if the Blog Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(blogId))
    throw new ApiError(404, "Invalid Blog");

  const blogDetails = await Blog.findById(blogId);
  if (!blogDetails) {
    throw new ApiError(404, "Blog Not found");
  }
  if (req.user?.role !== "superadmin" && blogDetails?.owner !== req.user._id) {
    throw new ApiError(401, "unAuthorized to Delete Blog");
  }

  const deletedBlog = await Blog.findByIdAndDelete(blogId);

  if (deletedBlog?.thumbnail)
    await removeFromCloudinary(deletedBlog?.thumbnail);

  res
    .status(200)
    .json(new ApiResponse(200, deletedBlog, "Deleted Successfully"));
});
