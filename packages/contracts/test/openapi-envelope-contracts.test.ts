import { describe, expect, it } from "bun:test";
import { ApiQueryDefaults, ApiRoutes } from "@/index";

declare const Bun: {
  file(path: URL): {
    text(): Promise<string>;
  };
  YAML: {
    parse(text: string): unknown;
  };
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value;
}

function valueAtPath(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    const currentRecord = toRecord(current);
    if (currentRecord === null) {
      return undefined;
    }
    current = Reflect.get(currentRecord, segment);
  }
  return current;
}

function stringAtPath(root: unknown, path: readonly string[]): string | null {
  const value = valueAtPath(root, path);
  if (typeof value !== "string") {
    return null;
  }
  return value;
}

function arrayAtPath(root: unknown, path: readonly string[]): readonly unknown[] | null {
  const value = valueAtPath(root, path);
  if (!Array.isArray(value)) {
    return null;
  }
  return value;
}

async function loadOpenApiDocument(): Promise<unknown> {
  const openApiFile = Bun.file(
    new URL("./fixtures/spatial-analysis-openapi.yaml", import.meta.url)
  );
  const openApiText = await openApiFile.text();
  return Bun.YAML.parse(openApiText);
}

describe("openapi runtime alignment", () => {
  it("defines shared envelope schemas", async () => {
    const document = await loadOpenApiDocument();
    const responseMetaType = stringAtPath(document, [
      "components",
      "schemas",
      "ResponseMeta",
      "type",
    ]);
    const apiErrorResponseType = stringAtPath(document, [
      "components",
      "schemas",
      "ApiErrorResponse",
      "type",
    ]);

    expect(responseMetaType).toBe("object");
    expect(apiErrorResponseType).toBe("object");
  });

  it("uses the runtime route surface without the old /api server prefix split", async () => {
    const document = await loadOpenApiDocument();
    const serverUrl = stringAtPath(document, ["servers", "0", "url"]);
    const parcelDetailPath = valueAtPath(document, ["paths", `${ApiRoutes.parcels}/{parcelId}`]);
    const facilitiesPath = valueAtPath(document, ["paths", ApiRoutes.facilities]);
    const removedAnalysisPath = valueAtPath(document, ["paths", "/analysis/parcels/score"]);

    expect(serverUrl).toBe("/");
    expect(parcelDetailPath).not.toBeUndefined();
    expect(facilitiesPath).not.toBeUndefined();
    expect(removedAnalysisPath).toBeUndefined();
  });

  it("documents shared headers and query defaults for parcel detail", async () => {
    const document = await loadOpenApiDocument();
    const parameterRefs = arrayAtPath(document, [
      "paths",
      `${ApiRoutes.parcels}/{parcelId}`,
      "get",
      "parameters",
    ]);
    const includeGeometryDefault = valueAtPath(document, [
      "paths",
      `${ApiRoutes.parcels}/{parcelId}`,
      "get",
      "parameters",
      "3",
      "schema",
      "default",
    ]);
    const profileDefault = valueAtPath(document, [
      "paths",
      `${ApiRoutes.parcels}/{parcelId}`,
      "get",
      "parameters",
      "4",
      "schema",
      "default",
    ]);
    const responseHeaderRef = stringAtPath(document, [
      "paths",
      `${ApiRoutes.parcels}/{parcelId}`,
      "get",
      "responses",
      "200",
      "headers",
      "x-request-id",
      "$ref",
    ]);

    expect(parameterRefs).toEqual([
      { $ref: "#/components/parameters/RequestIdHeader" },
      { $ref: "#/components/parameters/ParcelIngestionRunIdHeader" },
      {
        in: "path",
        name: "parcelId",
        required: true,
        schema: { type: "string" },
      },
      {
        in: "query",
        name: "includeGeometry",
        schema: {
          $ref: "#/components/schemas/ParcelGeometryMode",
          default: ApiQueryDefaults.parcelDetail.includeGeometry,
        },
      },
      {
        in: "query",
        name: "profile",
        schema: {
          $ref: "#/components/schemas/ParcelProfile",
          default: ApiQueryDefaults.parcelDetail.profile,
        },
      },
    ]);
    expect(includeGeometryDefault).toBe(ApiQueryDefaults.parcelDetail.includeGeometry);
    expect(profileDefault).toBe(ApiQueryDefaults.parcelDetail.profile);
    expect(responseHeaderRef).toBe("#/components/headers/RequestIdHeader");
  });

  it("keeps parcel detail 409 mapped to shared ApiErrorResponse", async () => {
    const document = await loadOpenApiDocument();
    const conflictSchemaRef = stringAtPath(document, [
      "paths",
      `${ApiRoutes.parcels}/{parcelId}`,
      "get",
      "responses",
      "409",
      "content",
      "application/json",
      "schema",
      "$ref",
    ]);

    expect(conflictSchemaRef).toBe("#/components/schemas/ApiErrorResponse");
  });

  it("documents polygon AOIs and facility fields using the runtime contract shape", async () => {
    const document = await loadOpenApiDocument();
    const polygonGeometryRef = stringAtPath(document, [
      "components",
      "schemas",
      "ParcelAoiPolygon",
      "properties",
      "geometry",
      "$ref",
    ]);
    const facilityNameSchemaType = stringAtPath(document, [
      "components",
      "schemas",
      "FacilitiesFeatureProperties",
      "properties",
      "facilityName",
      "type",
    ]);
    const providerNameSchemaType = stringAtPath(document, [
      "components",
      "schemas",
      "FacilitiesFeatureProperties",
      "properties",
      "providerName",
      "type",
    ]);

    expect(polygonGeometryRef).toBe("#/components/schemas/PolygonGeometry");
    expect(facilityNameSchemaType).toBe("string");
    expect(providerNameSchemaType).toBe("string");
  });
});
