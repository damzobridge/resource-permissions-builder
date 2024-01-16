import { setupPermissionsContext } from "src/lib/casl-utils";
import { z } from "zod";
import { vi } from "vitest";
import { buildPermissions, WorkspaceSchema } from "./sample-data/sample-config";

describe("Permissions builder", () => {
  describe("setupPermissionsContext", () => {
    it("should return a defineResource function", () => {
      const result = setupPermissionsContext({
        contextSchema: z.object({}),
      });

      expect(result.defineResource).toBeDefined();
    });

    it("should return a createPermissionsBuilder function", () => {
      const result = setupPermissionsContext({
        contextSchema: z.object({}),
      });

      expect(result.createPermissionsBuilder).toBeDefined();
    });
  });

  describe("defineResource", () => {
    let defineResourceFunction: ReturnType<typeof setupPermissionsContext>["defineResource"];

    beforeEach(async () => {
      const result = setupPermissionsContext({
        contextSchema: z.object({}),
      });
      defineResourceFunction = result.defineResource;
    });

    afterEach(async () => {});

    it("should return a resource config", () => {
      const { defineResource } = setupPermissionsContext({
        contextSchema: z.object({}),
      });

      const actions = z.enum(["create", "read"]);
      const schema = z.object({
        name: z.string(),
      });

      const result = defineResource({
        actions: actions,
        schema: schema,
        defineAbility: function ({ can, cannot, context }) {
          can("create");
          cannot("read");
        },
      });
      expect(result.resourceConfig).toBeDefined();

      expect(result.resourceConfig).toBeDefined();
      expect(result.resourceConfig.actions).toEqual(actions);
      expect(result.resourceConfig.schema).toEqual(schema);

      const mockCan = vi.fn();
      const mockCannot = vi.fn();

      result.resourceConfig.defineAbility({
        can: mockCan,
        cannot: mockCannot,
        context: {},
      });

      expect(mockCan).toHaveBeenCalledWith("create");
      expect(mockCannot).toHaveBeenCalledWith("read");
    });

    it("should return a resource config without defineAbility", () => {
      const { defineResource } = setupPermissionsContext({
        contextSchema: z.object({}),
      });

      const actions = z.enum(["create"]);
      const schema = z.object({
        name: z.string(),
      });

      const result = defineResource({
        actions: actions,
        schema: schema,
        defineAbility: function ({ can, cannot, context }) {},
      });

      expect(result.resourceConfigWithoutDefineAbility).toBeDefined();
      expect(result.resourceConfigWithoutDefineAbility.actions).toEqual(actions);
      expect(result.resourceConfigWithoutDefineAbility.schema).toEqual(schema);
    });
  });

  describe("e2e", () => {
    beforeEach(async () => {});

    afterEach(async () => {});

    it("should allow the workspace creator to perform crud operations on workspace they created ", () => {
      const currentUserId = "james";
      const ability = buildPermissions({
        userId: currentUserId,
      });

      const workspace: z.infer<typeof WorkspaceSchema> = {
        name: "test",
        createdAt: new Date(),
        id: "jeoobeo3",
        createdBy: currentUserId,
      };

      expect(
        ability.can({
          subject: "workspace",
          action: "read",
          data: workspace,
        })
      ).toBeTruthy();

      expect(
        ability.cannot({
          subject: "workspace",
          action: "read",
          data: workspace,
        })
      ).toBeFalsy();

      expect(
        ability.can({
          subject: "workspace",
          action: "delete",
          data: workspace,
        })
      ).toBeTruthy();

      expect(
        ability.cannot({
          subject: "workspace",
          action: "delete",
          data: workspace,
        })
      ).toBeFalsy();

      expect(
        ability.can({
          subject: "workspace",
          action: "update",
          data: workspace,
        })
      ).toBeTruthy();

      expect(
        ability.cannot({
          subject: "workspace",
          action: "update",
          data: workspace,
        })
      ).toBeFalsy();
    });

    it("should allow a guest to read but not perform create, delete, or update operations on workspace they didn't create ", () => {
      const ability = buildPermissions({
        userId: "david",
      });

      const workspace: z.infer<typeof WorkspaceSchema> = {
        name: "test",
        createdAt: new Date(),
        id: "jeoobeo3",
        createdBy: "james",
      };

      expect(
        ability.can({
          subject: "workspace",
          action: "read",
          data: workspace,
        })
      ).toBeTruthy();

      expect(
        ability.can({
          subject: "workspace",
          action: "delete",
          data: workspace,
        })
      ).toBeFalsy();

      expect(
        ability.can({
          subject: "workspace",
          action: "update",
          data: workspace,
        })
      ).toBeFalsy();

      expect(() =>
        ability.throwErrorIfCannot({
          subject: "workspace",
          action: "update",
          data: workspace,
        })
      ).toThrowError();
    });

    it("should not allow any user to perform any crud operations if the workspace was created by steve ", () => {
      const ability = buildPermissions({
        userId: "mark",
      });

      const workspace: z.infer<typeof WorkspaceSchema> = {
        name: "test",
        createdAt: new Date(),
        id: "jeoobeo3",
        createdBy: "steve",
      };

      const actionsToTest = ["read", "update", "delete"] as const;

      actionsToTest.forEach((action) => {
        expect(
          ability.can({
            subject: "workspace",
            action: action,
            data: workspace,
          })
        ).toBeFalsy();

        expect(
          ability.cannot({
            subject: "workspace",
            action: action,
            data: workspace,
          })
        ).toBeTruthy();

        expect(() =>
          ability.throwErrorIfCannot({
            subject: "workspace",
            action: "update",
            data: workspace,
          })
        ).toThrowError("because steve");
      });
    });

    it("should throw an error if invalid data is passed", () => {
      const ability = buildPermissions({
        userId: "mark",
      });

      const workspace = undefined as any;
      expect(() =>
        ability.can({
          subject: "workspace",
          action: "read",
          data: workspace,
        })
      ).toThrowError();

      expect(() =>
        ability.cannot({
          subject: "workspace",
          action: "read",
          data: workspace,
        })
      ).toThrowError();
    });
  });
});
