import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("--- KanakkuFlow Initial Seeding Started ---");

  // 1. Create or retrieve Company
  let { data: company } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!company) {
    console.log("Creating default manufacturing company...");
    const { data: newCo, error: coErr } = await supabase
      .from("companies")
      .insert({
        legal_name: "Sri Murugan Food Industries Pvt Ltd",
        trade_name: "Murugan Foods",
        gstin: "33AAACR1234F1Z1",
        pan: "AAACR1234F",
        state_code: "33",
        email: "contact@muruganfoods.com",
        phone: "+91 98401 23456",
        is_active: true,
      })
      .select()
      .single();

    if (coErr) throw coErr;
    company = newCo;
    console.log("Company created:", company.id);
  } else {
    console.log("Existing company found:", company.id);
  }

  // 2. Create default branches
  const { data: existingBranches } = await supabase
    .from("branches")
    .select("id, code")
    .eq("company_id", company.id);

  let branch1 = existingBranches?.find((b) => b.code === "MDU-PLANT-01");
  let branch2 = existingBranches?.find((b) => b.code === "DGL-HUB-02");

  if (!branch1) {
    const { data: b1, error: b1Err } = await supabase
      .from("branches")
      .insert({
        company_id: company.id,
        code: "MDU-PLANT-01",
        name: "Madurai Main Murukku Plant",
        address_line1: "14/2 Ring Road Industrial Estate",
        city: "Madurai",
        state_code: "33",
        pincode: "625020",
        is_active: true,
      })
      .select()
      .single();
    if (b1Err) throw b1Err;
    branch1 = b1;
    console.log("Branch 1 created:", branch1.id);
  }

  if (!branch2) {
    const { data: b2, error: b2Err } = await supabase
      .from("branches")
      .insert({
        company_id: company.id,
        code: "DGL-HUB-02",
        name: "Dindigul Distribution Hub",
        address_line1: "88 Palani Road",
        city: "Dindigul",
        state_code: "33",
        pincode: "624001",
        is_active: true,
      })
      .select()
      .single();
    if (b2Err) throw b2Err;
    branch2 = b2;
    console.log("Branch 2 created:", branch2.id);
  }

  // 3. Create or Update Initial OWNER Account
  const ownerEmail = "owner@kanakkuflow.com";
  const ownerPassword = "KanakkuFlow@Owner2026!";

  let { data: usersData } = await supabase.auth.admin.listUsers();
  let ownerUser = usersData.users.find((u) => u.email === ownerEmail);

  if (!ownerUser) {
    console.log("Provisioning initial OWNER in auth.users...");
    const { data: newOwner, error: ownerAuthErr } =
      await supabase.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { full_name: "Sanjay K J (Owner)" },
      });
    if (ownerAuthErr) throw ownerAuthErr;
    ownerUser = newOwner.user;
  } else {
    console.log("Owner user already exists in auth.users:", ownerUser.id);
    // Ensure password is set
    await supabase.auth.admin.updateUserById(ownerUser.id, {
      password: ownerPassword,
    });
  }

  // Insert/Upsert Owner user_profile
  await supabase.from("user_profiles").upsert({
    id: ownerUser.id,
    email: ownerEmail,
    full_name: "Sanjay K J",
    mobile_number: "+91 98765 43210",
    requires_password_change: false,
  });

  // Insert/Upsert Owner company_membership
  let { data: ownerMembership } = await supabase
    .from("company_memberships")
    .select("id")
    .eq("company_id", company.id)
    .eq("user_id", ownerUser.id)
    .maybeSingle();

  if (!ownerMembership) {
    const { data: newMem, error: memErr } = await supabase
      .from("company_memberships")
      .insert({
        company_id: company.id,
        user_id: ownerUser.id,
        role: "OWNER",
        employee_code: "EMP-00001",
        status: "ACTIVE",
      })
      .select()
      .single();
    if (memErr) throw memErr;
    ownerMembership = newMem;
    console.log("Owner membership created:", ownerMembership.id);
  }

  // Assign Owner to both branches
  await supabase.from("membership_branches").upsert([
    {
      membership_id: ownerMembership.id,
      branch_id: branch1.id,
      is_default: true,
    },
    {
      membership_id: ownerMembership.id,
      branch_id: branch2.id,
      is_default: false,
    },
  ], { onConflict: "membership_id,branch_id" });

  // 4. Create or Update Initial ADMIN Account
  const adminEmail = "admin@kanakkuflow.com";
  const adminPassword = "KanakkuFlow@Admin2026!";

  let adminUser = usersData.users.find((u) => u.email === adminEmail);
  if (!adminUser) {
    console.log("Provisioning initial ADMIN in auth.users...");
    const { data: newAdmin, error: adminAuthErr } =
      await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { full_name: "Operations Admin" },
      });
    if (adminAuthErr) throw adminAuthErr;
    adminUser = newAdmin.user;
  } else {
    await supabase.auth.admin.updateUserById(adminUser.id, {
      password: adminPassword,
    });
  }

  // Insert/Upsert Admin user_profile
  await supabase.from("user_profiles").upsert({
    id: adminUser.id,
    email: adminEmail,
    full_name: "Anand Raj (Admin)",
    mobile_number: "+91 98400 11223",
    requires_password_change: false,
  });

  // Insert/Upsert Admin company_membership
  let { data: adminMembership } = await supabase
    .from("company_memberships")
    .select("id")
    .eq("company_id", company.id)
    .eq("user_id", adminUser.id)
    .maybeSingle();

  if (!adminMembership) {
    const { data: newAdminMem, error: adminMemErr } = await supabase
      .from("company_memberships")
      .insert({
        company_id: company.id,
        user_id: adminUser.id,
        role: "ADMIN",
        employee_code: "EMP-00002",
        status: "ACTIVE",
        created_by: ownerUser.id,
      })
      .select()
      .single();
    if (adminMemErr) throw adminMemErr;
    adminMembership = newAdminMem;
    console.log("Admin membership created:", adminMembership.id);
  }

  await supabase.from("membership_branches").upsert([
    {
      membership_id: adminMembership.id,
      branch_id: branch1.id,
      is_default: true,
    },
  ], { onConflict: "membership_id,branch_id" });

  console.log("\n========================================================");
  console.log(">>> KanakkuFlow Bootstrap Completed Successfully! <<<");
  console.log("========================================================");
  console.log("OWNER Credentials:");
  console.log("  Email:    " + ownerEmail);
  console.log("  Password: " + ownerPassword);
  console.log("--------------------------------------------------------");
  console.log("ADMIN Credentials:");
  console.log("  Email:    " + adminEmail);
  console.log("  Password: " + adminPassword);
  console.log("========================================================\n");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
