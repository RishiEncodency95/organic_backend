import { Request, Response } from "express";
import Job from "../../models/careers/Job.model";

// Default initial jobs data for seeding if empty
const DEFAULT_JOBS = [
  {
    title: "Sales Manager – Domestic Exhibition Sales & Sponsorships",
    slug: "sales-manager-domestic-exhibition-sales-sponsorships",
    company: "Namo Gange Wellness Pvt. Ltd. | Bharat Organic Expo",
    department: "Sales & Sponsorships",
    location: "Delhi NCR",
    employmentType: "Full-time",
    experienceMin: 3,
    experienceMax: 8,
    educationRequirements: "Graduate / MBA in Marketing or Business Administration preferred",
    skills: [
      "B2B Sales",
      "Exhibition Sales",
      "Sponsorship Sales",
      "Client Acquisition",
      "Negotiation",
      "Relationship Management",
      "Key Account Management",
    ],
    responsibilities: [
      "Drive domestic exhibition space sales and stall bookings for Bharat Organic Expo 2027.",
      "Identify, target, and pitch sponsorship packages to organic product brands, wellness organizations, and government bodies.",
      "Build and maintain strong relationships with key stakeholders and corporate clients.",
      "Achieve monthly and annual sales targets assigned by management.",
      "Represent Bharat Organic Expo at key industry events, expos, and networking meets.",
    ],
    requirements: [
      "3+ years of proven experience in exhibition, trade show, or B2B event sales.",
      "Demonstrated track record in client acquisition and high-value sponsorship closing.",
      "Excellent verbal and written communication, presentation, and negotiation skills.",
      "Relevant industry network in organic food, wellness, agriculture, or trade fairs.",
      "Willingness to travel across India for client meetings and promotional events.",
    ],
    preferredQualifications: [
      "Prior experience in healthcare, wellness, or organic industry trade shows.",
      "Strong database of domestic exhibitors and sponsors.",
    ],
    salary: "₹6,00,000 - ₹12,00,000 per annum + Performance Incentives",
    eligibilityThreshold: 40,
    status: "OPEN",
  },
  {
    title: "Event Operations & Logistics Lead",
    slug: "event-operations-logistics-lead",
    company: "Bharat Organic Expo 2027",
    department: "Operations & Logistics",
    location: "Delhi NCR",
    employmentType: "Full-time",
    experienceMin: 4,
    experienceMax: 10,
    educationRequirements: "Bachelor's Degree in Event Management, Hospitality, or Logistics",
    skills: [
      "Event Operations",
      "Vendor Management",
      "Venue Management",
      "Logistics Planning",
      "On-site Execution",
      "Budgeting",
    ],
    responsibilities: [
      "Oversee end-to-end event execution, booth fabrication, floor planning, and venue management.",
      "Coordinate with venue authorities, sound & lighting vendors, security, and catering teams.",
      "Ensure seamless movement of exhibitors, visitors, VIP delegates, and international speakers.",
    ],
    requirements: [
      "4+ years of hands-on experience managing large-scale trade expos or conventions.",
      "Strong vendor negotiation skills and emergency management capabilities.",
    ],
    eligibilityThreshold: 40,
    status: "OPEN",
  },
  {
    title: "Digital Marketing & PR Specialist",
    slug: "digital-marketing-pr-specialist",
    company: "Bharat Organic Expo 2027",
    department: "Marketing & PR",
    location: "Delhi NCR",
    employmentType: "Full-time",
    experienceMin: 2,
    experienceMax: 6,
    educationRequirements: "Bachelor's Degree in Marketing, Communications, or Journalism",
    skills: [
      "Social Media Marketing",
      "Performance Ads",
      "Content Strategy",
      "Press Release",
      "SEO",
      "Media Outreach",
    ],
    responsibilities: [
      "Manage social media channels, email campaigns, and PR announcements for BOE 2027.",
      "Drive delegate and visitor registrations through performance marketing and organic SEO.",
    ],
    requirements: [
      "2+ years of experience in digital marketing or agency PR management.",
      "Proficiency in Meta Ads, Google Ads, and press release distribution.",
    ],
    eligibilityThreshold: 40,
    status: "OPEN",
  },
  {
    title: "Software Developer – Full Stack (React, Next.js, Node.js)",
    slug: "software-developer-full-stack-react-next-node",
    company: "Bharat Organic Expo 2027",
    department: "IT & Software Engineering",
    location: "Delhi NCR",
    employmentType: "Full-time",
    experienceMin: 1,
    experienceMax: 5,
    educationRequirements: "B.Tech / B.E. in Computer Science, MCA, or relevant IT degree",
    skills: [
      "React.js",
      "Next.js",
      "Node.js",
      "Express.js",
      "MongoDB",
      "TypeScript",
      "MERN Stack",
      "REST APIs",
    ],
    responsibilities: [
      "Develop, maintain, and scale web applications using React, Next.js, Node.js, Express, and MongoDB.",
      "Build responsive UI components and integrate backend APIs.",
      "Implement AI integrations, CV parsing, and database optimization.",
    ],
    requirements: [
      "1+ years of experience in MERN stack development (React, Next.js, Node.js, Express, MongoDB).",
      "Strong proficiency in JavaScript, TypeScript, REST APIs, and database management.",
    ],
    eligibilityThreshold: 40,
    status: "OPEN",
  },
];

export const seedJobsIfEmpty = async () => {
  try {
    for (const jobData of DEFAULT_JOBS) {
      await Job.findOneAndUpdate(
        { slug: jobData.slug },
        { $setOnInsert: jobData },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error("Error seeding jobs:", err);
  }
};

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    await seedJobsIfEmpty();

    const { search, department, location, type } = req.query;
    const query: any = { status: "OPEN" };

    if (search) {
      query.$or = [
        { title: { $regex: String(search), $options: "i" } },
        { department: { $regex: String(search), $options: "i" } },
        { skills: { $in: [new RegExp(String(search), "i")] } },
      ];
    }

    if (department && department !== "All") {
      query.department = String(department);
    }

    if (location && location !== "All") {
      query.location = String(location);
    }

    if (type && type !== "All") {
      query.employmentType = String(type);
    }

    const jobs = await Job.find(query).sort({ publishedAt: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch job listings",
      error: (error as Error).message,
    });
  }
};

export const getJobBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const targetSlug = String(slug);
    
    // Support matching either slug or MongoDB _id
    let job = await Job.findOne({ slug: targetSlug });
    if (!job && targetSlug.match(/^[0-9a-fA-F]{24}$/)) {
      job = await Job.findById(targetSlug);
    }

    if (!job) {
      res.status(404).json({
        success: false,
        message: "Job position not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch job details",
      error: (error as Error).message,
    });
  }
};

export const createAdminJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobData = req.body;
    if (!jobData.slug && jobData.title) {
      jobData.slug = jobData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    }
    const job = await Job.create(jobData);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, message: "Failed to create job", error: (error as Error).message });
  }
};

export const updateAdminJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await Job.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: "Failed to update job", error: (error as Error).message });
  }
};

export const deleteAdminJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Job.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete job", error: (error as Error).message });
  }
};
