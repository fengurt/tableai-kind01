import { getSqlite } from "./client.js";
import { runMigrations } from "./migrate.js";
import { experts, briefs, requests } from "./schema.js";

const now = new Date();

const expertRows = [
  {
    id: "elena",
    name: "Prof. Elena Rossi",
    roleKey: "expert.elena.role",
    bioKey: "expert.elena.bio",
    priceCents: 25000,
    rating: "4.9",
    reviewCount: 127,
    responseHours: 24,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCLaKhFuR8HJ62XgApE7zS3q3V5szzHVf4WGGD1qJJQ9WBDAW97yPxpVOM2GBS-BGwIcBe7-q4eESXaZYwvY6ARkDBsVdrcHc7qdCJliCXlYEucUz_MRirP5IOznDSmf36x8vpiXKzmSS4O2p6Lv6tWAY2rKmKPC6N0iA-S2MhXr2VP8Ssaz_HNRDA9cY3twAY4iGJ8wtHy_f1JlbWIIaIJBbWKCnw8JaubuDyTcJCqFv03VMa5SuuXeW29dUsSs_ItPJa24eBMCg",
    updatedAt: now,
  },
  {
    id: "julian",
    name: "Dr. Julian Hayes",
    roleKey: "expert.julian.role",
    bioKey: "expert.julian.bio",
    priceCents: 30000,
    rating: "4.8",
    reviewCount: 89,
    responseHours: 48,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ7SXBOxArgSziyP3zmqkHtkhsAUJiMl6p6zverWPMyNuukNIx3d0MwtqXNlIX46thw4MPGnVsvNODLygjUWzzsJ4qCTYpq1cacv_JI3zdbmmDIzGwb8I2LNOG3j5uaAL_OcboPZ3pqZOyZg2kefS9KBPzuWYQ2AsxoMg57im52CVwm56Mp57f37mdt4e5_fjkmOWoGbL-yl4JaTMVjpPfI1HR2dKZbE7xiR72wpxj206Ua8Hyt95G1XCuGWuOB4vxfQGnZnkjZQ",
    updatedAt: now,
  },
  {
    id: "vance",
    name: "Dr. Julian Vance",
    roleKey: "expert.vance.role",
    bioKey: "expert.vance.bio",
    priceCents: 28000,
    rating: "4.9",
    reviewCount: 64,
    responseHours: 36,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBVjbImO9TbF5uFtLh2RZYbYS-0PRdmlv02gjR5YeNR4-MHT_2UXKTKDJTIO51PKJOU6jaQtom8rehNPkAYWlDJK6jd0Z70bPNsyCa4rVTtOGh6TyJpwulLVOPzWROJL_VUrkKJkgyCaWE469o5t4QgiEpovJ5ruosPaVcnfyEQ8Fnn065ERskPZhD1jzd3cYfaKRAXXZ4u3TPgBhNdnzEc_16gBPkrW2kEz2bUqwsqoztEPEzHW7eOJHJHDV7FbLoHX4zIeiamHA",
    updatedAt: now,
  },
];

async function main() {
  await runMigrations();
  const db = getSqlite();

  for (const row of expertRows) {
    await db.insert(experts).values(row).onConflictDoUpdate({
      target: experts.id,
      set: row,
    });
  }

  await db
    .insert(briefs)
    .values({
      id: "brief-demo-1",
      seekerId: null,
      title: "Portfolio Critique — Abstract Series",
      description: "Abstract series for juried exhibition",
      budgetCents: 25000,
      tags: "fine_art",
      status: "in_review",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(requests)
    .values({
      id: "req-demo-1",
      briefId: "brief-demo-1",
      expertId: "elena",
      status: "in_review",
      amountCents: 26200,
      feedbackPreview:
        "Your chromatic tension in panels 3–7 demonstrates a mature understanding...",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  console.log(`Seeded ${expertRows.length} experts + demo brief/request`);
}

main();
