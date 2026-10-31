/**
 * Hindi version of the PDF report: a dictionary for the report's own labels, and the plumbing to translate the
 * analysis text with AI. Only text is translated; domains, URLs, numbers and structure are copied from the original,
 * so the Hindi report can never contain facts the English one does not.
 */

import type { AnalyzerResult } from './analyzer-ai';
import type { SiteChange } from './analyzer-changes';
import type { ReportNarrative } from './analyzer-report';

export type ReportLang = 'en' | 'hi';
export const HINDI_PROMPT_VERSION = 'cmpz-hi-2026-10-22.1';

/** Fixed report labels, keyed by the English text in lower case. `{x}` marks a value filled in at render time. */
const PROFILE_HI: Record<string, string> = {
  'expo competitive overview':'प्रदर्शनी प्रतिस्पर्धा का सारांश',
  'exhibitor intelligence':'प्रदर्शक विश्लेषण',
  'buyer and b2b opportunities':'खरीदार और बी2बी अवसर',
  'sponsorship intelligence':'प्रायोजन विश्लेषण',
  'event and conference comparison':'आयोजन और सम्मेलन की तुलना',
  'organic industry intelligence':'ऑर्गेनिक उद्योग विश्लेषण',
  'seo and digital marketing':'एसईओ और डिजिटल मार्केटिंग',
  'conversion experience':'पंजीकरण और पूछताछ का अनुभव',
  'trust and credibility':'विश्वास और विश्वसनीयता',
  'swot and opportunity gaps':'स्वॉट और अवसरों का अंतर',
  'priority action roadmap':'प्राथमिकता आधारित कार्ययोजना',
  'historical changes':'पिछले विश्लेषण से बदलाव',
  'fact':'मापा गया तथ्य','website_claim':'वेबसाइट का दावा','ai_interpretation':'एआई व्याख्या','interpretation':'नियम आधारित व्याख्या',
  'observed':'देखा गया','not_observed':'नहीं देखा गया','inaccessible':'वेबसाइट उपलब्ध नहीं',
  'industry segments':'उद्योग श्रेणियाँ','website-stated claim':'वेबसाइट का दावा','not observed':'नहीं देखा गया',
  'strengths':'मजबूत संकेत','weaknesses':'सत्यापन योग्य सार्वजनिक जानकारी के अंतर','opportunities':'अवसर','threats':'जोखिम',
  'source quotations remain in their original language.':'प्रमाण के उद्धरण उनकी मूल भाषा में रखे गए हैं।',
  'no evidence-supported priority action in this sample.':'इस नमूने में प्रमाण आधारित प्राथमिक कार्य नहीं मिला।',
  'the first advanced run establishes the evidence baseline.':'पहला उन्नत विश्लेषण आगे की तुलना के लिए प्रमाण का आधार बनाता है।',
  'exhibitor registration': 'प्रदर्शक पंजीकरण',
  'visitor and buyer registration': 'आगंतुक और खरीदार पंजीकरण',
  'sponsorship visibility': 'प्रायोजन की दृश्यता',
  'exhibitor directory and categories': 'प्रदर्शक सूची और श्रेणियाँ',
  'venue and event details': 'स्थल और आयोजन की जानकारी',
  'business matchmaking': 'व्यापारिक संपर्क',
  'trust signals': 'विश्वसनीयता के संकेत',
  'enquiry experience': 'पूछताछ की सुविधा',
  'high': 'उच्च',
  'medium': 'मध्यम',
  'unknown': 'अज्ञात',
};
export const profileLabel = (lang: ReportLang, value: string) => lang === 'hi' ? PROFILE_HI[value.toLowerCase()] ?? value : value;

