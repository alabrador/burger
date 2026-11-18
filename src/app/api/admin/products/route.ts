import { asc } from "drizzle-orm";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { json } from "@/server/http";

export const GET = admin("orders.view", async () => json(await db().select().from(schema.products).orderBy(asc(schema.products.sort))));
