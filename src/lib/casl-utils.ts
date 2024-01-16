import { ZodType, z } from "zod";
import { ResourceConfigWithAbilityDefinition } from "./types";
import { AbilityBuilder, ForbiddenError, InferSubjects, createMongoAbility } from "@casl/ability";
import { subject as caslSubjectHelper } from "@casl/ability";

export function setupPermissionsContext<ContextSchema extends ZodType<any>>(config: {
  contextSchema: ContextSchema;
}) {
  /**
   * Use this function to define a resource and its permissions.
   * @param resourceConfig
   * @returns
   */
  const defineResource = function <T, U extends z.ZodEnum<any>>(
    resourceConfig: Omit<ResourceConfigWithAbilityDefinition<z.infer<ContextSchema>, T, U>, "name">
  ) {
    const resourceConfigWithoutDefineAbility = {
      actions: resourceConfig.actions,
      schema: resourceConfig.schema,
    } as const;
    return { resourceConfig, resourceConfigWithoutDefineAbility };
  };

  return {
    defineResource,
    /**
     * Use this function to create a permissions config.
     * @param resources
     * @returns
     */
    createPermissionsBuilder<T extends Record<string, ReturnType<typeof defineResource>>>(
      resources: T
    ) {
      const CaslConfig = resources;

      type CaslType<T extends z.ZodSchema<any, any>, U extends string> = {
        __caslSubjectType__: U;
      } & z.infer<T>;

      type CaslConfigTypes = {
        [K in keyof T]: CaslType<T[K]["resourceConfigWithoutDefineAbility"]["schema"], string>;
      };

      type ActionConfigMap = {
        [T in keyof typeof CaslConfig]: {
          actions: string[];
          actionsWithoutData: string[];
          schema: (typeof CaslConfig)[T]["resourceConfigWithoutDefineAbility"]["schema"];
          caslType: CaslConfigTypes[T];
        };
      };

      type ActionMap = {
        [T in keyof typeof CaslConfig]: (typeof CaslConfig)[T]["resourceConfigWithoutDefineAbility"]["actions"]["options"][number];
      };

      type DataMap = {
        [T in keyof ActionConfigMap]: ActionConfigMap[T]["caslType"];
      };

      type Subjects = keyof ActionMap;

      type Abilities = {
        [T in keyof ActionMap]: [ActionMap[T], InferSubjects<DataMap[T]>];
      }[keyof ActionMap];

      //We don't use this because it introduces type errors. If the user was working with casl directly, they would have to use this to get type safety. But since we are wrapping it, we don't need to use this as we're already providing type safety through our wrapper.
      //type AppAbility = MongoAbility<Abilities>;

      type ValidatePermissionsInput<S extends Subjects> = {
        subject: S;
        action: ActionMap[S];
        data: Omit<CaslConfigTypes[S], "__caslSubjectType__">;
      };

      /**
       * Use this function to build the user's permissions. You pass the context data to this function and it returns functions that you can use to check the user's permissions.
       * @param contextData
       * @returns
       */
      function buildPermissions(contextData: z.infer<ContextSchema>) {
        const {
          can: caslCanAction,
          cannot: caslCannotAction,
          build,
        } = new AbilityBuilder(createMongoAbility);

        for (const resourceName of Object.keys(resources)) {
          const defineAbility = resources[resourceName]?.resourceConfig.defineAbility;

          if (!defineAbility) {
            throw new Error(`No defineAbility function was defined for resource ${resourceName}.`);
          }

          defineAbility({
            can: (action: ActionMap[Subjects], data: DataMap[Subjects]) => {
              caslCanAction(action, resourceName, data);
            },
            cannot: (action, data, reason) => {
              if (reason) {
                caslCannotAction(action, resourceName, data).because(reason);
              } else {
                caslCannotAction(action, resourceName, data);
              }
            },
            context: contextData,
          });
        }
        const ability = build();

        /**
         * Process the arguments passed to the can and cannot functions so that they can be used by the casl library.
         * @param args
         * @returns
         */
        function getProcessedArgsFromValidatePermissionsInput<S extends Subjects>(
          args: ValidatePermissionsInput<S>
        ) {
          const { subject, action, data } = args;

          const zodSchemaForSubject = resources[subject]?.resourceConfigWithoutDefineAbility.schema;

          if (!zodSchemaForSubject) {
            throw new Error(`No schema was defined for subject ${String(subject)}.`);
          }

          // We parse the data first to make sure it is valid. This will throw an error if the data is invalid.
          try {
            zodSchemaForSubject.parse(data);
          } catch (error) {
            throw new Error(
              `The data passed to the '${String(
                subject
              )}' subject is invalid. Please check that the data you are passing matches the schema you defined.`
            );
          }

          const dataWithSubjectTypeAdded = data
            ? {
                ...args.data,
                __caslSubjectType__: args.subject,
              }
            : undefined;

          // We need to use the subject helper function from casl to add the __caslSubjectType__ property to the subject.
          // If no data is passed we use the subject name as the data.
          const currentSubjectData = dataWithSubjectTypeAdded
            ? caslSubjectHelper(subject as any, dataWithSubjectTypeAdded as any)
            : subject;

          return {
            action,
            currentSubjectData,
          };
        }

        /**
         * Check if the user can perform an action on a resource.
         * @param args
         * @returns
         */
        function can<T extends Subjects>(args: ValidatePermissionsInput<T>) {
          const { action, currentSubjectData } = getProcessedArgsFromValidatePermissionsInput(args);
          return ability.can(action, currentSubjectData);
        }

        /**
         * Check if the user cannot perform an action on a resource.
         * @param args
         * @returns
         */
        function cannot<T extends Subjects>(args: ValidatePermissionsInput<T>) {
          const { action, currentSubjectData } = getProcessedArgsFromValidatePermissionsInput(args);

          return ability.cannot(action, currentSubjectData);
        }

        /**
         * Throw an error if the user cannot perform an action on a resource.
         * @param args
         */
        function throwErrorIfCannot<T extends Subjects>(args: ValidatePermissionsInput<T>) {
          const { action, currentSubjectData } = getProcessedArgsFromValidatePermissionsInput(args);

          return ForbiddenError.from(ability).throwUnlessCan(action, currentSubjectData);
        }

        return { can, cannot, throwErrorIfCannot } as const;
      }

      return buildPermissions;
    },
  };
}
