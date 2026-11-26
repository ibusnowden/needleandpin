// Converts the first sheet of a legacy .xls workbook to a JSON array of rows on stdout.
// Used by scripts/data/build.py for sources only published as BIFF .xls (Allen's data).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const wb = XLSX.readFile(process.argv[2]);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
process.stdout.write(JSON.stringify(rows));
