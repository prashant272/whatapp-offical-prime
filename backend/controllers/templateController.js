import Template from "../models/Template.js";
import { getTemplates, createTemplate, deleteMetaTemplate } from "../services/whatsappService.js";

export const getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const syncTemplates = async (req, res) => {
  try {
    const metaTemplates = await getTemplates();
    const metaNames = (metaTemplates.data || []).map(mt => mt.name);
    
    console.log(`✅ Manual Sync: Fetched ${metaTemplates.data?.length || 0} templates from Meta`);
    
    for (const mt of (metaTemplates.data || [])) {
      console.log(`📌 Template Found: "${mt.name}" | Language: "${mt.language}" | Status: "${mt.status}"`);
      await Template.findOneAndUpdate(
        { name: mt.name },
        { 
          status: mt.status, 
          metaId: mt.id,
          components: mt.components,
          language: mt.language,
          category: mt.category,
          rejectionReason: mt.rejected_reason || null 
        },
        { upsert: true }
      );
    }

    await Template.deleteMany({ name: { $nin: metaNames } });
    
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    const message = error.error?.message || error.message || "Sync failed";
    console.error("❌ Sync Error:", message);
    res.status(500).json({ error: message });
  }
};

export const createNewTemplate = async (req, res) => {
  try {
    const metaRes = await createTemplate(req.body);
    const newTemplate = new Template({
      ...req.body,
      metaId: metaRes.id,
      status: "PENDING"
    });
    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (error) {
    const message = error.error?.message || error.message || "Unknown error";
    console.error("❌ API Error:", message);
    res.status(400).json({ error: message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const { name } = req.params;
    
    try {
      await deleteMetaTemplate(name);
    } catch (metaErr) {
      console.warn(`⚠️ Warning: Template '${name}' might already be deleted in Meta.`);
    }

    await Template.findOneAndDelete({ name });
    res.json({ success: true, message: `Template '${name}' deleted successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
