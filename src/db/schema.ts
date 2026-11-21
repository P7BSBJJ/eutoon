import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(), // só dígitos, com DDI: 5511999998888
  name: text("name").notNull(),
  cpf: text("cpf"), // exigido só quando o grupo usa cobrança automática (Asaas)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodes = pgTable("otp_codes", {
  phone: text("phone").primaryKey(),
  code: text("code").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  // padrões dos jogos
  location: text("location").notNull().default(""),
  priceCents: integer("price_cents").notNull().default(0),
  slots: integer("slots").notNull().default(20),
  gkSlots: integer("gk_slots").notNull().default(2),
  perTeam: integer("per_team").notNull().default(5),
  deadlineHours: integer("deadline_hours").notNull().default(24),
  // recebimento
  pixKey: text("pix_key").notNull().default(""),
  pixName: text("pix_name").notNull().default(""),
  pixCity: text("pix_city").notNull().default(""),
  asaasWalletId: text("asaas_wallet_id"), // se preenchido + ASAAS_API_KEY: Pix automático com split pro organizador
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "membro"] }).notNull().default("membro"),
    kind: text("kind", { enum: ["mensalista", "diarista"] }).notNull().default("diarista"),
    position: text("position", { enum: ["linha", "goleiro"] }).notNull().default("linha"),
    rating: integer("rating").notNull().default(5),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    location: text("location").notNull(),
    priceCents: integer("price_cents").notNull(),
    slots: integer("slots").notNull(),
    gkSlots: integer("gk_slots").notNull(),
    perTeam: integer("per_team").notNull(),
    deadlineHours: integer("deadline_hours").notNull(),
    teamsJson: text("teams_json"), // último sorteio
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("games_group_idx").on(t.groupId, t.startsAt)],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id), // null = convidado sem conta
    guestName: text("guest_name"),
    invitedBy: uuid("invited_by").references(() => users.id),
    kind: text("kind", { enum: ["mensalista", "diarista", "convidado"] }).notNull(),
    position: text("position", { enum: ["linha", "goleiro"] }).notNull(),
    status: text("status", { enum: ["confirmado", "espera", "saiu"] }).notNull(),
    paid: boolean("paid").notNull().default(false),
    paidWith: text("paid_with", { enum: ["pix", "credito", "manual"] }),
    leftOutcome: text("left_outcome", { enum: ["no_prazo", "repasse", "perdeu"] }),
    replacedEntryId: uuid("replaced_entry_id"), // este entrou no lugar de quem saiu (repasse)
    checkinAt: timestamp("checkin_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [index("entries_game_idx").on(t.gameId, t.status, t.joinedAt)],
);

export const vaquinhas = pgTable("vaquinhas", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  goalCents: integer("goal_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
    vaquinhaId: uuid("vaquinha_id").references(() => vaquinhas.id, { onDelete: "set null" }),
    payerName: text("payer_name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // aguardando = gerou o Pix; informado = jogador disse que pagou (Pix estático); pago = confirmado
    status: text("status", { enum: ["aguardando", "informado", "pago", "cancelado"] }).notNull(),
    provider: text("provider", { enum: ["pix_estatico", "asaas"] }).notNull(),
    providerRef: text("provider_ref"),
    pixCode: text("pix_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payments_provider_ref_idx").on(t.providerRef)],
);

/** Livro-caixa de créditos do jogador no grupo (positivo = ganhou, negativo = usou) */
export const credits = pgTable(
  "credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    entryId: uuid("entry_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credits_user_idx").on(t.groupId, t.userId)],
);

export const stats = pgTable(
  "stats",
  {
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId] })],
);

export const votes = pgTable(
  "votes",
  {
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id").notNull().references(() => users.id),
    votedId: uuid("voted_id").notNull().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.voterId] })],
);

/** Mural de avisos da pelada (substitui os recados do grupo de WhatsApp) */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_group_idx").on(t.groupId, t.createdAt)],
);

/** Notificações dentro do app */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link").notNull().default("/"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);
