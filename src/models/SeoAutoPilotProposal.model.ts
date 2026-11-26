import mongoose, { Document, Schema } from "mongoose";

/**
 * What the Auto-Pilot WOULD change, saved for the admin to approve. Nothing in a proposal is written to the website data:
 * a change is applied only after an admin approves that item, and it is then logged in SeoFixLog like any other fix
 * (so it can be undone).
 */
export type ProposalItemStatus = "pending" | "applying" | "applied" | "rejected" | "stale" | "failed";

export interface IProposalItem {
  _id: mongoose.Types.ObjectId;
  route: string;
  type: string;
  /** The value the page has now (as seen when the proposal was made) */
  before: unknown;
  /** The value Auto-Pilot suggests */
  after: unknown;
  status: ProposalItemStatus;
  /** Why an item was not applied (changed meanwhile, error text) */
  note?: string;
  decidedAt?: Date;
  decidedBy?: string;
}

export interface ISeoAutoPilotProposal extends Document {
  /** "schedule" | "manual" (which audit run produced it) */
  source: string;
  /** open = still has items waiting; closed = every item decided; superseded = replaced by a newer proposal */
  state: "open" | "closed" | "superseded";
  items: IProposalItem[];
  pagesChecked: number;
  /** Pages where Auto-Pilot found a problem but could not write a suggestion (e.g. no AI answer): route -> reason */
  notProposed: Array<{ route: string; reason: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IProposalItem>({
  route: { type: String, required: true },
  type: { type: String, required: true },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: ["pending", "applying", "applied", "rejected", "stale", "failed"], default: "pending" },
  note: { type: String },
  decidedAt: { type: Date },
  decidedBy: { type: String },
});

const schema = new Schema<ISeoAutoPilotProposal>(
  {
    source: { type: String, default: "schedule" },
    state: { type: String, enum: ["open", "closed", "superseded"], default: "open", index: true },
    items: { type: [itemSchema], default: [] },
    pagesChecked: { type: Number, default: 0 },
    notProposed: { type: [new Schema({ route: String, reason: String }, { _id: false })], default: [] },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

const SeoAutoPilotProposal = mongoose.models.SeoAutoPilotProposal || mongoose.model<ISeoAutoPilotProposal>("SeoAutoPilotProposal", schema);
export default SeoAutoPilotProposal;
