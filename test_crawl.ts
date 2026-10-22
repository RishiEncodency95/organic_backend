import { fetchWithTiming } from "./src/modules/seoAudit/crawler.service";
import * as cheerio from "cheerio";

async function main() {
  const res = await fetchWithTiming("https://bharatorganicexpo.com/");
  console.log("Status:", res.status);
  console.log("Body length:", res.body.length);
  console.log("Body preview:", res.body.substring(0, 300));
  console.log("Encoding:", res.encoding);
  
  const $ = cheerio.load(res.body);
  console.log("Title:", $('title').first().text());
  console.log("H1 count:", $('h1').length);
  console.log("Meta desc:", $('meta[name="description"]').attr("content"));
  console.log("Images:", $('img').length);
  console.log("Links:", $('a[href]').length);
  console.log("DOM nodes:", $('*').length);
}

main().catch(console.error);
