import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import {
  removeFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import path from "path";
import mongoose from "mongoose";

const cookiesOptions = {
  httpOnly: true,
  secure: true,
  maxAge: 24 * 60 * 60 * 1000,
};

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

export const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  let role = "user";
  if (req?.user?._id && req?.user?.role === "superadmin") {
    if (req.body?.role === "user" || req.body?.role === "superadmin") {
      role = req.body?.role;
    }
  }

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
    role: role,
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

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required!");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(400, "Username or password is invalid");
  }

  const isUserValid = await user.isPasswordCorrect(password);

  if (!isUserValid) {
    throw new ApiError(400, "Please enter valid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const validUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  res
    .status(200)
    .cookie("accessToken", accessToken, cookiesOptions)
    .cookie("refreshToken", refreshToken, {
      ...cookiesOptions,
      maxAge: 10 * 24 * 60 * 60 * 1000, // For 10d
    })
    .json(
      new ApiResponse(
        200,
        { user: validUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;
  console.log("incomingRefreshToken", incomingRefreshToken);
  if (!incomingRefreshToken) {
    throw new ApiError(
      400,
      "Please pass refreshToken to generate New AccessToken"
    );
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  if (!decodedToken) {
    throw new ApiError(400, "Invalid refreshToken");
  }

  try {
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { refreshToken, accessToken } = await generateAccessAndRefreshToken(
      user._id
    );

    res
      .status(200)
      .cookie("accessToken", accessToken, cookiesOptions)
      .cookie("refreshToken", refreshToken, {
        ...cookiesOptions,
        maxAge: 10 * 24 * 60 * 60 * 1000, // For 10d
      })
      .json(
        new ApiResponse(
          200,
          { refreshToken, accessToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh Token");
  }
});

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 },
  });

  res
    .status(200)
    .clearCookie("accessToken", cookiesOptions)
    .clearCookie("refreshToken", cookiesOptions)
    .json(new ApiResponse(200, {}, "Logout success"));
});

export const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Password change successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id).select(
    "-password -refreshToken"
  );
  res.status(200).json(new ApiResponse(200, user, "success"));
});

export const updateProfilePic = asyncHandler(async (req, res) => {
  const avatarLocalPath = req?.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError("Avatar is required");
  }

  // 2MB limit to image upload
  if (req?.file.size > 2048000) {
    throw new ApiError(
      400,
      "File is too big, Please upload file less then 2MB"
    );
  }

  // checking file type
  const ext = path.extname(req?.file.originalname);
  if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
    throw new ApiError(400, "Please Upload file in image format");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar?.url) {
    throw new ApiError(500, "something went wrong while uploading Avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password -refreshToken");

  if (req.user?.avatar) {
    await removeFromCloudinary(req.user.avatar);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile picture updated"));
});

export const updateUserInfo = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new ApiError(400, "Nothing to Update!, please pass some Data");
  }

  // check if the User Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(userId))
    throw new ApiError(404, "Invalid User");

  const updateFields = {};

  if (email && email !== req.user?.email) {
    const user = await User.findOne({ email: email });
    if (user) {
      throw new ApiError(400, "user with this email already exists!");
    } else {
      updateFields.email = email;
    }
  }

  if (fullName) updateFields.fullName = fullName;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $set: updateFields,
    },
    { new: true }
  );
  if (!updatedUser) {
    throw new ApiResponse(500, "Something went wrong while updating data");
  }
  res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "User updated Successfully"));
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // check if the User Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(userId))
    throw new ApiError(404, "Invalid User");

  if (req.user?.role !== "superadmin") {
    throw new ApiError(401, "Unauthorized to Delete an User");
  }

  const user = await User.findByIdAndDelete(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user?.avatar) await removeFromCloudinary(user?.avatar);

  res.status(200).json(new ApiResponse(200, user));
});
