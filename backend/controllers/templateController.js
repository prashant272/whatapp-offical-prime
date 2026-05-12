import { getTemplates as getTemplatesFromMeta, createTemplate as createMetaTemplate, deleteMetaTemplate, uploadMediaToMeta } from "../services/whatsappService.js";
import Template from "../models/Template.js";

export const getTemplates = async (req, res) => {
  try {
    const account = req.whatsappAccount;
    // Strict Filtering: Only show templates for the active account (unless 'all')
    if (!account) return res.status(400).json({ error: "No active account selected" });

    let query = { whatsappAccountId: account._id };
    if (account.isAll) {
      query = {}; // Return all templates
    }

    const templates = await Template.find(query).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const syncTemplates = async (req, res) => {
  try {
    const account = req.whatsappAccount;
    if (!account) return res.status(400).json({ error: "No active WhatsApp account selected for sync" });

    console.log(`🔄 Syncing templates for account: ${account.name} (WABA: ${account.wabaId})`);
    
    const metaTemplates = await getTemplatesFromMeta(account);

    if (!Array.isArray(metaTemplates)) {
      console.error("❌ Meta response is not an array:", metaTemplates);
      return res.status(500).json({ error: "Invalid response from Meta", details: metaTemplates });
    }

    const syncedTemplates = [];
    const metaTemplateNames = metaTemplates.map(t => t.name);

    for (const tpl of metaTemplates) {
      const updatedTemplate = await Template.findOneAndUpdate(
        { name: tpl.name, whatsappAccountId: account._id },
        {
          category: tpl.category,
          language: tpl.language,
          components: tpl.components,
          status: tpl.status,
          metaId: tpl.id,
          whatsappAccountId: account._id
        },
        { upsert: true, new: true }
      );
      syncedTemplates.push(updatedTemplate);
    }

    // DELETE templates that are no longer on Meta
    const deleteResult = await Template.deleteMany({
      whatsappAccountId: account._id,
      name: { $nin: metaTemplateNames }
    });

    res.json({ 
      message: `Successfully synced ${syncedTemplates.length} templates. Removed ${deleteResult.deletedCount} deleted templates.`, 
      templates: syncedTemplates 
    });
  } catch (error) {
    const errorData = error.response?.data || error;
    console.error("❌ Sync Error Detail:", JSON.stringify(errorData, null, 2));
    const errorDetail = error.response?.data?.error?.message || error.message || "Unknown error";
    res.status(500).json({ error: "Sync failed", details: errorDetail });
  }
};

export const createNewTemplate = async (req, res) => {
  try {
    const account = req.whatsappAccount;
    if (!account) return res.status(400).json({ error: "No active account" });

    const templateData = req.body;

    // --- AUTOMATED MEDIA HANDLE CONVERSION ---
    console.log("🛠️ Checking for media components in template...");
    if (templateData.components) {
      for (let comp of templateData.components) {
        console.log(`🔍 Checking component: ${comp.type} (Format: ${comp.format})`);
        if (comp.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
          const sampleUrl = comp.example?.header_url?.[0] || comp.example?.header_handle?.[0];
          
          if (sampleUrl && sampleUrl.startsWith("http")) {
            try {
              const handle = await uploadMediaToMeta(account.accessToken, sampleUrl);
              // Meta requires 'header_handle' for approval samples
              comp.example = { header_handle: [handle] };
              console.log(`✅ Sample converted to Meta handle: ${handle}`);
            } catch (err) {
              console.error("⚠️ Failed to convert media URL to handle:", err.message);
              // Fallback: Continue with original, though Meta might reject
            }
          }
        }
      }
    }

    const metaResponse = await createMetaTemplate(account, templateData);
    
    const newTemplate = new Template({
      ...templateData,
      metaId: metaResponse.id,
      status: "PENDING",
      whatsappAccountId: account._id
    });
    await newTemplate.save();

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("❌ Template Creation Error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.error?.message || error.message,
      details: error.response?.data?.error || null
    });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const account = req.whatsappAccount;
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });

    await deleteMetaTemplate(account, template.name);
    await Template.findByIdAndDelete(req.params.id);

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
};
