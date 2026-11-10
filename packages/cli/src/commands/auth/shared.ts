export const resourcePositional = {
  kind: "tuple" as const,
  parameters: [
    { brief: "Credential resource (godaddy)", parse: String },
  ] as const,
};
export const keyFlag = {
  key: {
    kind: "parsed" as const,
    parse: String,
    brief: "Credential env name",
    optional: true as const,
  },
};
export const dryRunFlag = {
  "dry-run": {
    kind: "boolean" as const,
    brief: "Validate without changing stored credentials",
    default: false,
  },
};
