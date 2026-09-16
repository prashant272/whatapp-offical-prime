import mongoose from "mongoose";

const metaPageSchema = new mongoose.Schema({
  pageId: { type: String, required: true, unique: true },
  pageName: { type: String, required: true },
  pageAccessToken: { type: String, required: true },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true },
  userFacebookId: { type: String } // The ID of the FB user who connected this page
}, { timestamps: true });

const MetaPage = mongoose.model("MetaPage", metaPageSchema);
export default MetaPage;
