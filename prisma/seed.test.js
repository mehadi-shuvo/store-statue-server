const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("../dist/generated/prisma/client");
const { syncSuperAdmin } = require("./seed");

test("syncSuperAdmin restores and refreshes an existing configured admin", async () => {
  const calls = [];
  const prisma = {
    user: {
      findUnique: async (args) => {
        calls.push(["findUnique", args]);
        return { id: "existing-admin-id" };
      },
      update: async (args) => {
        calls.push(["update", args]);
        return {
          id: "existing-admin-id",
          email: args.where.email,
          role: args.data.role,
          isActive: args.data.isActive,
          isDeleted: args.data.isDeleted,
        };
      },
      create: async (args) => {
        calls.push(["create", args]);
        throw new Error("create should not be called for an existing admin");
      },
    },
  };

  const result = await syncSuperAdmin(prisma, {
    email: " Admin@Example.COM ",
    password: "Str0ng!Password",
    name: "Super Admin",
    phone: " +8801000000000 ",
    saltRounds: 10,
  });

  assert.equal(result.email, "admin@example.com");
  assert.equal(result.role, UserRole.SUPER_ADMIN);
  assert.equal(result.isActive, true);
  assert.equal(result.isDeleted, false);
  assert.equal(calls[0][0], "findUnique");
  assert.equal(calls[0][1].where.email, "admin@example.com");
  assert.equal(calls[1][0], "update");
  assert.equal(calls[1][1].data.email, "admin@example.com");
  assert.equal(calls[1][1].data.role, UserRole.SUPER_ADMIN);
  assert.equal(calls[1][1].data.isActive, true);
  assert.equal(calls[1][1].data.isDeleted, false);
  assert.match(calls[1][1].data.password, /^\$2/);
  assert.notEqual(calls[1][1].data.password, "Str0ng!Password");
});

test("syncSuperAdmin creates the configured admin when no account uses the email", async () => {
  const calls = [];
  const prisma = {
    user: {
      findUnique: async (args) => {
        calls.push(["findUnique", args]);
        return null;
      },
      update: async (args) => {
        calls.push(["update", args]);
        throw new Error("update should not be called for a new admin");
      },
      create: async (args) => {
        calls.push(["create", args]);
        return {
          id: "new-admin-id",
          email: args.data.email,
          role: args.data.role,
          isActive: args.data.isActive,
          isDeleted: args.data.isDeleted,
        };
      },
    },
  };

  const result = await syncSuperAdmin(prisma, {
    email: "new-admin@example.com",
    password: "Str0ng!Password",
    name: "New Admin",
    saltRounds: 10,
  });

  assert.equal(result.email, "new-admin@example.com");
  assert.equal(result.role, UserRole.SUPER_ADMIN);
  assert.equal(result.isActive, true);
  assert.equal(result.isDeleted, false);
  assert.equal(calls[1][0], "create");
  assert.equal(calls[1][1].data.phone, undefined);
  assert.match(calls[1][1].data.password, /^\$2/);
  assert.notEqual(calls[1][1].data.password, "Str0ng!Password");
});
