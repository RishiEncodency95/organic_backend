/**
 * End-to-end check of the dropdown, location, buyer-config, staff and expo (event /
 * stall / rate) APIs against a running backend. Everything it creates is deleted again.
 *
 *   npm run test:dropdowns
 *
 * Env: API_URL (default http://localhost:5000/api), ADMIN_EMAIL, ADMIN_PASSWORD
 * (a super admin, so permission checks pass).
 */
const API = process.env.API_URL || "http://localhost:5000/api";
const EMAIL = process.env.ADMIN_EMAIL || "admin@bharatorganic.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";

let passed = 0;
let failed = 0;
let token = "";

const check = (name: string, ok: unknown, detail = "") => {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? `  (${detail})` : ""}`);
};

const call = async (method: string, path: string, body?: unknown, auth = true) => {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, data: json?.data, message: json?.message as string | undefined, errors: json?.errors };
};
const q = encodeURIComponent;

async function main() {
  const login = await call("POST", "/auth/login", { email: EMAIL, password: PASSWORD }, false);
  token = login.data?.accessToken || "";
  check("Admin login", token, `HTTP ${login.status}`);
  if (!token) throw new Error("Cannot continue without an admin token");

  console.log("\n== Dropdowns ==");
  let r = await call("GET", "/dropdowns", undefined, false);
  check("All lists returned", r.status === 200 && Object.keys(r.data).length >= 59, `${Object.keys(r.data || {}).length} lists`);
  check("Seed present (36 Indian states)", r.data?.["india-states"]?.length === 36);
  r = await call("GET", `/dropdowns/exhibitor-sub-category?parent=${q("Medical & Healthcare")}`, undefined, false);
  check("Dependent list by parent", r.data?.length === 4);
  r = await call("GET", "/dropdowns/admin/lists", undefined, false);
  check("Admin list without login -> 401", r.status === 401);

  r = await call("POST", "/dropdowns/admin/options", { list: "gender", label: "QA Test Gender" });
  const opt = r.data;
  check("Create option", r.status === 201 && opt?.value === "QA Test Gender");
  r = await call("POST", "/dropdowns/admin/options", { list: "gender", label: "QA Test Gender" });
  check("Duplicate -> 409", r.status === 409);
  r = await call("PATCH", `/dropdowns/admin/options/${opt._id}`, { isActive: false });
  const hidden = await call("GET", "/dropdowns/gender", undefined, false);
  check("Inactive hidden from website", r.status === 200 && !hidden.data.some((o: any) => o.value === "QA Test Gender"));
  r = await call("DELETE", `/dropdowns/admin/options/${opt._id}`);
  check("Delete option", r.status === 200);

  console.log("\n== Submitted dropdown values are checked ==");
  r = await call("POST", "/partnership-enquiry", { name: "QA", organization: "QA", email: "qa@example.com", phone: "9000000000", category: "Not a category" }, false);
  check("Unknown partnership category -> 400", r.status === 400 && /not one of the allowed options/.test(r.message || ""), r.message);

  console.log("\n== Buyer config ==");
  r = await call("GET", "/buyer-registration/config", undefined, false);
  check("Domestic buyer config in mockConfig shape", r.status === 200 && Array.isArray(r.data?.regions) && typeof r.data.regions[0] === "string");
  r = await call("GET", "/international-buyer/config", undefined, false);
  check("International buyer config", r.status === 200 && r.data?.businessRoles?.length === 5);

  console.log("\n== Locations ==");
  r = await call("GET", "/crm-states?countryCode=IN", undefined, false);
  check("Indian states", r.data?.length === 36 && r.data.some((s: any) => s.stateCode === "IN-DL"));
  r = await call("POST", "/locations/admin/cities", { stateCode: "IN-DL", name: "QA Test Nagar" });
  const city = r.data;
  check("Admin adds a city", r.status === 201, r.message);
  r = await call("GET", "/crm-cities?stateCode=IN-DL", undefined, false);
  const names = (r.data || []).map((c: any) => c.name);
  check("Added city and 'Other' in city list", names.includes("QA Test Nagar") && names[names.length - 1] === "Other");
  r = await call("POST", "/locations/admin/cities", { stateCode: "IN-DL", name: "qa test nagar" });
  check("Same city again (any case) -> 409", r.status === 409);
  r = await call("DELETE", `/locations/admin/cities/${city?._id}`);
  check("Delete added city", r.status === 200);

  console.log("\n== Staff ==");
  r = await call("GET", "/public/employees", undefined, false);
  check("Staff list has no private fields", r.status === 200 && (r.data || []).every((s: any) => !("email" in s) && !("phone" in s)));

  console.log("\n== Events, stalls, rates ==");
  r = await call("POST", "/events/admin", { name: "QA Test Expo", startDate: "2030-01-10", endDate: "2030-01-08" });
  check("End before start -> 400", r.status === 400);
  r = await call("POST", "/events/admin", {
    name: "QA Test Expo", startDate: "2030-01-10", endDate: "2030-01-12", isActive: false,
    paymentPlans: [{ id: "full", label: "Full", percentage: 100 }, { id: "adv", label: "Advance", percentage: 50 }],
  });
  const event = r.data;
  check("Create event", r.status === 201 && event?.paymentPlans?.length === 2);
  r = await call("GET", "/events/active", undefined, false);
  check("Inactive event not public", !r.data.some((e: any) => e._id === event._id));

  r = await call("POST", "/stalls/admin", { eventId: event._id, stallNumber: "QA-1", stallType: "shell space", length: 3, width: 3 });
  const stall = r.data;
  check("Create stall (type normalised, area = 9)", r.status === 201 && stall?.stallType === "Shell Space" && stall?.area === 9);
  r = await call("POST", "/stalls/admin", { eventId: event._id, stallNumber: "QA-1", stallType: "Raw Space", length: 3, width: 3 });
  check("Duplicate stall number -> 409", r.status === 409);
  r = await call("POST", "/stalls/admin", { eventId: event._id, stallNumber: "QA-X", stallType: "Tent", length: 3, width: 3 });
  check("Unknown stall type -> 400", r.status === 400);
  r = await call("POST", "/stalls/admin/bulk", {
    eventId: event._id,
    stalls: [
      { stallNumber: "QA-2", stallType: "Raw Space", length: 6, width: 3, plScheme: "Two Side Open" },
      { stallNumber: "QA-3", stallType: "Shell Space", length: 3, width: 4 },
    ],
  });
  check("Bulk create stalls", r.status === 201 && r.data?.length === 2);
  r = await call("PATCH", `/stalls/admin/${stall._id}`, { status: "booked", length: 4 });
  check("Update stall (area recalculated)", r.status === 200 && r.data?.area === 12);
  r = await call("GET", `/stalls/available?eventId=${event._id}`, undefined, false);
  check("Booked stall not offered", r.data?.length === 2 && !r.data.some((s: any) => s._id === stall._id));
  r = await call("DELETE", `/stalls/admin/${stall._id}`);
  check("Booked stall cannot be deleted -> 409", r.status === 409);

  r = await call("PUT", "/stall-rates/admin", { eventId: event._id, stallType: "Shell Space", currency: "INR", ratePerSqm: 12000 });
  const rate = r.data;
  r = await call("PUT", "/stall-rates/admin", { eventId: event._id, stallType: "Shell Space", currency: "INR", ratePerSqm: 12500 });
  check("Rate upsert updates instead of duplicating", r.status === 200 && r.data?._id === rate?._id && r.data?.ratePerSqm === 12500);
  r = await call("GET", `/stall-rates/find?eventId=${event._id}&currency=INR&stallType=${q("Shell Space")}`, undefined, false);
  check("Find rate", r.data?.ratePerSqm === 12500);
  r = await call("GET", `/stall-rates/find?eventId=${event._id}&currency=USD&stallType=${q("Shell Space")}`, undefined, false);
  check("Missing rate -> data null", r.status === 200 && r.data === null);

  r = await call("DELETE", `/events/admin/${event._id}`);
  check("Event with stalls cannot be deleted -> 409", r.status === 409);

  // cleanup
  await call("PATCH", `/stalls/admin/${stall._id}`, { status: "available" });
  const all = await call("GET", `/stalls/admin?eventId=${event._id}`);
  for (const s of all.data || []) await call("DELETE", `/stalls/admin/${s._id}`);
  r = await call("DELETE", `/events/admin/${event._id}`);
  check("Cleanup: stalls, rates and event deleted", r.status === 200);

  console.log(`\n${passed}/${passed + failed} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
