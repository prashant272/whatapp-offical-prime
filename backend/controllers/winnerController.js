import Winner from "../models/Winner.js";

export const getWinners = async (req, res) => {
  try {
    const winners = await Winner.find().sort({ createdAt: -1 });
    res.json(winners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createWinner = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const newWinner = new Winner({ name });
    await newWinner.save();
    res.status(201).json(newWinner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteWinner = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fallback: If id is passed as name instead of ObjectId (since some UI components use name)
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      await Winner.findByIdAndDelete(id);
    } else {
      await Winner.findOneAndDelete({ name: id });
    }
    
    res.json({ message: "Winner deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
