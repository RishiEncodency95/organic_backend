import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import ExpoEvent from "../src/models/expo/ExpoEvent.model";

/**
 * Creates the Bharat Organic Expo 2027 event (dates and venue as published on the
 * website) if it does not exist yet. Stalls and stall rates are NOT seeded — they are
 * real prices and inventory, so the admin enters them.
 *
 *   npm run seed:expo-event
 */
async function seed() {
  try {
    await connectDB();
    const result = await ExpoEvent.updateOne(
      { name: "Bharat Organic Expo 2027" },
      {
        $setOnInsert: {
          name: "Bharat Organic Expo 2027",
          startDate: new Date("2027-02-19T00:00:00+05:30"),
          endDate: new Date("2027-02-21T23:59:59+05:30"),
          venue: "Bharat Mandapam, Pragati Maidan",
          city: "New Delhi",
          isActive: true,
          paymentPlans: [{ id: "full", label: "Full Payment", percentage: 100 }],
        },
      },
      { upsert: true }
    );
    console.log(result.upsertedCount ? "Created Bharat Organic Expo 2027" : "Bharat Organic Expo 2027 already exists — left unchanged");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
