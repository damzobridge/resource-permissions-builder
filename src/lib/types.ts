import { MongoQuery } from "@casl/ability";
import { ZodType, z } from "zod";

export type ZodInferred<T extends ZodType<any, any, any>> = z.infer<T>;

export type AbilityFunction<Context, ActionsEnum extends z.ZodEnum<any>, Data> = (args: {
  can: (
    action: ZodInferred<ActionsEnum> | ZodInferred<ActionsEnum>[],
    data?: MongoQuery<Data>
  ) => void;
  cannot: (
    action: ZodInferred<ActionsEnum> | ZodInferred<ActionsEnum>[],
    data?: MongoQuery<Data>,
    /**
     * The reason why the user cannot perform this action. This will be the message if an error is thrown.
     */
    reason?: string
  ) => void;
  context: Context;
}) => void;

export interface BaseResourceConfig<Context, Data, ActionsEnum extends z.ZodEnum<any>> {
  /**
   * The actions that can be performed on this resource.
   */
  actions: ActionsEnum;
  /**
   * Actions that do not require data. When permissions are built, these actions will not requuire a data argument.
   */
  //actionsWithoutData: ZodInferred<ActionsEnum>[];
  /**
   * The zod schema for the data that can be passed to the actions.
   */
  schema: ZodType<Data>;
}

export interface ResourceConfigWithAbilityDefinition<
  Context,
  Data,
  ActionsEnum extends z.ZodEnum<any>
> extends BaseResourceConfig<Context, Data, ActionsEnum> {
  /**
   * A function that defines the permissions for this resource.
   */
  defineAbility: AbilityFunction<Context, ActionsEnum, Data>;
}

export interface PermissionsConfig<ContextSchema extends ZodType<any>> {
  contextSchema: ContextSchema;
  resources: {
    [key: string]: Omit<
      ResourceConfigWithAbilityDefinition<ZodInferred<ContextSchema>, any, any>,
      "name"
    >;
  };
}
