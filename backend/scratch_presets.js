import mongoose from "mongoose";
import TemplatePreset from "./models/TemplatePreset.js";

mongoose.connect("mongodb://66.116.248.190:27017/whatapp-db", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const presets = await TemplatePreset.find().lean();
    console.log(presets);
    process.exit(0);
  });
