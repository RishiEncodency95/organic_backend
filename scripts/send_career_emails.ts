/*
 * Sends the "application submitted" emails (candidate + HR) for one submitted application.
 * Use it to test the templates, or to resend after fixing the SMTP settings.
 *
 *   npm run careers:send-emails -- BOE2026-000015            # both emails
 *   npm run careers:send-emails -- BOE2026-000015 candidate  # only the candidate
 *   npm run careers:send-emails -- BOE2026-000015 hr         # only HR
 *   npm run careers:send-emails -- --check                    # only test the SMTP login
 */
import "dotenv/config";
import mongoose from "mongoose";
import Application from "../src/models/careers/Application.model";
import "../src/models/careers/CandidateProfile.model";
import "../src/models/careers/Job.model";
import "../src/models/careers/CvAnalysis.model";
import { getTransporter } from "../src/services/email.service";
import {
  buildSubmissionEmailData,
  hrRecipients,
  sendCandidateSubmittedEmail,
  sendHrNewApplicationEmail,
} from "../src/services/careerSubmissionMail.service";

async function main() {
  const [id, only] = process.argv.slice(2);

  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP_USER / SMTP_PASS are not set in .env");
  try {
    await transporter.verify();
    console.log(`SMTP login OK (${process.env.SMTP_USER})`);
  } catch (err) {
    throw new Error(`SMTP login failed for ${process.env.SMTP_USER}: ${(err as Error).message.split("\n")[0]}`);
  }
  if (!id || id === "--check") return;

  await mongoose.connect(process.env.MONGODB_URI as string);
  const app: any = await Application.findOne({ applicationId: id }).populate("candidateId").populate("jobId").populate("cvAnalysisId");
  if (!app) throw new Error(`Application ${id} not found`);
  if (app.status !== "SUBMITTED") console.warn(`Note: ${id} has status ${app.status}`);

  const data = await buildSubmissionEmailData(app, app.candidateId || app.candidateSnapshot, app.jobId, app.cvAnalysisId || app.scoreSnapshot);
  if (only !== "hr") {
    const ok = await sendCandidateSubmittedEmail(data);
    console.log(`Candidate email → ${process.env.CAREER_CANDIDATE_EMAIL || data.candidate.email || "(no email on profile)"}: ${ok ? "SENT" : "FAILED"}`);
  }
  if (only !== "candidate") {
    const r = await hrRecipients();
    const ok = await sendHrNewApplicationEmail(data);
    console.log(`HR email → ${[...r.to, ...r.cc.map((e) => `cc ${e}`)].join(", ") || "(no recipients)"}: ${ok ? "SENT" : "FAILED"}`);
  }
}

main()
  .catch((err) => {
    console.error("✖", (err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
