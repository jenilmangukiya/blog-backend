import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "blog-backend",
    });
    console.log("File uploaded to cloudinary At: ", response.url);
    fs.unlinkSync(localFilePath); // remove unused file
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove unused file
    return null;
  }
};

export const removeFromCloudinary = async (url, resource_type = "image") => {
  try {
    const publicId = cloudinary
      .url(url, { secure: true })
      .split("/")
      .pop()
      .replace(/\..*/, "");

    return await cloudinary.uploader.destroy(`blog-backend/${publicId}`, {
      resource_type,
    });
  } catch (error) {
    return null;
  }
};