const HI: Record<string, string> = {
  'prepared for {x} with {brand}': '{x} के लिए {brand} से तैयार',
  'media360': 'Media360',
  'competitor intelligence report': 'प्रतिस्पर्धी विश्लेषण रिपोर्ट',
  'compared with {n} competitor websites': '{n} प्रतिस्पर्धी वेबसाइटों से तुलना',
  'compared with {n} competitor website': '{n} प्रतिस्पर्धी वेबसाइट से तुलना',
  'overall score': 'कुल स्कोर',
  'your position': 'आपकी स्थिति',
  '#{r} of {n}': '{n} में #{r}',
  'not scored': 'स्कोर नहीं मिला',
  'tied with {x}': '{x} के बराबर',
  'areas you lead': 'जिन क्षेत्रों में आप आगे हैं',
  '{a} of {b}': '{b} में से {a}',
  'quick wins': 'जल्दी मिलने वाली जीत',
  'pages read': 'पढ़े गए पेज',
  'websites in this report': 'इस रिपोर्ट की वेबसाइटें',
  '{d}  (you)': '{d}  (आप)',
  'prepared for {x}': '{x} के लिए तैयार',
  'websites checked {x}': 'वेबसाइटें जाँची गईं {x}',
  'report generated {x}': 'रिपोर्ट बनी {x}',
  'confidential - for internal planning': 'गोपनीय - आंतरिक योजना के लिए',
  'executive summary': 'सार',
  'where your website stands against the competitors, in plain words. scores are out of 100 and come from the public pages that were read and google measurements - not from traffic or sales, which are not public.':
    'प्रतिस्पर्धियों के मुकाबले आपकी वेबसाइट कहाँ है, आसान शब्दों में। स्कोर 100 में से हैं और पढ़े गए सार्वजनिक पेजों व Google के माप से बने हैं - ट्रैफ़िक या बिक्री से नहीं, जो सार्वजनिक नहीं हैं।',
  'the ai comparison did not complete for this check, so only measured data is shown in this report.': 'इस जाँच में AI तुलना पूरी नहीं हुई, इसलिए इस रिपोर्ट में केवल मापा गया डेटा है।',
  'out of 100': '100 में से',
  'your rank': 'आपकी रैंक',
  'of {n} websites': '{n} वेबसाइटों में',
  'of {n} websites (tied)': '{n} वेबसाइटों में (बराबर)',
  'highest score in the area': 'क्षेत्र में सबसे ऊँचा स्कोर',
  'high impact, low effort': 'ज़्यादा असर, कम मेहनत',
  leaderboard: 'लीडरबोर्ड',
  you: 'आप',
  'biggest threat: {x}': 'सबसे बड़ा खतरा: {x}',
  'key findings': 'मुख्य निष्कर्ष',
  'who is best at what': 'कौन किसमें सबसे अच्छा है',
  'each area is scored out of 10 for every website. darker blue means stronger; the gold outline marks the single leader of that area (no outline means a tie). the radar shows the same scores as a shape: a bigger, rounder shape is a stronger website.':
    'हर वेबसाइट को हर क्षेत्र में 10 में से स्कोर मिला है। गहरा नीला मतलब ज़्यादा मज़बूत; सुनहरी बॉर्डर उस क्षेत्र के अकेले लीडर को दिखाती है (बॉर्डर नहीं = बराबरी)। रडार वही स्कोर एक आकार में दिखाता है: बड़ा, गोल आकार = मज़बूत वेबसाइट।',
  'overall /100': 'कुल /100',
  'what each area means': 'हर क्षेत्र का मतलब',
  'here: {x}': 'यहाँ: {x}',
  'message clarity': 'संदेश की स्पष्टता',
  'trust & proof': 'भरोसा और सबूत',
  'calls to action': 'कॉल टू एक्शन',
  'content depth': 'कंटेंट की गहराई',
  'ease of contact': 'संपर्क की आसानी',
  'search basics': 'सर्च की बुनियादी बातें',
  'speed & mobile': 'स्पीड और मोबाइल',
  'can a visitor tell within seconds who you are, what you offer and for whom?': 'क्या आने वाला कुछ सेकंड में समझ पाता है कि आप कौन हैं, क्या देते हैं और किसके लिए?',
  'testimonials, numbers, awards, partners, certificates - reasons to believe you.': 'प्रशंसापत्र, आँकड़े, पुरस्कार, पार्टनर, प्रमाणपत्र - आप पर भरोसा करने के कारण।',
  'clear buttons and next steps: register, book, contact, donate.': 'साफ़ बटन और अगले कदम: रजिस्टर, बुक, संपर्क, दान।',
  'how much genuinely useful information the pages give.': 'पेज कितनी सच में काम की जानकारी देते हैं।',
  'phone, whatsapp, email and forms that are easy to find.': 'फ़ोन, WhatsApp, ईमेल और फ़ॉर्म जो आसानी से मिलें।',
  'titles, descriptions, headings and technical tags google needs.': 'टाइटल, विवरण, हेडिंग और तकनीकी टैग जो Google को चाहिए।',
  'how fast and comfortable the site is on a phone.': 'फ़ोन पर साइट कितनी तेज़ और आरामदायक है।',
  'you vs each competitor': 'आप बनाम हर प्रतिस्पर्धी',
  'one card per competitor. the threat level says how directly that website competes for your audience. "you lead" and "they lead" list concrete differences seen on the pages; the advice at the bottom comes from the ai review of the whole analysis.':
    'हर प्रतिस्पर्धी का एक कार्ड। खतरे का स्तर बताता है कि वह वेबसाइट आपके दर्शकों के लिए कितना सीधा मुकाबला करती है। "आप आगे" और "वे आगे" में पेजों पर दिखे ठोस अंतर हैं; नीचे की सलाह पूरे विश्लेषण की AI समीक्षा से है।',
  'high threat': 'ज़्यादा खतरा',
  'medium threat': 'मध्यम खतरा',
  'low threat': 'कम खतरा',
  vs: 'बनाम',
  them: 'वे',
  'you lead': 'आप आगे',
  'they lead': 'वे आगे',
  'nothing clear.': 'कुछ साफ़ नहीं।',
  advice: 'सलाह',
  'watch out: {x}': 'सावधान: {x}',
  'learn from them: {x}': 'इनसे सीखें: {x}',
  'swot for {x}': '{x} का SWOT',
  'strengths and weaknesses describe your website today compared with these competitors. opportunities are things you could add to win; threats are what competitors do that could pull your visitors away.':
    'ताकत और कमज़ोरियाँ इन प्रतिस्पर्धियों की तुलना में आपकी आज की वेबसाइट बताती हैं। अवसर वे चीज़ें हैं जो जोड़कर आप जीत सकते हैं; खतरे वे हैं जो प्रतिस्पर्धी करते हैं और आपके विज़िटर खींच सकते हैं।',
  strengths: 'ताकत',
  weaknesses: 'कमज़ोरियाँ',
  opportunities: 'अवसर',
  threats: 'खतरे',
  'where you win and where you fall behind (out of 10)': 'आप कहाँ आगे और कहाँ पीछे हैं (10 में से)',
  '+{n} ahead': '+{n} आगे',
  '{n} behind': '{n} पीछे',
  level: 'बराबर',
  'blue = your score   grey = best competitor': 'नीला = आपका स्कोर   स्लेटी = सबसे अच्छा प्रतिस्पर्धी',
  'nobody does this well yet': 'यह अभी कोई अच्छे से नहीं करता',
  'topics & content': 'विषय और कंटेंट',
  'which subjects each website covers. a filled dot means the site talks about it; highlighted rows are subjects competitors cover and you do not - each one is a chance for a new page or post. below are the gaps with the competitor page that shows them, and ready-to-use content ideas.':
    'हर वेबसाइट किन विषयों पर बात करती है। भरा हुआ बिंदु मतलब साइट उस विषय पर है; हाइलाइट की गई पंक्तियाँ वे विषय हैं जो प्रतिस्पर्धी कवर करते हैं और आप नहीं - हर एक नए पेज या पोस्ट का मौका है। नीचे कमियाँ, उन्हें दिखाने वाला प्रतिस्पर्धी पेज, और तैयार कंटेंट आइडिया हैं।',
  "you don't cover": 'आप कवर नहीं करते',
  'what competitors have that you do not': 'प्रतिस्पर्धियों के पास क्या है जो आपके पास नहीं',
  'seen on: {x}': 'यहाँ देखा: {x}',
  'content ideas for you': 'आपके लिए कंटेंट आइडिया',
  'inspired by {x}': '{x} से प्रेरित',
  'search phrases: {x}': 'खोज शब्द: {x}',
  'what they sell & social media': 'वे क्या बेचते हैं और सोशल मीडिया',
  'prices, packages and event facts each website states on its own pages, shown exactly as written with the page they came from. then the social profiles each website links to, with public youtube numbers from youtube itself. "-" means the pages read do not say it; nothing is estimated.':
    'हर वेबसाइट अपने पेजों पर जो दाम, पैकेज और इवेंट की जानकारी लिखती है, वह ठीक वैसे ही दिखाई गई है, साथ में उस पेज का पता। फिर हर वेबसाइट जिन सोशल प्रोफ़ाइल से जुड़ी है, और YouTube के सार्वजनिक आँकड़े सीधे YouTube से। "-" का मतलब है पढ़े गए पेजों में यह नहीं लिखा; कुछ भी अनुमान से नहीं है।',
  'what they sell & at what price': 'वे क्या बेचते हैं और किस दाम पर',
  'real visitors on phones (google chrome data, last 28 days)': 'फ़ोन पर असली विज़िटर (Google Chrome डेटा, पिछले 28 दिन)',
  'main content shows (lcp)': 'मुख्य कंटेंट दिखने का समय (LCP)',
  'reacts to a tap (inp)': 'टैप पर जवाब (INP)',
  'layout stays still (cls)': 'पेज का स्थिर रहना (CLS)',
  'too few visitors': 'विज़िटर बहुत कम',
  'measured on real chrome users\' phones (75% of visits were this fast or faster). green = good, amber = needs work, red = poor. "too few visitors" means google does not have enough visits to this site to report it.':
    'असली Chrome उपयोगकर्ताओं के फ़ोन पर मापा गया (75% विज़िट इतनी या इससे तेज़ थीं)। हरा = अच्छा, पीला = सुधार चाहिए, लाल = खराब। "विज़िटर बहुत कम" का मतलब है कि Google के पास इस साइट की इतनी विज़िट नहीं हैं कि वह इसे बता सके।',
  'social media': 'सोशल मीडिया',
  event: 'इवेंट',
  dates: 'तारीखें',
  'city / venue': 'शहर / स्थान',
  exhibitors: 'प्रदर्शक',
  visitors: 'आगंतुक',
  'stall / booth price': 'स्टॉल / बूथ का दाम',
  'ticket / entry fee': 'टिकट / प्रवेश शुल्क',
  'booking deadline': 'बुकिंग की आखिरी तारीख',
  'priced offers': 'दाम वाले ऑफ़र',
  products: 'उत्पाद',
  services: 'सेवाएँ',
  'star ratings the websites state (not checked on google)': 'वेबसाइटों की खुद बताई स्टार रेटिंग (Google पर जाँची नहीं गई)',
  'stated rating': 'बताई गई रेटिंग',
  'ratings / reviews': 'रेटिंग / रिव्यू',
  ratings: 'रेटिंग',
  reviews: 'रिव्यू',
  'numbers they claim': 'उनके बताए आँकड़े',
  'youtube subscribers': 'YouTube सब्सक्राइबर',
  'youtube videos': 'YouTube वीडियो',
  'latest youtube upload': 'आखिरी YouTube वीडियो',
  'instagram followers': 'Instagram फ़ॉलोअर',
  'instagram posts': 'Instagram पोस्ट',
  linked: 'जुड़ा है',
  hidden: 'छिपाया गया',
  'not set up': 'सेट नहीं है',
  'cannot look up': 'खोजा नहीं जा सकता',
  'not found': 'नहीं मिला',
  'not available': 'उपलब्ध नहीं',
  'instagram numbers appear only for business and creator accounts, and only when your company has an instagram professional account connected through meta.':
    'Instagram के आँकड़े केवल बिज़नेस और क्रिएटर अकाउंट के लिए दिखते हैं, और तभी जब आपकी कंपनी का Instagram प्रोफ़ेशनल अकाउंट Meta के ज़रिए जुड़ा हो।',
  page: 'पेज',
  blog: 'ब्लॉग',
  faq: 'सवाल-जवाब',
  video: 'वीडियो',
  guide: 'गाइड',
  'speed & technical health': 'स्पीड और तकनीकी सेहत',
  'google pagespeed scores for each home page on a phone (70+ good, 45-69 needs work, below 45 poor), then a checklist measured directly on each website. green means best of the group or within the recommended range; red means outside it.':
    'फ़ोन पर हर होम पेज के Google PageSpeed स्कोर (70+ अच्छा, 45-69 सुधार चाहिए, 45 से कम कमज़ोर), फिर हर वेबसाइट पर सीधे मापी गई चेकलिस्ट। हरा मतलब समूह में सबसे अच्छा या सही सीमा में; लाल मतलब सीमा से बाहर।',
  speed: 'स्पीड',
  seo: 'SEO',
  'access.': 'सुलभता',
  'not measured.': 'मापा नहीं गया।',
  'seconds until the main content shows on a phone (lower is better)': 'फ़ोन पर मुख्य कंटेंट दिखने में सेकंड (कम बेहतर)',
  'good <= 2.5s': 'अच्छा <= 2.5 से.',
  'technical & content checklist': 'तकनीकी और कंटेंट चेकलिस्ट',
  'pages in sitemap': 'साइटमैप में पेज',
  'robots.txt': 'robots.txt',
  'one h1 on home page': 'होम पेज पर एक H1',
  'title length (30-60)': 'टाइटल की लंबाई (30-60)',
  'meta description (70-160)': 'मेटा विवरण (70-160)',
  'canonical tag': 'कैनोनिकल टैग',
  'social share tags': 'सोशल शेयर टैग',
  'images with alt text (%)': 'alt टेक्स्ट वाली इमेज (%)',
  'structured data types': 'स्ट्रक्चर्ड डेटा प्रकार',
  'google knows the brand': 'Google ब्रांड को जानता है',
  content: 'कंटेंट',
  'key pages read': 'पढ़े गए मुख्य पेज',
  'words on those pages': 'उन पेजों पर शब्द',
  'pages updated in 30 days': '30 दिनों में अपडेट हुए पेज',
  'pages updated in 90 days': '90 दिनों में अपडेट हुए पेज',
  'blog / news section': 'ब्लॉग / समाचार सेक्शन',
  'reach & trust': 'पहुँच और भरोसा',
  'phone link': 'फ़ोन लिंक',
  whatsapp: 'WhatsApp',
  'email link': 'ईमेल लिंक',
  'contact form': 'संपर्क फ़ॉर्म',
  'social profiles': 'सोशल प्रोफ़ाइल',
  yes: 'हाँ',
  no: 'नहीं',
  'your 90-day plan': 'आपकी 90-दिन की योजना',
  'the roadmap groups the work into three phases. below it, every recommended action shows its impact (how much it should help), its effort (how much work it is) and the competitor to learn from. start with the quick wins: high impact, low effort.':
    'रोडमैप काम को तीन चरणों में बाँटता है। नीचे हर सुझाए गए काम का असर (कितना मदद करेगा), मेहनत (कितना काम है) और किस प्रतिस्पर्धी से सीखें दिया है। जल्दी मिलने वाली जीत से शुरू करें: ज़्यादा असर, कम मेहनत।',
  'days 1-30': 'दिन 1-30',
  'days 31-60': 'दिन 31-60',
  'days 61-90': 'दिन 61-90',
  'this week': 'इस हफ़्ते',
  'this month': 'इस महीने',
  'this quarter': 'इस तिमाही',
  'high impact': 'ज़्यादा असर',
  'medium impact': 'मध्यम असर',
  'low impact': 'कम असर',
  'high effort': 'ज़्यादा मेहनत',
  'medium effort': 'मध्यम मेहनत',
  'low effort': 'कम मेहनत',
  'quick win': 'जल्दी जीत',
  'learn from {x}': '{x} से सीखें',
  'each website up close': 'हर वेबसाइट को नज़दीक से',
  'for every website: the main promise its home page makes, its tone, what it offers, who it speaks to, and its strengths and weak spots as seen on its own pages.':
    'हर वेबसाइट के लिए: होम पेज का मुख्य वादा, उसका लहजा, वह क्या देती है, किससे बात करती है, और उसके अपने पेजों पर दिखी ताकत और कमज़ोरियाँ।',
  'tone: {x}': 'लहजा: {x}',
  'offers: {x}': 'देते हैं: {x}',
  'speaks to: {x}': 'किसके लिए: {x}',
  'weak spots': 'कमज़ोर बातें',
  'how to track progress': 'प्रगति कैसे देखें',
  'the numbers to watch at every re-check, the final advice, what changed since the previous check, and how this report was made.':
    'हर दोबारा जाँच पर देखने वाले आँकड़े, अंतिम सलाह, पिछली जाँच से क्या बदला, और यह रिपोर्ट कैसे बनी।',
  'kpis to track': 'देखने वाले KPI',
  'final word': 'अंतिम बात',
  'what changed since the previous check': 'पिछली जाँच से क्या बदला',
  'how this report was made': 'यह रिपोर्ट कैसे बनी',
  'on {x} the home page and up to ten key pages (about, services, contact, recent pages from the sitemap) of each website were read as a visitor would see them.':
    '{x} को हर वेबसाइट का होम पेज और दस तक मुख्य पेज (परिचय, सेवाएँ, संपर्क, साइटमैप के नए पेज) वैसे ही पढ़े गए जैसे कोई विज़िटर देखता है।',
  'counts, contact options, social links, structured data, sitemaps and technical tags were measured directly from those pages. speed, seo and accessibility scores come from google pagespeed (mobile). brand recognition comes from the google knowledge graph.':
    'गिनती, संपर्क विकल्प, सोशल लिंक, स्ट्रक्चर्ड डेटा, साइटमैप और तकनीकी टैग सीधे उन्हीं पेजों से मापे गए। स्पीड, SEO और सुलभता स्कोर Google PageSpeed (मोबाइल) से हैं। ब्रांड पहचान Google Knowledge Graph से है।',
  'an ai model compared the websites using only that evidence. every point it made had to cite a page that was actually read; points without a valid source, and any claims about traffic, rankings, backlinks or sales, were removed automatically.':
    'एक AI मॉडल ने केवल इन्हीं सबूतों से वेबसाइटों की तुलना की। हर बात के साथ पढ़े गए पेज का हवाला ज़रूरी था; बिना सही स्रोत वाली बातें और ट्रैफ़िक, रैंकिंग, बैकलिंक या बिक्री के दावे अपने आप हटा दिए गए।',
  'scores are a judgement of the public website, not of the business itself. traffic, search rankings and sales are not public and are not estimated.':
    'स्कोर सार्वजनिक वेबसाइट का आकलन हैं, कारोबार का नहीं। ट्रैफ़िक, सर्च रैंकिंग और बिक्री सार्वजनिक नहीं हैं और उनका अनुमान नहीं लगाया गया।',
  'could not be read: {x}': 'पढ़ा नहीं जा सका: {x}',
  'prepared for {x} with media360': '{x} के लिए Media360 से तैयार',
  'page {a} of {b}': 'पेज {a} / {b}',
};

