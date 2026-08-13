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

const main = async () => {
  const connectionString = requiredEnv("DATABASE_URL");
  const email = requiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("SUPER_ADMIN_PASSWORD");
  const name = requiredEnv("SUPER_ADMIN_NAME");
  const phone = process.env.SUPER_ADMIN_PHONE?.trim() || undefined;

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const existingSuperAdmin = await prisma.user.findFirst({
      where: {
        email,
        role: UserRole.SUPER_ADMIN,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (existingSuperAdmin) {
      console.log(
        `Super admin already exists: ${existingSuperAdmin.email} (${existingSuperAdmin.id})`,
      );
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        isDeleted: true,
      },
    });

    const hashedPassword = await bcrypt.hash(
      password,
      Number(process.env.SALT_ROUNDS || 12),
    );

    const admin = existingUser
      ? await prisma.user.update({
          where: { email },
          data: {
            name,
            phone,
            password: hashedPassword,
            role: UserRole.SUPER_ADMIN,
            isDeleted: false,
          },
          select: {
            id: true,
            email: true,
            role: true,
            isDeleted: true,
          },
        })
      : await prisma.user.create({
          data: {
            email,
            name,
            phone,
            password: hashedPassword,
            role: UserRole.SUPER_ADMIN,
          },
          select: {
            id: true,
            email: true,
            role: true,
            isDeleted: true,
          },
        });

    console.log(
      `Created super admin: ${admin.email} (${admin.id}) [${admin.role}]`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
