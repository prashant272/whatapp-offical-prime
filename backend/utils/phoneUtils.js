/**
 * Normalizes a phone number to include the country code (default 91 for India)
 * @param {string} phone 
 * @returns {string} normalized phone number
 */
export const normalizePhone = (phone) => {
  if (!phone) return "";
  
  // Ensure phone is a string and remove any non-numeric characters
  let cleanPhone = phone.toString().replace(/\D/g, "");
  
  // If it's 10 digits, add 91 at the beginning
  if (cleanPhone.length === 10) {
    return "91" + cleanPhone;
  }
  
  // If it's already longer (like 91...), return as is
  return cleanPhone;
};
