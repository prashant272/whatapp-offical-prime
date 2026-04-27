import mongoose from "mongoose";

const sectorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
}, { timestamps: true });

const Sector = mongoose.model("Sector", sectorSchema);
export default Sector;
