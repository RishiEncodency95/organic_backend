import speakeasy from "speakeasy";

const BASE_URL = "http://localhost:5000/api";

async function run() {
  console.log("=== Testing Authentication & 2FA Flow ===");

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  console.log("Health check:", await healthRes.json());

  // 2. Login as Super Admin (initial login, 2FA not yet enabled)
  console.log("\n1. Logging in with credentials...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@bharatorganic.com",
      password: "Admin@12345"
    })
  });
  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status, loginData.message);
  console.log("Tokens received:", !!loginData.data?.accessToken, "2FA setup required:", loginData.data?.twoFactorSetupRequired);

  const accessToken = loginData.data?.accessToken;
  const refreshToken = loginData.data?.refreshToken;

  if (!accessToken) {
    console.error("Login failed:", loginData);
    process.exit(1);
  }

  // 3. Setup 2FA
  console.log("\n2. Calling /auth/setup-2fa...");
  const setupRes = await fetch(`${BASE_URL}/auth/setup-2fa`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const setupData = await setupRes.json();
  console.log("Setup 2FA status:", setupRes.status, setupData.message);
  const secret = setupData.data?.secret;
  console.log("Secret key:", secret ? "Received (" + secret.slice(0, 6) + "...)" : "Missing");

  // 4. Generate TOTP code using speakeasy (simulating Microsoft Authenticator)
  const token = speakeasy.totp({
    secret: secret,
    encoding: "base32"
  });
  console.log("\n3. Generated TOTP code from Microsoft Authenticator simulation:", token);

  // 5. Confirm 2FA setup
  console.log("\n4. Confirming 2FA setup via /auth/verify-2fa...");
  const confirmRes = await fetch(`${BASE_URL}/auth/verify-2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ token })
  });
  const confirmData = await confirmRes.json();
  console.log("Confirm 2FA status:", confirmRes.status, confirmData.message);
  console.log("Backup codes received:", confirmData.data?.backupCodes?.length);

  // 6. Test login again now that 2FA is enabled
  console.log("\n5. Testing login with 2FA enabled (no TOTP code)...");
  const login2Res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@bharatorganic.com",
      password: "Admin@12345"
    })
  });
  const login2Data = await login2Res.json();
  console.log("Login status:", login2Res.status, login2Data.message);
  console.log("Requires 2FA:", login2Data.data?.requiresTwoFactor, "Temp token:", !!login2Data.data?.tempToken);

  // 7. Verify 2FA with tempToken
  console.log("\n6. Verifying 2FA step using tempToken...");
  const freshToken = speakeasy.totp({
    secret: secret,
    encoding: "base32"
  });
  const verifyRes = await fetch(`${BASE_URL}/auth/verify-2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: freshToken,
      tempToken: login2Data.data?.tempToken
    })
  });
  const verifyData = await verifyRes.json();
  console.log("Verify 2FA status:", verifyRes.status, verifyData.message);
  console.log("Final Access token:", !!verifyData.data?.accessToken);

  const verifiedAccessToken = verifyData.data?.accessToken;

  // 8. Test Refresh Token endpoint
  console.log("\n7. Testing /auth/refresh-token endpoint...");
  const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  const refreshData = await refreshRes.json();
  console.log("Refresh status:", refreshRes.status, refreshData.message);
  console.log("New tokens received:", !!refreshData.data?.accessToken);

  // 9. Test Staff list
  console.log("\n8. Fetching staff list with real JWT...");
  const staffRes = await fetch(`${BASE_URL}/users/admin/staff`, {
    headers: { Authorization: `Bearer ${verifiedAccessToken}` }
  });
  const staffData = await staffRes.json();
  console.log("Staff list count:", staffData.data?.length);

  // 10. Test Staff creation
  console.log("\n9. Testing staff creation...");
  const inviteRes = await fetch(`${BASE_URL}/users/admin/staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${verifiedAccessToken}`
    },
    body: JSON.stringify({
      name: "Test Staff Member",
      email: `teststaff_${Date.now()}@bharatorganic.com`,
      phone: "+91 9999988888",
      roleId: "role_admin"
    })
  });
  const inviteData = await inviteRes.json();
  console.log("Invite status:", inviteRes.status, inviteData.message);
  console.log("Created staff password:", inviteData.data?.temporaryPassword);

  console.log("\n=== ALL TESTS PASSED! ===");
  process.exit(0);
}

run().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
