import WindowReminder from "../models/WindowReminder.js";

// @desc    Get all window reminders
// @route   GET /api/window-reminders
// @access  Private
export const getWindowReminders = async (req, res) => {
  try {
    const reminders = await WindowReminder.find().populate("whatsappAccountIds", "name phoneNumber");
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Create a new window reminder
// @route   POST /api/window-reminders
// @access  Private
export const createWindowReminder = async (req, res) => {
  try {
    const { name, whatsappAccountIds, targetStatuses, message, mediaUrl, active } = req.body;
    
    if (!name || !message) {
      return res.status(400).json({ error: "Name and message are required" });
    }

    const reminder = new WindowReminder({
      name,
      whatsappAccountIds,
      targetStatuses,
      message,
      mediaUrl,
      active
    });

    const savedReminder = await reminder.save();
    res.status(201).json(savedReminder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update a window reminder
// @route   PUT /api/window-reminders/:id
// @access  Private
export const updateWindowReminder = async (req, res) => {
  try {
    const { name, whatsappAccountIds, targetStatuses, message, mediaUrl, active } = req.body;
    
    const reminder = await WindowReminder.findById(req.params.id);
    if (!reminder) {
      return res.status(404).json({ error: "Window reminder not found" });
    }

    if (name !== undefined) reminder.name = name;
    if (whatsappAccountIds !== undefined) reminder.whatsappAccountIds = whatsappAccountIds;
    if (targetStatuses !== undefined) reminder.targetStatuses = targetStatuses;
    if (message !== undefined) reminder.message = message;
    if (mediaUrl !== undefined) reminder.mediaUrl = mediaUrl;
    if (active !== undefined) reminder.active = active;

    const updatedReminder = await reminder.save();
    res.json(updatedReminder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a window reminder
// @route   DELETE /api/window-reminders/:id
// @access  Private
export const deleteWindowReminder = async (req, res) => {
  try {
    const reminder = await WindowReminder.findById(req.params.id);
    if (!reminder) {
      return res.status(404).json({ error: "Window reminder not found" });
    }

    await reminder.deleteOne();
    res.json({ message: "Window reminder removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
