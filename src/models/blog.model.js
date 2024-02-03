import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const blogSchema = new mongoose.Schema({
  thumbnail: {
    type: String,
  },
  title: {
    type: String,
    trim: true,
    required: true,
  },
  description: {
    type: String,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
});

blogSchema.plugin(mongooseAggregatePaginate);

export const Blog = mongoose.model("Blog", blogSchema);
