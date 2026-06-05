import mongoose from "mongoose";

const sectorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  subsectors: [{ type: String }]
}, { timestamps: true });

const Sector = mongoose.model("Sector", sectorSchema);
export default Sector;
