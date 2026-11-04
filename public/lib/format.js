// lib/format.js — number / date formatting
// (split out of the old single-file index.html by migrate.js; code is unchanged)

export const ymd = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); // local date, not UTC

export const f = n => (+n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // lakh/crore grouping

// ---- Dashboard helpers (plain SVG/HTML, no libraries) ----
export const K = n => { const a = Math.abs(n), s = n < 0 ? '-' : ''; return s + (a >= 1e7 ? (a / 1e7).toFixed(2) + ' Cr' : a >= 1e5 ? (a / 1e5).toFixed(2) + ' L' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'k' : Math.round(a)); };

export const f0 = n => Math.round(n).toLocaleString('en-IN');

export const PAL = ['#4D6BFE', '#F5A524', '#3DD68C', '#FF7AB6', '#6B84FF', '#FF5C5C', '#7DD3FC', '#9A9A9A'];

export const rd = n => Math.round(n * 100) / 100;
