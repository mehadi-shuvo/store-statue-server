require("dotenv/config");
const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient, UserRole } = require("../dist/generated/prisma/client");

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const adminSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  isDeleted: true,
};

const syncSuperAdmin = async (
  prisma,
  {
    email,
    password,
    name,
    phone,
    saltRounds = 12,
  },
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone?.trim() || undefined;
  const hashedPassword = await bcrypt.hash(password, Number(saltRounds || 12));

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        email: normalizedEmail,
        name,
        phone: normalizedPhone,
        password: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        isDeleted: false,
      },
      select: adminSelect,
    });
  }

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      phone: normalizedPhone,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isDeleted: false,
    },
    select: adminSelect,
  });
};

const main = async () => {
  const connectionString = requiredEnv("DATABASE_URL");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const admin = await syncSuperAdmin(prisma, {
      email: requiredEnv("SUPER_ADMIN_EMAIL"),
      password: requiredEnv("SUPER_ADMIN_PASSWORD"),
      name: requiredEnv("SUPER_ADMIN_NAME"),
      phone: process.env.SUPER_ADMIN_PHONE,
      saltRounds: process.env.SALT_ROUNDS || process.env.BCRYPT_SALT || 12,
    });

    console.log(
      `Synchronized super admin: ${admin.email} (${admin.id}) [${admin.role}]`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = { syncSuperAdmin };
