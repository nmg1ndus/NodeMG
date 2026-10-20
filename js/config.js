/* ============================================================
 *  NodeMG Dashboard — settings
 *  यही एक फ़ाइल है जिसे आपको बदलना है।
 * ============================================================ */
window.NODEMG_CONFIG = {
  channelName: 'NodeMG',
  tagline: 'Daily Shorts Analytics',

  /* डेटा का स्रोत (Apps Script URL, key, CSV लिंक) यहाँ नहीं लिखते — वह पासवर्ड से लॉक js/vault.js में रहता है.
   * उसे बदलने के लिए tools/vault-tool.html खोलिए (README देखें). */

  autoRefreshMinutes: 0,   // 0 = बंद. जैसे 10 = हर 10 मिनट में डेटा दोबारा लाओ

  defaultLang: 'hi',       // 'hi' (हिन्दी) या 'en'
  defaultRange: 'latest',  // 'latest' = आख़िरी दिन | 'last7' | 'last28' | 'all'

  /* रिपॉजिटरी के root में रखी इमेज. फ़ाइल न मिले तो अक्षर वाला आइकन दिखेगा. */
  images: {
    profile: 'profile.jpg',
    youtube: 'youtube.jpg',
    instagram: 'instagram.jpg',
    facebook: 'facebook.jpg'
  },

  /* साइडबार में आइकन पर क्लिक करने पर खुलने वाले आपके पेज (वैकल्पिक) */
  profileLinks: {
    youtube: 'https://youtube.com/@nmgindus',
    instagram: 'https://www.instagram.com/nmgindus/',
    facebook: 'https://www.facebook.com/NMGIndus/'
  }
};
