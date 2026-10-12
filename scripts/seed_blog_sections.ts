import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { listBlogCategoriesService } from "../src/modules/blogCategory/blogCategory.service";
import { listBlogExpertsService } from "../src/modules/blogExpert/blogExpert.service";
import { listBlogUpdatesService } from "../src/modules/blogUpdate/blogUpdate.service";
import { listBlogReportsService } from "../src/modules/blogReport/blogReport.service";

/**
 * Starting data for the admin-managed blog sections (website /blog):
 *   - Blog Categories   — the editor's old category list + any category existing posts use
 *   - Voices of Experts — the five experts the website showed
 *   - Latest from Bharat Organic Expo — the two update cards
 *   - Reports & Resources — the five report titles (no PDF yet → "Coming soon")
 *
 * The backend does this by itself on the first request after a deploy; this script just does
 * it right away. Each list is seeded only ONCE per database (a marker is saved), and never
 * while it already has data — so running it again, or after the team deleted items, changes nothing.
 *
 *   npm run seed:blog
 */
async function seed() {
  try {
    await connectDB();
    const [categories, experts, updates, reports] = await Promise.all([
      listBlogCategoriesService(),
      listBlogExpertsService(),
      listBlogUpdatesService(),
      listBlogReportsService(),
    ]);
    console.log("Blog sections ready:");
    console.log(`  Blog categories : ${categories.length}`);
    console.log(`  Experts         : ${experts.length}`);
    console.log(`  Latest updates  : ${updates.length}`);
    console.log(`  Reports         : ${reports.length}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
