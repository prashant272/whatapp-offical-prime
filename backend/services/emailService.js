import nodemailer from "nodemailer";

/**
 * Helper to construct the Nodemailer Transporter configuration based on the database setting.
 */
const getTransporterConfig = (setting) => {
  if (setting.type === "gmail") {
    return {
      service: "gmail",
      auth: {
        user: setting.user,
        pass: setting.pass
      },
      // Set HELO/EHLO name to gmail.com to avoid local machine hostnames (like LAPTOP-XYZ.local) being flagged
      name: "gmail.com", 
      xMailer: false
    };
  } else {
    // Official SMTP configuration
    return {
      host: setting.host,
      port: setting.port,
      secure: setting.secure, // true for 465, false for 587/other
      auth: {
        user: setting.user,
        pass: setting.pass
      }
    };
  }
};

/**
 * Verifies if the SMTP settings are correct.
 * @param {Object} setting - The EmailSetting mongoose object
 * @returns {Promise<boolean>}
 */
export const verifySmtpConnection = async (setting) => {
  const config = getTransporterConfig(setting);
  const transporter = nodemailer.createTransport(config);
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error(`❌ SMTP verify failed for ${setting.type}:`, error);
    throw error;
  }
};

/**
 * Sends an email using the saved configuration.
 * @param {Object} setting - The EmailSetting mongoose object
 * @param {Object} mailOptions - { to, subject, html, text, attachments }
 * @returns {Promise<Object>}
 */
export const sendEmail = async (setting, { to, cc, bcc, subject, html, text, attachments }) => {
  const config = getTransporterConfig(setting);
  const transporter = nodemailer.createTransport(config);

  const fromName = setting.senderName || "WhatsApp Dashboard";
  const fromEmail = setting.senderEmail || setting.user;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    html,
    text,
    attachments: attachments || []
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email sent successfully via ${setting.type}:`, info.messageId);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email via ${setting.type}:`, error);
    throw error;
  }
};