/** The Hindi text of a fixed report label (any letter case), or null when it is not one. */
export function hindiLabel(en: string): string | null {
  return HI[en.trim().toLowerCase()] ?? null;
}

/** Report label in the chosen language; unknown labels stay English. `vars` fill `{x}` placeholders. */
export function label(lang: ReportLang, en: string, vars: Record<string, string | number> = {}) {
  const template = lang === 'hi' ? HI[en.toLowerCase()] ?? en : en;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/* ------------------------------------------------------------------ */
/* Translating the analysis                                            */
/* ------------------------------------------------------------------ */

export interface Translatable { ai: AnalyzerResult | null; narrative: ReportNarrative | null; changes: SiteChange[] | null }

/** Every human-readable string with a stable id; domains, URLs and enums are not included. */
export function collectStrings(src: Translatable): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const add = (id: string, text: string | null | undefined) => {
    if (text && text.trim()) out.push({ id, text });
  };
  const ai = src.ai;
  if (ai) {
    add('o', ai.overview);
    ai.scores.forEach((s, i) => add(`sc${i}`, s.note));
    ai.headToHead.forEach((h, i) => {
      add(`h${i}r`, h.threatReason);
      add(`h${i}v`, h.verdict);
      h.theyLead.forEach((p, j) => add(`h${i}t${j}`, p.point));
      h.youLead.forEach((p, j) => add(`h${i}y${j}`, p.point));
    });
    ai.gaps.forEach((g, i) => {
      add(`g${i}t`, g.topic);
      add(`g${i}w`, g.why);
    });
    ai.opportunities.forEach((o, i) => add(`op${i}`, o));
    ai.actions.forEach((a, i) => {
      add(`a${i}a`, a.action);
      add(`a${i}r`, a.reason);
    });
    ai.sites.forEach((s, i) => {
      add(`s${i}s`, s.summary);
      add(`s${i}a`, s.audience);
      add(`s${i}p`, s.positioning);
      add(`s${i}m`, s.promise);
      add(`s${i}t`, s.tone);
      s.offerings.forEach((o, j) => add(`s${i}o${j}`, o));
      s.strengths.forEach((p, j) => add(`s${i}st${j}`, p.point));
      s.weaknesses.forEach((p, j) => add(`s${i}wk${j}`, p.point));
    });
    (['strengths', 'weaknesses', 'opportunities', 'threats'] as const).forEach((k) => ai.swot?.[k].forEach((t, i) => add(`w${k[0]}${i}`, t)));
    ai.topics?.forEach((t, i) => add(`t${i}`, t.topic));
    ai.contentIdeas?.forEach((c, i) => {
      add(`c${i}t`, c.title);
      add(`c${i}w`, c.why);
      c.outline?.forEach((h, j) => add(`c${i}o${j}`, h));
    });
  }
  const n = src.narrative;
  if (n) {
    add('nh', n.headline);
    add('ne', n.executiveSummary);
    n.keyFindings.forEach((f, i) => {
      add(`nf${i}t`, f.title);
      add(`nf${i}d`, f.detail);
    });
    n.competitors.forEach((c, i) => {
      add(`nc${i}s`, c.summary);
      add(`nc${i}w`, c.watchOut);
      add(`nc${i}l`, c.learnFrom);
    });
    n.roadmap.forEach((r, i) => {
      add(`nr${i}f`, r.focus);
      r.steps.forEach((s, j) => add(`nr${i}s${j}`, s));
    });
    n.kpis.forEach((k, i) => {
      add(`nk${i}m`, k.metric);
      add(`nk${i}w`, k.why);
      add(`nk${i}t`, k.target);
    });
    add('nx', n.closing);
  }
  src.changes?.forEach((c, i) => add(`ch${i}`, c.text));
  return out;
}

