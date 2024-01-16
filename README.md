# @damzoindistress/permissions-builder

`@damzoindistress/permissions-builder` provides a centralized and flexible approach to managing permissions across your app's resources. Built on top of CASL and zod, it extends the expressive power of permissions management with MongoDB's query language.

## Key Features

- **Built on CASL**: Utilizes CASL's established abilities for permissions management.
- **Centralized Configuration**: Manage permissions related to a specific resource in a single place.
- **Flexibility**: Take advantage of MongoDB's query language to create intricate permission rules based on object properties.
- **Reusability**: Consistently apply the same permission rules throughout different areas of your app.

## Getting Started

## Installation

```bash
npm install @damzoindistress/permissions-builder zod
```

You'll also need to install zod as it's a peer dependency.

### 1. Setting Up Permissions Context

To initialize the permissions, utilize the `setupPermissionsContext` function:

```typescript
import { setupPermissionsContext } from "@damzoindistress/permissions-builder";

import { z } from "zod";

const ContextSchema = z.object({
  userId: z.string(),
});

const { defineResource, createPermissionsBuilder } = setupPermissionsContext({
  contextSchema: ContextSchema, // Your zod schema goes here
});
```

This method sets up the context required for defining resources and creating permissions. This context will be available for every resource to access when defining permissions. You can define the context as whatever object you want, for instance, it might be the schema of a user in your app. Do note that when you've set up your permissions and ready to check whether they're valid, you will have to provide data that matches whatever context schema.

### 2. Defining Resources and Permissions

Next, use the `defineResource` method to define a resource and its associated permissions. Like the context, the resource schema must be a zod object schema:

```typescript
const WorkspaceSchema = z.object({
  createdAt: z.date(),
  name: z.string(),
  id: z.string(),
  createdBy: z.string(),
});

export const buildPermissions = createPermissionsBuilder({
  workspace: defineResource({
    actions: z.enum(["read", "update", "delete"]),
    schema: WorkspaceSchema, // Your schema goes here
    defineAbility: function ({ can, cannot, context }) {
      // Define your rules here using `can` and `cannot` functions.
    },
  }),
  // You can define more resources as needed, e.g files, documents.
});
```

When defining abilities, you have access to the MongoDB-like query language operators to shape your rules.

#### MongoDB Operators:

- `$eq` and `$ne`: Check if a value equals or doesn't equal a specified value.
- `$lt` and `$lte`: Check if a value is less than or less than and equal to a specified value.
- `$gt` and `$gte`: Check if a value is greater than or greater than and equal to a specified value.
- `$in` and `$nin`: Ensure that an object's property matches any of the specified array values. `$nin` is the opposite of `$in`.
- `$all`: Ensure an object's property contains all elements from a specified array.
- `$size`: Confirm that an array's length matches a specified value.
- `$regex`: Test an object's property value with a regular expression.
- `$exists`: Check if a particular property exists in an object.
- `$elemMatch`: Examine nested elements' structure and ensure they match specified criteria.

For a more in-depth explanation and usage of these operators, you can refer to MongoDB's documentation.

### 3. Using the CASL `can` and `cannot` Functions in defineAbility

The `can` and `cannot` functions from CASL provide the primary means to define your permissions:

```typescript
defineAbility: function ({ can, cannot, context }) {
  const bannedUsers = ["steve"]
  can("read");  // Allows reading
  cannot("update", { createdBy: { $in: bannedUsers } });  // Disallows updating for banned users
}
```

For a deep dive into how to use these functions (along with more examples), check out the [CASL documentation](https://casl.js.org/v6/en/guide/define-rules).

## Using `buildPermissions`

When you invoke `buildPermissions`, it returns an ability instance with three main methods: `can`, `cannot`, and `throwErrorIfCannot`. You would need to pass in data with the context schema you defined in order to initialize it. The `buildPermissions` function turns your permission rules into an internal index, so that the permission checkers run really fast.

```typescript
const currentUserId = "james";
const ability = buildPermissions({
  userId: currentUserId,
});

const workspace = {
  name: "test",
  createdAt: new Date(),
  id: "jeoobeo3",
  createdBy: currentUserId,
};

const canReadWorkspace = ability.can({
  subject: "workspace",
  action: "read",
  data: workspace,
});
```

### 1. `can` Method

The `can` method checks if a certain action on a subject is permissible.

**Usage**:

```typescript
const allowed = ability.can({
  subject: "workspace",
  action: "read",
  data: workspace,
});
```

In this example, it checks if the `workspace` can be read. If the user has permission, it returns `true`, otherwise `false`.

### 2. `cannot` Method

The `cannot` method is the opposite of the `can` method. It returns `true` if the user cannot perform the action and `false` if they can.

**Usage**:

```typescript
const workspace = {
  id: "jeoobeo3",
  name: "test",
  createdAt: new Date(),
  createdBy: "james",
};

const notAllowed = ability.cannot({
  subject: "workspace",
  action: "update",
  data: workspace,
});
```

### 3. `throwErrorIfCannot` Method

While `can` and `cannot` return boolean values, the `throwErrorIfCannot` method will throw a ForbiddenError if the user doesn't have the permission. It's particularly useful in scenarios where an operation should not proceed under any circumstance without the required permission.

**Usage**:

```typescript
try {
  ability.throwErrorIfCannot({
    subject: "workspace",
    action: "update",
    data: workspace,
  });
  // proceed with the update
} catch (error) {
  console.error("Permission denied:", error.message);
}
```

If you want to customise the error message, you can pass a `reason` string as a third parameter to the `cannot` function when defining the permissions for a resource:

```typescript
defineAbility: function ({ can, cannot, context }) {
      const bannedUsers = ["steve"];
      cannot(["update", "delete", "read"], { createdBy: { $in: bannedUsers } }, "because steve");
    }
```

## Practical Scenarios:

### Scenario 1: CRUD Operations for a Workspace Creator

Let's say you want to ensure that the user who created a workspace can perform all CRUD operations on it:

```typescript
const currentUserId = "james";
const ability = buildPermissions({
  userId: currentUserId,
});

if (ability.can({ subject: "workspace", action: "read", data: workspace })) {
  // User can read the workspace
}

if (ability.can({ subject: "workspace", action: "update", data: workspace })) {
  // User can update the workspace
}

// ... you can add similar checks for "delete" and other actions.
```

### Scenario 2: Guest Permissions

In another scenario, you might want guests to read workspaces, but not modify them:

```javascript
const guestAbility = buildPermissions({
  userId: "david",
});

if (guestAbility.can({ subject: "workspace", action: "read", data: workspace })) {
  // Guest can read the workspace
}

if (guestAbility.cannot({ subject: "workspace", action: "update", data: workspace })) {
  // Guest cannot update the workspace, so don't show the update button or functionality
}
```

### Scenario 3: Restricted Workspaces

In some cases, there might be workspaces created by specific users where no one is allowed to perform any operations:

```javascript
const ability = buildPermissions({
  userId: "mark",
});

["read", "update", "delete"].forEach((action) => {
  if (ability.cannot({ subject: "workspace", action, data: workspace })) {
    console.log(`User cannot ${action} this workspace.`);
  }
});
```

The permission system allows developers to create sophisticated rules and enforce them consistently across different parts of an app.
