import mongoose from "mongoose";
import Credential from "../src/models/credential.model";

const MONGODB_URI = "mongodb://127.0.0.1:27017/organic_db";

const now = Date.now();
const day = 24 * 3600 * 1000;

const credentialsData = [
  {
    category: "HOSTING",
    name: "Production Server (Yashobhoomi Cloud)",
    provider: "Amazon Web Services (AWS)",
    accountIdentifier: "AWS-BOE-PROD",
    loginUrl: "https://aws.amazon.com",
    startDate: new Date(now - 300 * day),
    expiryDate: new Date(now + 12 * day + 6 * 3600 * 1000),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "PAID",
    costAmount: 18500,
    currency: "INR",
    billingCycle: "MONTHLY",
    details: {
      serverType: "VPS / Dedicated",
      publicIp: "203.0.113.42",
      region: "ap-south-1 (Mumbai)",
      operatingSystem: "Ubuntu 24.04 LTS"
    }
  },
  {
    category: "DOMAIN",
    name: "Bharat Organic Domain (bharatorganicexpo.com)",
    provider: "GoDaddy Inc",
    accountIdentifier: "bharatorganicexpo.com",
    loginUrl: "https://godaddy.com",
    startDate: new Date(now - 340 * day),
    expiryDate: new Date(now + 18 * day + 2 * 3600 * 1000),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "PAID",
    costAmount: 2499,
    currency: "INR",
    billingCycle: "YEARLY",
    details: {
      domainName: "bharatorganicexpo.com",
      registrar: "GoDaddy Inc",
      dnsProvider: "Cloudflare"
    }
  },
  {
    category: "SMS_WHATSAPP",
    name: "Meta WhatsApp Business API",
    provider: "AiSensy / Meta Cloud",
    accountIdentifier: "+91 98765 43210",
    loginUrl: "https://app.aisensy.com",
    startDate: new Date(now - 120 * day),
    expiryDate: new Date(now + 89 * day + 22 * 3600 * 1000),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "PAID",
    costAmount: 4500,
    currency: "INR",
    billingCycle: "MONTHLY",
    details: {
      phoneNumber: "+91 98765 43210",
      wabaId: "123456789012345",
      messageLimit: "10000"
    }
  },
  {
    category: "PAYMENT_GATEWAY",
    name: "Razorpay Corporate Payment Gateway",
    provider: "Razorpay Software Pvt Ltd",
    accountIdentifier: "RZP-MID-EXPO2027",
    loginUrl: "https://dashboard.razorpay.com",
    startDate: new Date(now - 200 * day),
    expiryDate: new Date(now + 119 * day + 22 * 3600 * 1000),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "FREE",
    costAmount: 0,
    currency: "INR",
    details: {
      merchantId: "RZP-MID-EXPO2027",
      environment: "Live",
      settlementCycle: "T+1"
    }
  }
];

const seedCredentials = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    console.log("Clearing existing credentials...");
    await Credential.deleteMany({});

    console.log("Inserting new credentials...");
    await Credential.insertMany(credentialsData);
    
    console.log("Credentials seeded successfully!");
  } catch (error) {
    console.error("Error seeding credentials:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

seedCredentials();
