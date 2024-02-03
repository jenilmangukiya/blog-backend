import { Router } from "express";
import {
  deleteBlog,
  getAllBlogs,
  getBlogById,
  publishBlog,
  updateBlog,
} from "../controllers/blog.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(verifyJWT, getAllBlogs)
  .post(verifyJWT, upload.single("thumbnail"), publishBlog);

router
  .route("/:blogId")
  .get(verifyJWT, getBlogById)
  .patch(verifyJWT, upload.single("thumbnail"), updateBlog)
  .delete(verifyJWT, deleteBlog);

export default router;
