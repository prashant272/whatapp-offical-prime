import WhatsAppAccount from "../models/WhatsAppAccount.js";

export const getAccounts = async (req, res) => {
  try {
    const accounts = await WhatsAppAccount.find();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addAccount = async (req, res) => {
  try {
    const account = new WhatsAppAccount(req.body);
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateAccount = async (req, res) => {
  try {
    const account = await WhatsAppAccount.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    await WhatsAppAccount.findByIdAndDelete(req.params.id);
    res.json({ message: "Account deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