/** The same structure with translated strings; anything not translated keeps its English text. */
export function applyTranslations(src: Translatable, map: Record<string, string>): Translatable {
  const t = (id: string, text: string) => map[id] ?? text;
  const ai = src.ai
    ? {
        ...src.ai,
        overview: t('o', src.ai.overview),
        scores: src.ai.scores.map((s, i) => ({ ...s, note: t(`sc${i}`, s.note) })),
        headToHead: src.ai.headToHead.map((h, i) => ({
          ...h,
          threatReason: h.threatReason ? t(`h${i}r`, h.threatReason) : h.threatReason,
          verdict: t(`h${i}v`, h.verdict),
          theyLead: h.theyLead.map((p, j) => ({ ...p, point: t(`h${i}t${j}`, p.point) })),
          youLead: h.youLead.map((p, j) => ({ ...p, point: t(`h${i}y${j}`, p.point) })),
        })),
        gaps: src.ai.gaps.map((g, i) => ({ ...g, topic: t(`g${i}t`, g.topic), why: t(`g${i}w`, g.why) })),
        opportunities: src.ai.opportunities.map((o, i) => t(`op${i}`, o)),
        actions: src.ai.actions.map((a, i) => ({ ...a, action: t(`a${i}a`, a.action), reason: t(`a${i}r`, a.reason) })),
        sites: src.ai.sites.map((s, i) => ({
          ...s,
          summary: t(`s${i}s`, s.summary),
          audience: t(`s${i}a`, s.audience),
          positioning: t(`s${i}p`, s.positioning),
          promise: s.promise ? t(`s${i}m`, s.promise) : s.promise,
          tone: s.tone ? t(`s${i}t`, s.tone) : s.tone,
          offerings: s.offerings.map((o, j) => t(`s${i}o${j}`, o)),
          strengths: s.strengths.map((p, j) => ({ ...p, point: t(`s${i}st${j}`, p.point) })),
          weaknesses: s.weaknesses.map((p, j) => ({ ...p, point: t(`s${i}wk${j}`, p.point) })),
        })),
        swot: src.ai.swot
          ? {
              strengths: src.ai.swot.strengths.map((x, i) => t(`ws${i}`, x)),
              weaknesses: src.ai.swot.weaknesses.map((x, i) => t(`ww${i}`, x)),
              opportunities: src.ai.swot.opportunities.map((x, i) => t(`wo${i}`, x)),
              threats: src.ai.swot.threats.map((x, i) => t(`wt${i}`, x)),
            }
          : src.ai.swot,
        topics: src.ai.topics?.map((x, i) => ({ ...x, topic: t(`t${i}`, x.topic) })),
        contentIdeas: src.ai.contentIdeas?.map((c, i) => ({ ...c, title: t(`c${i}t`, c.title), why: t(`c${i}w`, c.why), outline: c.outline?.map((h, j) => t(`c${i}o${j}`, h)) })),
      }
    : null;
  const n = src.narrative;
  const narrative = n
    ? {
        ...n,
        headline: t('nh', n.headline),
        executiveSummary: t('ne', n.executiveSummary),
        keyFindings: n.keyFindings.map((f, i) => ({ title: t(`nf${i}t`, f.title), detail: t(`nf${i}d`, f.detail) })),
        competitors: n.competitors.map((c, i) => ({ ...c, summary: t(`nc${i}s`, c.summary), watchOut: t(`nc${i}w`, c.watchOut), learnFrom: t(`nc${i}l`, c.learnFrom) })),
        roadmap: n.roadmap.map((r, i) => ({ ...r, focus: t(`nr${i}f`, r.focus), steps: r.steps.map((s, j) => t(`nr${i}s${j}`, s)) })),
        kpis: n.kpis.map((k, i) => ({ metric: t(`nk${i}m`, k.metric), why: t(`nk${i}w`, k.why), target: t(`nk${i}t`, k.target) })),
        closing: t('nx', n.closing),
      }
    : null;
  const changes = src.changes?.map((c, i) => ({ ...c, text: t(`ch${i}`, c.text) })) ?? null;
  return { ai, narrative, changes };
}

