import { Router } from "express";
import {
  changeCurrentPassword,
  loginUser,
  logout,
  refreshAccessToken,
  registerUser,
  getCurrentUser,
  updateProfilePic,
  updateUserInfo,
  deleteUser,
  getUsers,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);

router.route("/").get(verifyJWT, getUsers);
router
  .route("/:userId")
  .patch(verifyJWT, updateUserInfo)
  .delete(verifyJWT, deleteUser);
router
  .route("/updateProfilePic")
  .post(upload.single("avatar"), verifyJWT, updateProfilePic);
router.route("/addUser").post(verifyJWT, registerUser);
router.route("/getCurrentUser").get(verifyJWT, getCurrentUser);
router.route("/refreshAccessToken").post(verifyJWT, refreshAccessToken);
router.route("/changePassword").post(verifyJWT, changeCurrentPassword);
router.route("/logout").post(verifyJWT, logout);

export default router;
