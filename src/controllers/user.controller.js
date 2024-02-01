import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName?.trim() || !email?.trim() || !password?.trim()) {
    throw new ApiError(400, "All fields are required");
  }

  const checkUserAlreadyExist = await User.findOne({
    email,
  });

  if (checkUserAlreadyExist) {
    throw new ApiError(400, "User already exists with this email");
  }

  const user = await User.create({
    email: email.trim().toLowerCase(),
    fullName: fullName.trim().toLowerCase(),
    password: password,
    role: "user",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(400, "Something went wrong while creating User");
  }

  res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});
