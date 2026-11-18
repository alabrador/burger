import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts("created_at").notNull().defaultNow();

/* ---------- personal y seguridad ---------- */

export const staffRole = pgEnum("staff_role", ["owner", "admin", "manager", "kitchen", "cashier"]);

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: staffRole("role").notNull().default("cashier"),
  totpSecret: text("totp_secret"), // cifrado AES-GCM
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  lastLoginAt: ts("last_login_at"),
  passwordChangedAt: ts("password_changed_at").notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 del token de la cookie
    userId: uuid("user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    csrf: text("csrf").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: created(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id"),
    userEmail: text("user_email"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    data: jsonb("data"),
    ip: text("ip"),
    createdAt: created(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_entity_idx").on(t.entity, t.entityId)],
);

/* ---------- catálogo ---------- */

export const productKind = pgEnum("product_kind", ["base", "protein", "ingredient", "drink"]);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    kind: productKind("kind").notNull(),
    category: text("category").notNull(), // base, carne, quesos, vegetales, salsas, extras, bebidas
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    grams: integer("grams").notNull().default(0),
    kcal: integer("kcal").notNull().default(0),
    maxQty: integer("max_qty").notNull().default(1),
    allergens: text("allergens").array().notNull().default(sql`'{}'::text[]`),
    active: boolean("active").notNull().default(true),
    soldOut: boolean("sold_out").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    /** modelo 3D (clave de MODELS) con el que se pinta en la hamburguesa; null = no aparece en 3D */
    model: text("model"),
    /** color de muestra para salsas y miniaturas sin foto */
    swatch: text("swatch").notNull().default("#c9792e"),
    /** versión de la foto subida en el admin (0 = sin foto) */
    imageV: integer("image_v").notNull().default(0),
    /** creado desde el admin (se puede borrar); los de la carta base solo se ocultan */
    custom: boolean("custom").notNull().default(false),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.category, t.sort)],
);

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
  /** base, carne y bebidas son fijas: no se borran */
  locked: boolean("locked").notNull().default(false),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const productImages = pgTable("product_images", {
  productId: text("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  data: bytea("data").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ---------- clientes y pedidos ---------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    ordersCount: integer("orders_count").notNull().default(0),
    totalSpentCents: integer("total_spent_cents").notNull().default(0),
    lastOrderAt: ts("last_order_at"),
    notes: text("notes"),
    anonymizedAt: ts("anonymized_at"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("customers_email_uq").on(t.email)],
);

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "confirmed",
  "preparing",
  "ready",
  "collected",
  "cancelled",
]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "failed", "refunded", "partially_refunded"]);
export const paymentMethod = pgEnum("payment_method", ["stripe", "paypal", "bizum", "cash"]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    status: orderStatus("status").notNull().default("pending_payment"),
    paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
    paymentMethod: paymentMethod("payment_method").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    taxRate: integer("tax_rate_bp").notNull().default(1000), // puntos básicos: 1000 = 10 %
    currency: text("currency").notNull().default("EUR"),
    couponCode: text("coupon_code"),
    pickupAt: ts("pickup_at"),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key").unique(),
    ip: text("ip"),
    createdAt: created(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
    readyAt: ts("ready_at"),
    collectedAt: ts("collected_at"),
    cancelledAt: ts("cancelled_at"),
  },
  (t) => [
    index("orders_status_idx").on(t.status, t.createdAt),
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
    index("orders_email_idx").on(t.customerEmail),
    index("orders_pickup_idx").on(t.pickupAt),
    index("orders_payment_idx").on(t.paymentStatus, t.createdAt),
  ],
);

export type BurgerConfig = {
  protein: string;
  items: Record<string, number>;
  drink: string | null;
};

export const orderItems = pgTable(
  "order_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    config: jsonb("config").$type<BurgerConfig>().notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // status:confirmed, payment:paid, note…
    message: text("message"),
    userId: uuid("user_id"),
    createdAt: created(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentMethod("provider").notNull(),
    providerRef: text("provider_ref"),
    status: paymentStatus("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    currency: text("currency").notNull().default("EUR"),
    raw: jsonb("raw"),
    createdAt: created(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    uniqueIndex("payments_provider_ref_uq").on(t.provider, t.providerRef),
    index("payments_created_idx").on(t.createdAt),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.eventId] })],
);

/** Pago con tarjeta antes de crear el pedido: los datos del pedido esperan aquí hasta que Stripe confirma el cobro. */
export const cardDrafts = pgTable("card_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  payload: jsonb("payload").notNull(),
  ip: text("ip").notNull().default(""),
  totalCents: integer("total_cents").notNull(),
  paymentIntentId: text("payment_intent_id"),
  orderId: uuid("order_id"),
  createdAt: created(),
});

/* ---------- promociones ---------- */

export const couponType = pgEnum("coupon_type", ["percent", "fixed"]);

export const coupons = pgTable("coupons", {
  code: text("code").primaryKey(),
  type: couponType("type").notNull(),
  value: integer("value").notNull(), // % o céntimos
  minTotalCents: integer("min_total_cents").notNull().default(0),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  validFrom: ts("valid_from"),
  validTo: ts("valid_to"),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

/* ---------- configuración y correo ---------- */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const emailStatus = pgEnum("email_status", ["pending", "sending", "sent", "failed"]);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    template: text("template").notNull(),
    orderId: uuid("order_id"),
    status: emailStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: created(),
    sentAt: ts("sent_at"),
  },
  (t) => [index("email_outbox_pending_idx").on(t.status, t.nextAttemptAt)],
);
