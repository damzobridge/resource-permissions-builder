// EXAMPLE USAGE

import { setupPermissionsContext } from "src/lib/casl-utils";
import { z } from "zod";

const ContextSchema = z.object({
  userId: z.string(),
});

export const WorkspaceSchema = z.object({
  createdAt: z.date(),
  name: z.string(),
  id: z.string(),
  createdBy: z.string(),
});

const { defineResource, createPermissionsBuilder } = setupPermissionsContext({
  contextSchema: ContextSchema,
});

export const buildPermissions = createPermissionsBuilder({
  workspace: defineResource({
    actions: z.enum(["read", "update", "delete"]),
    schema: WorkspaceSchema,
    defineAbility: function ({ can, cannot, context }) {
      const bannedUsers = ["steve"];

      if (context.userId) {
        can("read");
      }

      can(["update", "delete"], { createdBy: context.userId });

      // This should override the previous rules
      cannot(["update", "delete", "read"], { createdBy: { $in: bannedUsers } }, "because steve");
    },
  }),
  project: defineResource({
    actions: z.enum(["sing", "dance"]),
    schema: z.object({
      name: z.string(),
    }),
    defineAbility: function ({ can, cannot, context }) {
      if (!context.userId) {
        can("sing");
      }
      can(["dance"], { name: context.userId });
    },
  }),
});