export const TRANSLATE_SYSTEM = `You translate business report text from English into natural, simple Hindi (Devanagari script) for an Indian business owner.
Keep these exactly as they are: website domains, URLs, brand and product names, numbers, percentages, "SEO", "Google", "WhatsApp", "CTA" and other technical terms people use in English.
Do not add, remove or change any information. Keep each item about as short as the original.
Return only a JSON object: {"t": {"<id>": "<Hindi text>", ...}} with one entry for every id you were given.`;

export function translateUserPrompt(batch: { id: string; text: string }[]) {
  return `Translate every item:\n${JSON.stringify(Object.fromEntries(batch.map((b) => [b.id, b.text])))}`;
}

const DEVANAGARI = /[ऀ-ॿ]/;

/** Keeps translations for known ids that actually contain Hindi and still mention every domain/URL of the original. */
export function validateTranslations(text: string, batch: { id: string; text: string }[]): Record<string, string> {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const { id, text: original } of batch) {
    const v = raw?.t?.[id];
    if (typeof v !== 'string' || !v.trim() || v.length > original.length * 4 + 40) continue;
    const keep = original.match(/\b[a-z0-9-]+(\.[a-z0-9-]+)+\b|\d+(\.\d+)?/gi) ?? [];
    if (DEVANAGARI.test(v) && keep.every((k) => v.includes(k))) out[id] = v.replace(/\s+/g, ' ').trim();
  }
  return out;
}
