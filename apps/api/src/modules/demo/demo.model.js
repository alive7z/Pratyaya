import mongoose from "mongoose";

const demoConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 120 },
    value: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 300 },
  },
  { timestamps: true, versionKey: false },
);

export const DemoConfig =
  mongoose.models.DemoConfig ?? mongoose.model("DemoConfig", demoConfigSchema);
