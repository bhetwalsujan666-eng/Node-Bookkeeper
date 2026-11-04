// server/settings.js — constants and defaults: storage folders, hotel categories, company details
// (split out of the old single-file server.js by migrate.js; code is unchanged)

// Edit your company details here (shown on Excel bills)
const COMPANY_DEFAULT = { name: 'Shivam Group Holiday Pvt. Ltd.', addr: 'Lazimpat, Kathmandu, Nepal', tel: '977-1-4535752, 4535859', email: 'shivamholidaygrp@gmail.com', vat: '600850814' }; // defaults only: edit these in the Settings page

const COMPANY = { ...COMPANY_DEFAULT };

// ---- Settings (settings.json): storage folder, auto-save switches, company details ----
const HOTEL_CATS = ['Hotel - Ramada', 'Hotel - Aloft']; // hotels whose booking/billing goes through a chain's tech platform; add more under Settings > Categories

const FOLDERS = ['JV', 'PV', 'PMV', 'SV', 'RV', 'Statements', 'Registers', 'TrialBalance', 'IncomeStatement', 'BalanceSheet']; // add a name here for any new downloadable statement

module.exports = { COMPANY, COMPANY_DEFAULT, FOLDERS, HOTEL_CATS };
