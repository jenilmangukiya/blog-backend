import { Router } from "express";
import {
  loginUser,
  logout,
  refreshAccessToken,
  registerUser,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);

router.route("/refreshAccessToken").post(verifyJWT, refreshAccessToken);
router.route("/logout").post(verifyJWT, logout);

export default router;
