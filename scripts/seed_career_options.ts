import CareerOption, { CareerOptionType } from "../src/models/careers/CareerOption.model";
import { connectDB } from "../src/config/db";

// Copied from the application form's original hardcoded dropdowns.
const OPTIONS: Record<CareerOptionType, string[]> = {
  notice_period: ["Immediate", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"],
  joining_period: ["Immediate", "Within 7 Days", "Within 15 Days", "Within 30 Days"],
  expected_ctc: [
    "As per industry standards",
    "₹4 - 6 LPA",
    "₹6 - 8 LPA",
    "₹8 - 10 LPA",
    "₹10 - 12 LPA",
    "₹12+ LPA",
  ],
};

async function seed() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    // $setOnInsert only: re-running never overwrites values an admin has edited.
    for (const [type, labels] of Object.entries(OPTIONS)) {
      let inserted = 0;
      for (const [order, label] of labels.entries()) {
        const result = await CareerOption.updateOne(
          { type, label },
          { $setOnInsert: { type, label, order, isActive: true } },
          { upsert: true }
        );
        if (result.upsertedCount) inserted += 1;
      }
      console.log(`${type}: ${inserted} inserted, ${labels.length - inserted} already present`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
