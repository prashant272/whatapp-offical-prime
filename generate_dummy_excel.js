import XLSX from 'xlsx';
import fs from 'fs';

const data = [
  {
    "Name": "Rahul Sharma",
    "Phone": "919876543210",
    "Sector": "Real Estate",
    "hhh": "Interested in 2BHK",
    "jj": "Call back tomorrow"
  },
  {
    "Name": "Priya Verma",
    "Phone": "918877665544",
    "Sector": "Healthcare",
    "hhh": "Wants health checkup",
    "jj": "Send brochure"
  },
  {
    "Name": "Amit Singh",
    "Phone": "917766554433",
    "Sector": "Education",
    "hhh": "Looking for MBA",
    "jj": "High priority"
  },
  {
    "Name": "Test User",
    "Phone": "919001017000",
    "Sector": "Astrology",
    "hhh": "Gemstone inquiry",
    "jj": "Warm lead"
  }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Leads");

// Write to a file in the workspace
const filePath = 'e:/whatapp-offical/dummy_leads.xlsx';
XLSX.writeFile(wb, filePath);

console.log(`✅ Dummy Excel file created at: ${filePath}`);
