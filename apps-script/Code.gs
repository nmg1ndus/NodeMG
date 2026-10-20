/**
 * NodeMG Dashboard — Google Apps Script (Web App)
 *
 * यह स्क्रिप्ट आपकी Google Sheet के सारे rows को JSON बनाकर डैशबोर्ड को देती है।
 * Sheet में रोज़ नई row जोड़िए — डैशबोर्ड अपने-आप नया डेटा दिखा देगा।
 *
 * सेटअप (एक बार):
 *  1. अपनी Google Sheet खोलिए → Extensions → Apps Script
 *  2. यह पूरा कोड वहाँ paste करके Save कीजिए
 *  3. Deploy → New deployment → Type: Web app
 *       Execute as: Me
 *       Who has access: Anyone
 *  4. मिली "Web app URL" (…/exec) को js/config.js के appsScriptUrl में डालिए
 *  5. हर बार कोड बदलने पर Deploy → Manage deployments → Edit → New version
 */

// जिस tab (sheet) का डेटा चाहिए उसका नाम. खाली छोड़ेंगे तो पहली tab ली जाएगी.
var SHEET_NAME = 'Sheet1';

// वैकल्पिक: छोटा-सा पासवर्ड. यही config.js के accessKey में भी डालिए.
// ध्यान दें: यह पूरी सुरक्षा नहीं है (नीचे README देखें), बस आकस्मिक पहुँच रोकता है.
var ACCESS_KEY = '';

// अगर यह स्क्रिप्ट Sheet के अंदर से नहीं बनाई (standalone है), तो Sheet की ID यहाँ डालिए.
var SPREADSHEET_ID = '';

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (ACCESS_KEY && params.key !== ACCESS_KEY) {
      return respond_({ ok: false, error: 'unauthorized' });
    }

    var ss = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = (SHEET_NAME && ss.getSheetByName(SHEET_NAME)) || ss.getSheets()[0];

    var values = sheet.getDataRange().getValues();
    var tz = Session.getScriptTimeZone();

    var rows = values.map(function (row) {
      return row.map(function (cell) {
        if (cell instanceof Date) return Utilities.formatDate(cell, tz, 'yyyy-MM-dd');
        return cell === null || cell === undefined ? '' : cell;
      });
    });

    return respond_({
      ok: true,
      sheet: sheet.getName(),
      updated: new Date().toISOString(),
      rows: rows            // पहली row = header
    });
  } catch (err) {
    return respond_({ ok: false, error: String(err) });
  }
}

function respond_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Editor में Run करके देखिए कि डेटा सही आ रहा है (Execution log में दिखेगा). */
function testOutput() {
  var out = doGet({ parameter: { key: ACCESS_KEY } }).getContent();
  Logger.log(out.slice(0, 1500));
}
